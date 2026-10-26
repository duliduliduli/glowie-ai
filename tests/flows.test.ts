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

let photoCheck = { lighting: 9, angle: 9, sharpness: 9, faceVisible: 9 };
const calls: string[] = [];
const tinyJpeg = (await sharp({ create: { width: 8, height: 8, channels: 3, background: "#c97" } }).jpeg().toBuffer()).toString("base64");

// Fake OpenRouter: answers by role, reports a realistic usage.cost.
vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body ?? "{}"));
  const sys = JSON.stringify(body.messages?.[0]?.content ?? "");
  const reply = (content: unknown, cost: number, images?: string[]) =>
    Response.json({ model: body.models?.[0], choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content), images } }], usage: { cost } });
  if (!String(url).includes("/chat/completions")) throw new Error(`unexpected fetch ${url}`);
  if (body.modalities) {
    calls.push("image");
    return reply("", 0.08, [{ image_url: { url: `data:image/jpeg;base64,${tinyJpeg}` } }] as never);
  }
  if (sys.includes("safety checker")) {
    calls.push("check");
    return reply({ realPhoto: true, faceCount: 1, clearlyAdult: true, nudityOrSexual: false, samePersonAsReference: null, tips: ["Face a window"], ...photoCheck }, 0.001);
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

let n = 0;
async function newUser() {
  n++;
  return db.user.create({ data: { clerkId: `flow_${RUN}_${n}`, email: `f${n}@x.test`, referralCode: `F${RUN}${n}`, ageConfirmedAt: new Date() } });
}
const file = async () => new File([await sharp({ create: { width: 64, height: 64, channels: 3, background: "#fff" } }).png().toBuffer()], "s.png", { type: "image/png" });

beforeEach(() => {
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

  it("requires a selfie before an outfit photo", async () => {
    const u = await newUser();
    await expect(uploadPhoto(u.id, await file(), "outfit", false)).rejects.toThrow(/selfie first/);
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
