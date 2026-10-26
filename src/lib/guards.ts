import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { db } from "./db";

const redis = process.env.UPSTASH_REDIS_REST_URL ? Redis.fromEnv() : null;
const limiters = redis
  ? {
      ai: new Ratelimit({ redis, prefix: "rl:ai", limiter: Ratelimit.slidingWindow(20, "1 h") }),
      upload: new Ratelimit({ redis, prefix: "rl:upload", limiter: Ratelimit.slidingWindow(30, "1 h") }),
      checkout: new Ratelimit({ redis, prefix: "rl:checkout", limiter: Ratelimit.slidingWindow(10, "1 h") }),
    }
  : null;

export class GuardError extends Error {
  constructor(message: string, public status = 429) {
    super(message);
  }
}

/** Per-user rate limit. shortcut: no-op without Upstash env (local dev only), set UPSTASH_* in production. */
export async function rateLimit(kind: "ai" | "upload" | "checkout", userId: string) {
  if (!limiters) {
    if (process.env.NODE_ENV === "production") throw new GuardError("Rate limiter not configured", 503);
    return;
  }
  const { success } = await limiters[kind].limit(userId);
  if (!success) throw new GuardError("You're going a little fast. Try again in a few minutes.");
}

/** Global circuit breaker: stop all AI calls once today's provider spend reaches DAILY_SPEND_CAP_USD. */
export async function assertUnderSpendCap() {
  const cap = Number(process.env.DAILY_SPEND_CAP_USD ?? 50);
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { _sum } = await db.aiCall.aggregate({ where: { createdAt: { gte: since } }, _sum: { costUsd: true } });
  if ((_sum.costUsd ?? 0) >= cap) throw new GuardError("Glowie is very busy right now. Please try again later.", 503);
}

const BLOCKED = /\b(nude|naked|topless|nsfw|lingerie|sexy|sexual|erotic|boudoir|undress|see[- ]?through|nipple|porn|fetish|child|kid|teen|minor|younger|celebrity|look(?:s|ing)? like|lookalike|race|ethnicity|skin (?:colou?r|tone)|lighter skin|darker skin|whiten|bleach my skin|blackface)\b/i;

/** Rejects custom prompts asking for sexualised edits, minors, celebrity likeness or identity/race changes. */
export function assertSafePrompt(text: string) {
  if (text.length > 300) throw new GuardError("Keep it under 300 characters.", 400);
  if (BLOCKED.test(text)) throw new GuardError("We can't style that request. Glowie keeps you looking like you.", 400);
}
