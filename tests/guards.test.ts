import { describe, expect, it } from "vitest";
import { assertSafePrompt } from "@/lib/guards";
import { signedUrl, verifySignature } from "@/lib/storage";
import { parseJson, estimateCredits } from "@/lib/openrouter";
import { shopLinks } from "@/lib/shop";
import { LooksSchema } from "@/lib/ai";

describe("custom prompt safety", () => {
  it.each(["make me look like Zendaya", "sexy lingerie shoot", "lighter skin please", "make me younger", "nude beach"])("blocks %s", (p) => {
    expect(() => assertSafePrompt(p)).toThrow();
  });
  it.each(["Parisian café in autumn", "90s minimalism with gold jewellery", "cozy cabin weekend"])("allows %s", (p) => {
    expect(() => assertSafePrompt(p)).not.toThrow();
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
      "google/gemini-nano-banana-2.1": [1.5e-6, 7.5e-6, 0, 3e-5],
      "google/gemini-2.5-flash-image": [3e-7, 2.5e-6, 3e-7, 3e-5],
    };
    for (const [model, [p, c, i, o]] of Object.entries(prices)) {
      const data = { promptUsd: p, completionUsd: c, imageInputUsd: i, imageOutputUsd: o };
      await db.modelPrice.upsert({ where: { model }, create: { model, ...data }, update: data });
    }
    // Worst case across primary + fallback, x3 markup, +25% buffer.
    expect(await estimateCredits("analysis")).toBe(1);
    expect(await estimateCredits("looks")).toBe(2);
    expect(await estimateCredits("image")).toBe(2);
  });
});

describe("shop links", () => {
  it("builds encoded retailer searches", () => {
    const links = shopLinks("camel wrap coat & scarf");
    expect(links.map((l) => l.name)).toEqual(["Amazon", "Nordstrom", "Zara", "Google"]);
    expect(links[0].url).toContain("camel%20wrap%20coat%20%26%20scarf");
  });
});
