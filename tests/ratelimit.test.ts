import { describe, expect, it, vi } from "vitest";

// The real limiter lets requests through when Redis times out; we must not.
vi.mock("@upstash/redis", () => ({ Redis: { fromEnv: () => ({}) } }));
vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static slidingWindow() {
      return {};
    }
    async limit(key: string) {
      return key === "slow" ? { success: true, reason: "timeout" } : key === "over" ? { success: false } : { success: true };
    }
  }
  return { Ratelimit };
});

describe("rate limiter", () => {
  it("fails closed on a Redis timeout, blocks over-limit users, lets normal users through", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.test");
    const { rateLimit } = await import("@/lib/guards");
    await expect(rateLimit("ai", "ok")).resolves.toBeUndefined();
    await expect(rateLimit("ai", "slow")).rejects.toMatchObject({ status: 503 });
    await expect(rateLimit("ai", "over")).rejects.toMatchObject({ status: 429 });
    vi.unstubAllEnvs();
  });
});
