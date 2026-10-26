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
  outfit: z.array(z.object({ piece: z.string(), description: z.string(), color: z.string(), searchQuery: z.string() })).min(2).max(7),
  hair: z.object({ style: z.string(), steps: z.array(z.string()).min(2).max(8), products: z.array(z.string()).max(6), stylistNote: z.string() }),
  makeup: z.object({ look: z.string(), steps: z.array(z.string()).min(2).max(10), products: z.array(z.string()).max(8) }),
  colorsToWear: z.array(color).min(2).max(6),
  colorsToAvoid: z.array(color).min(1).max(4),
});
export const LooksSchema = z.object({ looks: z.array(LookSchema).length(3) });
export type Look = z.infer<typeof LookSchema>;

export const ModerationSchema = z.object({
  realPhoto: z.boolean(),
  faceCount: z.number(),
  clearlyAdult: z.boolean(),
  nudityOrSexual: z.boolean(),
  samePersonAsReference: z.boolean().nullable(),
});

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

export function looksMessages(analysis: Analysis, vibe: string, quiz: Quiz, customPrompt?: string | null): Message[] {
  return [
    { role: "system", content: `You are an expert personal stylist, hairstylist and makeup artist. ${SAFETY} Reply with JSON only.` },
    {
      role: "user",
      content: `Client profile: ${JSON.stringify(analysis)}
Vibe: ${vibe === "custom" ? `Custom: "${customPrompt ?? ""}"` : vibeLabel(vibe)}
Occasion: ${quiz.occasion ?? "everyday"}. Budget: ${quiz.budget ?? "mid-range"}. Wants to highlight: ${(quiz.highlight ?? []).join(", ") || "no preference"}.

Create 3 distinct complete looks for this vibe that suit their colouring and face shape. Return JSON {"looks": [3 x {title, summary (1 sentence), whyItSuits (2 sentences referencing their colours/face shape), outfit: [3-6 {piece, description, color, searchQuery (a short shopping search like "camel wool wrap coat women")}], hair: {style, steps (3-6), products (product types, not brands), stylistNote (one sentence to show a hairstylist)}, makeup: {look, steps (4-8), products (product types)}, colorsToWear: [3-5 {name, hex}], colorsToAvoid: [2-3 {name, hex}]}]}`,
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

export function moderationMessages(photo: string, reference?: string): Message[] {
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
          text: `Check the FIRST image${reference ? " and compare it to the SECOND (reference) image" : ""}. Return JSON {"realPhoto": true if it is a real, unedited photo of a real human (not a drawing, screenshot of a celebrity, AI art, or object), "faceCount": number of human faces visible, "clearlyAdult": true only if the person clearly looks 18 or older, "nudityOrSexual": true if any nudity, underwear-only or sexual content, "samePersonAsReference": ${reference ? "true if both images show the same person" : "null"}}`,
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
