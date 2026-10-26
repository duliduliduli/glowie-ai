import "server-only";
import { z } from "zod";
import { db } from "./db";
import { complete, estimateCredits, parseJson, type AiResult, type Message } from "./openrouter";
import { withHold } from "./ledger";
import { assertUnderSpendCap, rateLimit } from "./guards";
import { vibeLabel, type ModelRole } from "./config";

const color = z.object({ name: z.string(), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) });

export const AnalysisSchema = z.object({
  faceShape: z.string(),
  faceShapeNotes: z.string(),
  undertone: z.string(),
  hairType: z.string(),
  hairLength: z.string(),
  currentStyle: z.string(),
  season: z.string(),
  seasonNotes: z.string(),
  bestColors: z.array(color).min(4).max(10),
  neutrals: z.array(color).min(2).max(6),
  avoidColors: z.array(color).min(2).max(6),
  metals: z.string(),
  highlights: z.array(z.string()).max(5),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

export const LookSchema = z.object({
  title: z.string(),
  summary: z.string(),
  whyItSuits: z.string(),
  outfit: z
    .array(
      z.object({
        piece: z.string(),
        description: z.string(),
        color: z.string(),
        searchQuery: z.string(),
        /** Share of the outfit budget for this piece (0-1), used by the budget slider. */
        budgetShare: z.number().min(0).max(1),
      }),
    )
    .min(2)
    .max(7),
  hair: z.object({
    style: z.string(),
    steps: z.array(z.string()).min(2).max(8),
    products: z.array(z.string()).max(6),
    stylistNote: z.string(),
    salon: z.object({ level: z.string(), tone: z.string(), technique: z.string(), cut: z.string() }),
    growOut: z.object({ week1: z.string(), month3: z.string(), month6: z.string() }),
    maintenance: z.object({ salonVisitsPerYear: z.number(), costPerVisitUsd: z.tuple([z.number(), z.number()]), salonHours: z.number(), dailyMinutes: z.number() }),
  }),
  makeup: z.object({ look: z.string(), steps: z.array(z.string()).min(2).max(10), products: z.array(z.string()).max(8) }),
  colorsToWear: z.array(color).min(2).max(6),
  colorsToAvoid: z.array(color).min(1).max(4),
});
export const LooksSchema = z.object({ looks: z.array(LookSchema).length(3) });
export const EventSchema = z.object({ dressCode: z.string(), weatherNote: z.string(), look: LookSchema, packingList: z.array(z.string()).min(3).max(20) });
export type Look = z.infer<typeof LookSchema>;
export type EventPlan = Omit<z.infer<typeof EventSchema>, "look">;

/** Safety check and selfie coach in one call. */
export const PhotoCheckSchema = z.object({
  realPhoto: z.boolean(),
  faceCount: z.number(),
  clearlyAdult: z.boolean(),
  nudityOrSexual: z.boolean(),
  samePersonAsReference: z.boolean().nullable(),
  lighting: z.number().min(0).max(10),
  angle: z.number().min(0).max(10),
  sharpness: z.number().min(0).max(10),
  faceVisible: z.number().min(0).max(10),
  tips: z.array(z.string()).max(3),
});
export type PhotoCheck = z.infer<typeof PhotoCheckSchema>;
/** 0-100 coach score; face visibility and lighting matter most for good previews. */
export const coachScore = (c: Pick<PhotoCheck, "lighting" | "angle" | "sharpness" | "faceVisible">) =>
  c.lighting * 3 + c.faceVisible * 3 + c.angle * 2 + c.sharpness * 2;

export const RoastSchema = z.object({
  score: z.number().min(1).max(10),
  headline: z.string(),
  whatWorks: z.array(z.string()).min(1).max(4),
  quickFixes: z.array(z.string()).min(1).max(5),
  verdict: z.string(),
});
export type Roast = z.infer<typeof RoastSchema>;

export type Quiz = { occasion?: string; budget?: string; highlight?: string[] };

type RunOpts = { userId: string; role: ModelRole; reason: string; free?: boolean };

/**
 * The only way to call a model: global spend cap, per-user rate limit, credit hold sized to the worst case,
 * settle at actual cost x markup, release on failure, and an AiCall row for the admin dashboard.
 */
export async function runAi<T>(opts: RunOpts, messages: Message[], parse: (r: AiResult) => T, json = true) {
  await assertUnderSpendCap();
  await rateLimit("ai", opts.userId);
  const exec = async () => {
    let r: AiResult | undefined;
    try {
      r = await complete(opts.role, messages, { json });
      return { result: parse(r), costUsd: r.costUsd, model: r.model };
    } catch (e) {
      await db.aiCall.create({ data: { userId: opts.userId, role: opts.role, model: r?.model, status: "failed", costUsd: r?.costUsd ?? 0, error: String(e).slice(0, 500) } });
      throw e;
    }
  };
  if (opts.free) {
    const out = await exec();
    await db.aiCall.create({ data: { userId: opts.userId, role: opts.role, model: out.model, status: "ok", costUsd: out.costUsd } });
    return { result: out.result, charged: 0 };
  }
  let done = { model: "", costUsd: 0 };
  const out = await withHold(opts.userId, await estimateCredits(opts.role), opts.reason, async () => (done = await exec()));
  await db.aiCall.create({ data: { userId: opts.userId, role: opts.role, model: done.model, status: "ok", costUsd: done.costUsd, credits: out.charged } });
  return out;
}

const SAFETY =
  "Never sexualise the person, never suggest nudity or revealing lingerie, never change or comment on race, ethnicity, body size or age, and never reference or imitate celebrities. Styling suggestions only, not medical or professional advice.";

const img = (url: string) => ({ type: "image_url" as const, image_url: { url } });

export function analysisMessages(selfie: string): Message[] {
  return [
    {
      role: "system",
      content: `You are an expert, kind personal stylist and colour analyst. ${SAFETY} Reply with JSON only.`,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Analyse this selfie. Return JSON with keys: faceShape, faceShapeNotes (2 sentences on flattering necklines, hair framing and accessories), undertone (warm|cool|neutral|olive), hairType (e.g. 2B wavy), hairLength, currentStyle, season (12-season colour analysis, e.g. "Soft Autumn"), seasonNotes (2 sentences), bestColors (6-8 {name, hex}), neutrals (3-4 {name, hex}), avoidColors (3-4 {name, hex}), metals (gold|silver|both), highlights (up to 4 short compliments about features to play up).`,
        },
        img(selfie),
      ],
    },
  ];
}

const LOOK_SHAPE = `{title, summary (1 sentence), whyItSuits (2 sentences referencing their colours/face shape), outfit: [3-6 {piece, description, color, searchQuery (short shopping search, e.g. "camel wool wrap coat"), budgetShare (fraction of the outfit budget, all pieces sum to 1)}], hair: {style, steps (3-6), products (product types, not brands), stylistNote (one sentence for a hairstylist), salon: {level (hair colour level 1-10 and target, e.g. "Level 6 to 7"), tone (e.g. "warm golden beige"), technique (e.g. "face-framing babylights, root smudge"), cut (cut technique, e.g. "long layers, point-cut ends, curtain fringe")}, growOut: {week1, month3, month6 (how this hair looks as it grows out, one sentence each)}, maintenance: {salonVisitsPerYear, costPerVisitUsd: [low, high] typical US salon prices, salonHours (per visit), dailyMinutes (daily styling)}}, makeup: {look, steps (4-8), products (product types)}, colorsToWear: [3-5 {name, hex}], colorsToAvoid: [2-3 {name, hex}]}`;

export function looksMessages(analysis: Analysis, vibe: string, quiz: Quiz, customPrompt?: string | null): Message[] {
  return [
    { role: "system", content: `You are an expert personal stylist, hairstylist and makeup artist. ${SAFETY} Reply with JSON only.` },
    {
      role: "user",
      content: `Client profile: ${JSON.stringify(analysis)}
Vibe: ${vibe === "custom" ? `Custom: "${customPrompt ?? ""}"` : vibeLabel(vibe)}
Occasion: ${quiz.occasion ?? "everyday"}. Budget: ${quiz.budget ?? "mid-range"}. Wants to highlight: ${(quiz.highlight ?? []).join(", ") || "no preference"}.

Create 3 distinct complete looks for this vibe that suit their colouring and face shape. Return JSON {"looks": [3 x ${LOOK_SHAPE}]}`,
    },
  ];
}

export function eventMessages(analysis: Analysis | null, event: { description: string; date: string; location: string; budgetUsd: number }, weather: string): Message[] {
  return [
    { role: "system", content: `You are an expert personal stylist planning an outfit for a real event. ${SAFETY} Reply with JSON only.` },
    {
      role: "user",
      content: `Client profile: ${analysis ? JSON.stringify(analysis) : "unknown, use their selfie-free defaults"}
Event: "${event.description}" on ${event.date} in ${event.location}. Outfit budget: about $${event.budgetUsd}.
Weather: ${weather}

Work out the likely dress code and how the weather changes the outfit. Return JSON {"dressCode": one sentence, "weatherNote": one sentence, "look": ${LOOK_SHAPE}, "packingList": 6-15 short items including touch-up makeup and weather backups}`,
    },
  ];
}

export function hairStageMessages(base: string, look: Look, stage: "week1" | "month3" | "month6"): Message[] {
  return [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Edit this photo of a real person to show ONLY their hair changed. Keep their face, identity, skin tone, ethnicity, age, clothing, pose, background and lighting exactly the same.
Hairstyle: ${look.hair.style}. Colour: ${look.hair.salon.tone}, ${look.hair.salon.level}. Technique: ${look.hair.salon.technique}.
Show it ${stage === "week1" ? "one week after the salon visit" : stage === "month3" ? "three months later, with no salon visit since" : "six months later, with no salon visit since"}: ${look.hair.growOut[stage]}
Photorealistic. No text or watermark.`,
        },
        img(base),
      ],
    },
  ];
}

export function roastMessages(outfit: string): Message[] {
  return [
    { role: "system", content: `You are a witty but kind fashion critic. Roast the outfit, never the person's body, face, age or identity. ${SAFETY} Reply with JSON only.` },
    {
      role: "user",
      content: [
        { type: "text", text: `Rate this outfit. Return JSON {"score": 1-10, "headline": a short funny one-liner about the outfit, "whatWorks": 1-3 points, "quickFixes": 2-4 specific, cheap fixes, "verdict": one encouraging sentence}` },
        img(outfit),
      ],
    },
  ];
}

export function previewMessages(base: string, look: Look, isFullBody: boolean): Message[] {
  const outfit = look.outfit.map((o) => `${o.color} ${o.piece}`).join(", ");
  return [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Edit this photo of a real person to preview a new look. Keep their face, facial features, identity, skin tone, ethnicity, age and body shape exactly the same and clearly recognisable. Keep the pose, background and lighting.
Change only:
- Hair: ${look.hair.style}
- Makeup: ${look.makeup.look}
${isFullBody ? `- Outfit: ${outfit}` : `- Visible clothing: ${outfit}`}
Fully clothed, tasteful, photorealistic, natural skin texture. No text or watermark.`,
        },
        img(base),
      ],
    },
  ];
}

export function photoCheckMessages(photo: string, reference?: string): Message[] {
  return [
    {
      role: "system",
      content: "You are a strict image safety checker. Reply with JSON only.",
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Check the FIRST image${reference ? " and compare it to the SECOND (reference) image" : ""}. Return JSON {"realPhoto": true if it is a real, unedited photo of a real human (not a drawing, screenshot of a celebrity, AI art, or object), "faceCount": number of human faces visible, "clearlyAdult": true only if the person clearly looks 18 or older, "nudityOrSexual": true if any nudity, underwear-only or sexual content, "samePersonAsReference": ${reference ? "true if both images show the same person" : "null"}, "lighting": 0-10 (even, soft, frontal light is 10; harsh shadows, backlight or dim is low), "angle": 0-10 (straight-on at eye level is 10), "sharpness": 0-10, "faceVisible": 0-10 (whole face and hairline visible, nothing covering it, no sunglasses), "tips": up to 3 short, friendly fixes for a better photo}`,
        },
        img(photo),
        ...(reference ? [img(reference)] : []),
      ],
    },
  ];
}

export const parseWith =
  <S extends z.ZodType>(schema: S) =>
  (r: AiResult): z.infer<S> =>
    schema.parse(parseJson(r.text));
