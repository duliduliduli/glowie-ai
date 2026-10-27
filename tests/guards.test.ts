import { describe, expect, it } from "vitest";
import { assertSafeGenerated, assertSafePrompt, assertUnderSpendCap, GuardError } from "@/lib/guards";
import { signedUrl, verifySignature } from "@/lib/storage";
import { parseJson, estimateCredits } from "@/lib/openrouter";
import { pieceBudget, shopLinks } from "@/lib/shop";
import { coachScore } from "@/lib/ai";
import { LooksSchema } from "@/lib/ai";

describe("custom prompt safety", () => {
  it.each(["make me look like Zendaya", "sexy lingerie shoot", "lighter skin please", "make me younger", "nude beach"])("blocks %s", (p) => {
    expect(() => assertSafePrompt(p)).toThrow();
  });
  it.each(["Parisian café in autumn", "90s minimalism with gold jewellery", "cozy cabin weekend"])("allows %s", (p) => {
    expect(() => assertSafePrompt(p)).not.toThrow();
  });
});

describe("safety filter: bypasses and false positives", () => {
  it.each([
    "n.u.d.e photoshoot", "ｎｕｄｅ", "nu\u200Bde", "resembling Beyonce", "bikini shoot", "underwear only", "shirtless", "make me 14", "make me look like a kid",
    "children's look", "change my race", "paler skin", "make me look more asian", "sexier please", "underage", "undressed", "nudes",
  ])("blocks %s", (p) => {
    expect(() => assertSafePrompt(p)).toThrow();
  });
  it.each([
    "race day at Ascot", "minimal makeup, natural skin tone match", "brunch with my 14 cousins", "cozy cabin weekend", "Parisian café in autumn",
    "my sister's wedding in Lagos", "black tie dinner", "white linen dress",
  ])("allows %s", (p) => {
    expect(() => assertSafePrompt(p)).not.toThrow();
  });
  it("empty and missing text is fine, very long text is not", () => {
    expect(() => assertSafePrompt(undefined)).not.toThrow();
    expect(() => assertSafePrompt("x".repeat(301))).toThrow();
  });
  it("generated look text: blocks sexual or minor terms, allows normal styling words", () => {
    expect(() => assertSafeGenerated("Bouncy blowout", "soft glam", "silk slip dress berry")).not.toThrow();
    expect(() => assertSafeGenerated("matches your skin tone", "kid leather gloves", "race day hat")).not.toThrow();
    expect(() => assertSafeGenerated("Long layers", "lingerie set")).toThrow();
    expect(() => assertSafeGenerated("nude lip, sheer bra")).toThrow();
    expect(() => assertSafeGenerated("look for a teen")).toThrow();
  });
});

describe("signed image URLs", () => {
  it("verifies its own signature and rejects tampering or expiry", () => {
    const u = new URL(signedUrl("photo1"), "http://x");
    const exp = u.searchParams.get("exp");
    const sig = u.searchParams.get("sig");
    expect(verifySignature("photo1", exp, sig)).toBe(true);
    expect(verifySignature("photo2", exp, sig)).toBe(false);
    expect(verifySignature("photo1", String(Number(exp) + 1), sig)).toBe(false);
    expect(verifySignature("photo1", "1", sig)).toBe(false);
    expect(verifySignature("photo1", exp, null)).toBe(false);
  });
});

describe("model output parsing", () => {
  it("strips code fences", () => {
    expect(parseJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("rejects looks without exactly 3 looks", () => {
    expect(() => LooksSchema.parse({ looks: [] })).toThrow();
  });
});

describe("pricing", () => {
  it("estimates match the advertised prices with seeded OpenRouter prices", async () => {
    const { db } = await import("@/lib/db");
    const prices = {
      "google/gemini-4-argon": [2e-6, 1e-5, 2e-6, 0],
      "openai/gpt-5.4-mini": [7.5e-7, 4.5e-6, 0, 0],
      "google/gemini-3.1-flash-image": [5e-7, 3e-6, 0, 6e-5],
      "bytedance-seed/seedream-5-0-flash": [0, 0, 0, 4.31e-6],
    };
    for (const [model, [p, c, i, o]] of Object.entries(prices)) {
      const data = { promptUsd: p, completionUsd: c, imageInputUsd: i, imageOutputUsd: o };
      await db.modelPrice.upsert({ where: { model }, create: { model, ...data }, update: data });
    }
    // Worst case across primary + fallback, x3 markup, +25% buffer.
    expect(await estimateCredits("analysis")).toBe(1);
    expect(await estimateCredits("looks")).toBe(3);
    expect(await estimateCredits("roast")).toBe(1);
    // Nano Banana 2 (~$0.08/image) sets the hold; actual charge is usually 3.
    expect(await estimateCredits("image")).toBe(4);
  });
});

describe("shop links", () => {
  it("builds encoded retailer searches", () => {
    const links = shopLinks("camel wrap coat & scarf");
    expect(shopLinks("coat", 50)[0].url).toContain("p_36%3A-5000");
    expect(shopLinks("coat", 800)[3].url).toContain("ppr_max:800");
    expect(links.map((l) => l.name)).toEqual(["Amazon", "Nordstrom", "Zara", "Google"]);
    expect(links[0].url).toContain("camel%20wrap%20coat%20%26%20scarf");
  });
});

describe("budget slider", () => {
  it("splits the outfit budget by share and rounds to $5", () => {
    expect(pieceBudget(200, 0.5, [0.5, 0.3, 0.2])).toBe(100);
    expect(pieceBudget(50, 0.2, [0.5, 0.3, 0.2])).toBe(10);
    expect(pieceBudget(800, 1, [1, 1, 1])).toBe(265); // shares that don't sum to 1 are normalised
  });
});

describe("selfie coach", () => {
  it("scores 0-100 weighting light and face visibility", () => {
    expect(coachScore({ lighting: 10, faceVisible: 10, angle: 10, sharpness: 10 })).toBe(100);
    expect(coachScore({ lighting: 3, faceVisible: 8, angle: 8, sharpness: 8 })).toBe(65);
    expect(coachScore({ lighting: 2, faceVisible: 3, angle: 9, sharpness: 9 })).toBeLessThan(55);
  });
});

describe("daily spend circuit breaker", () => {
  it("stops all AI calls with a 503 once today's provider spend reaches the cap, and resumes under it", async () => {
    const { db } = await import("@/lib/db");
    const u = await db.user.create({ data: { clerkId: `cap_${Date.now()}`, email: "cap@x.test", referralCode: `CAP${Date.now()}` } });
    const before = process.env.DAILY_SPEND_CAP_USD;
    try {
      const { _sum } = await db.aiCall.aggregate({ where: { createdAt: { gte: new Date(new Date().setUTCHours(0, 0, 0, 0)) } }, _sum: { costUsd: true } });
      const spent = _sum.costUsd ?? 0;
      process.env.DAILY_SPEND_CAP_USD = String(spent + 5);
      await expect(assertUnderSpendCap()).resolves.toBeUndefined();
      await db.aiCall.create({ data: { userId: u.id, role: "image", status: "ok", costUsd: 5.01 } });
      await expect(assertUnderSpendCap()).rejects.toMatchObject({ status: 503 });
      await expect(assertUnderSpendCap()).rejects.toBeInstanceOf(GuardError);
      process.env.DAILY_SPEND_CAP_USD = String(spent + 50);
      await expect(assertUnderSpendCap()).resolves.toBeUndefined();
    } finally {
      if (before === undefined) delete process.env.DAILY_SPEND_CAP_USD;
      else process.env.DAILY_SPEND_CAP_USD = before;
      await db.aiCall.deleteMany({ where: { userId: u.id } });
    }
  });
});
