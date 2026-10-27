import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

// In-memory Vercel Blob.
const blobs = new Map<string, { bytes: Buffer; contentType: string }>();
vi.mock("@vercel/blob", () => ({
  put: async (path: string, bytes: Buffer, o: { contentType: string }) => {
    const pathname = `${path}-${Math.random().toString(36).slice(2)}`;
    blobs.set(pathname, { bytes, contentType: o.contentType });
    return { pathname };
  },
  get: async (path: string) => {
    const b = blobs.get(path);
    return b ? { statusCode: 200, stream: new Response(new Uint8Array(b.bytes)).body, blob: { contentType: b.contentType } } : null;
  },
  del: async (paths: string[]) => paths.forEach((p) => blobs.delete(p)),
}));

const { db } = await import("@/lib/db");
const { grant, getBalance } = await import("@/lib/ledger");
const { claimTrial } = await import("@/lib/trial");
const { uploadPhoto, processSession, makePreview, roastFit } = await import("@/lib/flows");
const { assertSafeByModel, runAi, LooksSchema, RoastSchema, looksMessages, roastMessages, parseWith } = await import("@/lib/ai");
const look0 = () => look(0);
const roastMsgs = () => roastMessages("data:image/jpeg;base64,AAAA");
const { AccountFrozenError } = await import("@/lib/ledger");
const { GuardError } = await import("@/lib/guards");

const RUN = Date.now().toString(36);
const color = (name: string) => ({ name, hex: "#aabbcc" });
const look = (i: number) => ({
  title: `Look ${i}`,
  summary: "s",
  whyItSuits: "w",
  outfit: [
    { piece: "Coat", description: "d", color: "camel", searchQuery: "camel coat", budgetShare: 0.6 },
    { piece: "Boots", description: "d", color: "black", searchQuery: "black boots", budgetShare: 0.4 },
  ],
  hair: {
    style: "Long layers",
    steps: ["a", "b"],
    products: [],
    stylistNote: "n",
    salon: { level: "Level 6", tone: "warm", technique: "babylights", cut: "long layers" },
    growOut: { week1: "a", month3: "b", month6: "c" },
    maintenance: { salonVisitsPerYear: 4, costPerVisitUsd: [120, 200], salonHours: 2, dailyMinutes: 10 },
  },
  makeup: { look: "soft", steps: ["a", "b"], products: [] },
  colorsToWear: [color("a"), color("b")],
  colorsToAvoid: [color("c")],
});

let omitCost = false;
let omitFail = false;
let emptyImages = 0;
let lastBody: Record<string, unknown> = {};
let match: boolean | null | "auto" = "auto";
let photoCheck = { lighting: 9, angle: 9, sharpness: 9, faceVisible: 9 };
const calls: string[] = [];
const tinyJpeg = (await sharp({ create: { width: 8, height: 8, channels: 3, background: "#c97" } }).jpeg().toBuffer()).toString("base64");

// Fake OpenRouter: answers by role, reports a realistic usage.cost.
vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body ?? "{}"));
  const sys = JSON.stringify(body.messages?.[0]?.content ?? "");
  if (omitFail) return new Response("down", { status: 500 });
  const reply = (content: unknown, cost: number, images?: string[]) =>
    Response.json({ model: body.models?.[0], choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content), images } }], usage: omitCost ? {} : { cost } });
  if (!String(url).includes("/chat/completions")) throw new Error(`unexpected fetch ${url}`);
  lastBody = body;
  if (body.modalities) {
    calls.push("image");
    // Provider billed us but returned no image (e.g. a content filter).
    if (emptyImages > 0) {
      emptyImages--;
      return reply("", 0.08, [] as never);
    }
    return reply("", 0.08, [{ image_url: { url: `data:image/jpeg;base64,${tinyJpeg}` } }] as never);
  }
  if (sys.includes("text safety checker")) {
    calls.push("textcheck");
    return reply({ unsafe: /zendaya/i.test(JSON.stringify(body.messages.at(-1).content)) }, 0.0005);
  }
  if (sys.includes("safety checker")) {
    calls.push("check");
    return reply({ realPhoto: true, faceCount: 1, clearlyAdult: true, nudityOrSexual: false, samePersonAsReference: match === "auto" ? ((JSON.stringify(body.messages.at(-1).content).match(/image_url/g) ?? []).length >= 2 ? true : null) : match, tips: ["Face a window"], ...photoCheck }, 0.001);
  }
  if (sys.includes("colour analyst")) {
    calls.push("analysis");
    return reply({ faceShape: "oval", faceShapeNotes: "n", undertone: "warm", hairType: "2B", hairLength: "long", currentStyle: "c", season: "Soft Autumn", seasonNotes: "n", bestColors: [1, 2, 3, 4].map(String).map(color), neutrals: [color("a"), color("b")], avoidColors: [color("a"), color("b")], metals: "gold", highlights: [] }, 0.02);
  }
  if (sys.includes("fashion critic")) {
    calls.push("roast");
    return reply({ score: 7, headline: "h", whatWorks: ["a"], quickFixes: ["b"], verdict: "v" }, 0.02);
  }
  calls.push("looks");
  return reply("```json\n" + JSON.stringify({ looks: [0, 1, 2].map(look) }) + "\n```", 0.05);
});

for (const [model, promptUsd, completionUsd, imageOutputUsd] of [
  ["google/gemini-4-argon", 2e-6, 1e-5, 0], ["openai/gpt-5.4-mini", 7.5e-7, 4.5e-6, 0],
  ["google/gemini-3.1-flash-image", 5e-7, 3e-6, 6e-5], ["bytedance-seed/seedream-5-0-flash", 0, 0, 4.31e-6],
] as const) {
  const data = { promptUsd, completionUsd, imageInputUsd: 0, imageOutputUsd };
  await db.modelPrice.upsert({ where: { model }, create: { model, ...data }, update: data });
}

let n = 0;
async function newUser() {
  n++;
  return db.user.create({ data: { clerkId: `flow_${RUN}_${n}`, email: `f${n}@x.test`, referralCode: `F${RUN}${n}`, ageConfirmedAt: new Date() } });
}
const file = async () => new File([await sharp({ create: { width: 64, height: 64, channels: 3, background: "#fff" } }).png().toBuffer()], "s.png", { type: "image/png" });

beforeEach(() => {
  omitCost = false;
  omitFail = false;
  emptyImages = 0;
  match = "auto";
  calls.length = 0;
  photoCheck = { lighting: 9, angle: 9, sharpness: 9, faceVisible: 9 };
});

describe("selfie coach", () => {
  it("sends back a dark selfie with tips and stores nothing", async () => {
    const u = await newUser();
    photoCheck = { lighting: 2, angle: 6, sharpness: 6, faceVisible: 4 };
    await expect(uploadPhoto(u.id, await file(), "selfie", true)).rejects.toMatchObject({ extra: { code: "retake", coach: { tips: ["Face a window"] } } });
    expect(await db.photo.count({ where: { userId: u.id } })).toBe(0);
    expect(await getBalance(u.id)).toMatchObject({ total: 0 });
  });

  it("empty and corrupt files are a clean 400, not a crash", async () => {
    const u = await newUser();
    await expect(uploadPhoto(u.id, new File([], "e.jpg", { type: "image/jpeg" }), "selfie", true)).rejects.toMatchObject({ status: 400 });
    await expect(uploadPhoto(u.id, new File([Buffer.from("not an image")], "c.png", { type: "image/png" }), "selfie", true)).rejects.toMatchObject({ status: 400 });
    expect(await db.photo.count({ where: { userId: u.id } })).toBe(0);
  });

  it("requires a selfie before an outfit photo", async () => {
    const u = await newUser();
    await expect(uploadPhoto(u.id, await file(), "outfit", false)).rejects.toThrow(/selfie first/);
  });
});

describe("same-person checks fail closed", () => {
  it("a later selfie must match the account's first selfie", async () => {
    const u = await newUser();
    await uploadPhoto(u.id, await file(), "selfie", true);
    match = false;
    await expect(uploadPhoto(u.id, await file(), "selfie", true)).rejects.toThrow(/first selfie/);
    match = true;
    await expect(uploadPhoto(u.id, await file(), "selfie", true)).resolves.toBeTruthy();
  });
  it("an unsure answer (null) is not a match for full-body or outfit photos", async () => {
    const u = await newUser();
    await uploadPhoto(u.id, await file(), "selfie", true);
    match = null;
    await expect(uploadPhoto(u.id, await file(), "fullbody", false)).rejects.toThrow(/first selfie/);
    await expect(uploadPhoto(u.id, await file(), "outfit", false)).rejects.toThrow(/first selfie/);
    expect(await db.photo.count({ where: { userId: u.id } })).toBe(1);
  });
});

describe("full session", () => {
  it("free trial: analysis + looks + exactly one free preview, nothing charged", async () => {
    const u = await newUser();
    await claimTrial(u.id, `dev_${RUN}`, `+1555${Date.now() % 1e7}`);
    const { photo } = await uploadPhoto(u.id, await file(), "selfie", true);
    const s = await db.styleSession.create({ data: { userId: u.id, selfieId: photo.id, vibe: "date-night", quiz: {}, status: "analyzing", free: true } });
    await processSession(s.id);
    const after = await db.styleSession.findUniqueOrThrow({ where: { id: s.id }, include: { looks: true } });
    expect(after.status).toBe("ready");
    expect(after.looks).toHaveLength(3);
    expect(after.looks.filter((l) => l.previewId)).toHaveLength(1);
    expect(calls.filter((c) => c === "image")).toHaveLength(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).freePreviews).toBe(0);
    expect(await getBalance(u.id)).toMatchObject({ total: 0, held: 0 });
  });

  it("paid session charges cost x3 per step and previews all 3 looks", async () => {
    const u = await newUser();
    await grant(u.id, "admin_adjust", 30, `flow:${u.id}`);
    const { photo } = await uploadPhoto(u.id, await file(), "selfie", true);
    const s = await db.styleSession.create({ data: { userId: u.id, selfieId: photo.id, vibe: "old-money", quiz: {}, status: "analyzing" } });
    await processSession(s.id);
    const looks = await db.look.findMany({ where: { sessionId: s.id } });
    expect(looks.every((l) => l.previewId)).toBe(true);
    // analysis $0.02 -> 1, looks $0.05 -> 2, 3 previews $0.08 -> 3 each.
    expect(await getBalance(u.id)).toMatchObject({ total: 30 - 1 - 2 - 9, held: 0 });
  });

  it("skips (doesn't fail) previews the balance can't cover", async () => {
    const u = await newUser();
    await grant(u.id, "admin_adjust", 7, `flow:${u.id}`);
    const { photo } = await uploadPhoto(u.id, await file(), "selfie", true);
    const s = await db.styleSession.create({ data: { userId: u.id, selfieId: photo.id, vibe: "clean-girl", quiz: {}, status: "analyzing" } });
    await processSession(s.id);
    expect((await db.styleSession.findUniqueOrThrow({ where: { id: s.id } })).status).toBe("ready");
    // 7 - 1 (analysis) - 2 (looks) = 4: one 4-credit hold fits (charged 3), then 1 left and the rest are skipped.
    expect(await db.look.count({ where: { sessionId: s.id, previewId: { not: null } } })).toBe(1);
    expect(await getBalance(u.id)).toMatchObject({ total: 1, held: 0 });
  });

  it("uploaded (non-camera) selfies get looks but no previews", async () => {
    const u = await newUser();
    await grant(u.id, "admin_adjust", 30, `flow:${u.id}`);
    const { photo } = await uploadPhoto(u.id, await file(), "selfie", false);
    const s = await db.styleSession.create({ data: { userId: u.id, selfieId: photo.id, vibe: "clean-girl", quiz: {}, status: "analyzing" } });
    await processSession(s.id);
    expect(calls).not.toContain("image");
    const [l] = await db.look.findMany({ where: { sessionId: s.id } });
    await expect(makePreview(u.id, l.id)).rejects.toThrow(/live camera selfie/);
  });
});

describe("roast my fit", () => {
  it("roasts an outfit photo that matches the selfie and charges for it", async () => {
    const u = await newUser();
    await grant(u.id, "admin_adjust", 5, `flow:${u.id}`);
    await uploadPhoto(u.id, await file(), "selfie", true);
    const { photo } = await uploadPhoto(u.id, await file(), "outfit", false);
    const { charged } = await roastFit(u.id, photo.id);
    expect(charged).toBe(1);
    expect(await db.roast.count({ where: { userId: u.id } })).toBe(1);
  });
});

describe("runAi guards", () => {
  const msgs = () => looksMessages({ season: "x" } as never, "date-night", {}, null);
  it("a frozen account can't use any AI call, free ones included", async () => {
    const u = await newUser();
    await db.user.update({ where: { id: u.id }, data: { frozenAt: new Date() } });
    await expect(runAi({ userId: u.id, role: "moderation", reason: "x", free: true }, msgs(), (r) => r)).rejects.toBeInstanceOf(AccountFrozenError);
  });

  it("after 6 failed calls in an hour the user is paused (failed calls cost us, not them)", async () => {
    const u = await newUser();
    await grant(u.id, "admin_adjust", 20, `flow:${u.id}`);
    await db.aiCall.createMany({ data: Array.from({ length: 6 }, () => ({ userId: u.id, role: "looks", status: "failed", costUsd: 0.05 })) });
    await expect(runAi({ userId: u.id, role: "looks", reason: "x" }, msgs(), parseWith(LooksSchema))).rejects.toBeInstanceOf(GuardError);
    expect(calls).not.toContain("looks");
  });

  it("a malformed model reply is not charged, and is recorded as a failure", async () => {
    const u = await newUser();
    await grant(u.id, "admin_adjust", 20, `flow:${u.id}`);
    // The fake answers with 3 looks, which is not a valid roast: the provider is paid, the user is not.
    await expect(runAi({ userId: u.id, role: "roast", reason: "x" }, msgs(), parseWith(RoastSchema))).rejects.toThrow();
    expect(await getBalance(u.id)).toMatchObject({ total: 20, held: 0 });
    expect(await db.aiCall.count({ where: { userId: u.id, status: "failed" } })).toBe(1);
  });

  it("if the provider omits the cost, the whole hold is charged instead of nothing", async () => {
    const u = await newUser();
    await grant(u.id, "admin_adjust", 20, `flow:${u.id}`);
    omitCost = true;
    const { charged } = await runAi({ userId: u.id, role: "looks", reason: "x" }, msgs(), parseWith(LooksSchema));
    expect(charged).toBe(3);
  });
});

describe("model-based request check", () => {
  it("blocks a celebrity request the word list can't see, and lets a normal one through", async () => {
    const u = await newUser();
    await expect(assertSafeByModel(u.id, "give me an outfit as Zendaya")).rejects.toBeInstanceOf(GuardError);
    await expect(assertSafeByModel(u.id, "Parisian café in autumn")).resolves.toBeUndefined();
    expect(await getBalance(u.id)).toMatchObject({ total: 0 });
  });
  it("fails closed when the checker is down", async () => {
    const u = await newUser();
    omitFail = true;
    await expect(assertSafeByModel(u.id, "cozy cabin weekend")).rejects.toMatchObject({ status: 503 });
  });
});

describe("provider cost accounting", () => {
  it("a billed-but-empty image is counted toward the spend cap, but the user pays only for the image they got", async () => {
    const u = await newUser();
    await grant(u.id, "admin_adjust", 30, `flow:${u.id}`);
    const { photo } = await uploadPhoto(u.id, await file(), "selfie", true);
    const s = await db.styleSession.create({ data: { userId: u.id, selfieId: photo.id, vibe: "old-money", quiz: {}, status: "ready" } });
    const look = await db.look.create({ data: { sessionId: s.id, index: 0, data: look0() } });
    emptyImages = 1;
    const { charged } = await makePreview(u.id, look.id);
    expect(charged).toBe(3); // one good image at $0.08 x3
    const row = await db.aiCall.findFirstOrThrow({ where: { userId: u.id, role: "image" } });
    expect(row.costUsd).toBeCloseTo(0.16); // the wasted $0.08 is still our spend
  });

  it("requests carry a price ceiling from the cached prices so a pricier provider can't be used", async () => {
    const u = await newUser();
    await grant(u.id, "admin_adjust", 20, `flow:${u.id}`);
    await runAi({ userId: u.id, role: "roast", reason: "x" }, roastMsgs(), parseWith(RoastSchema));
    const p = lastBody.provider as { data_collection: string; max_price?: { prompt: number; completion: number } };
    expect(p.data_collection).toBe("deny");
    // worst listed price across google/gemini-4-argon and openai/gpt-5.4-mini, x1.5, in $ per million tokens
    expect(p.max_price?.completion).toBeCloseTo(15);
    expect(p.max_price?.prompt).toBeCloseTo(3);
  });
});
