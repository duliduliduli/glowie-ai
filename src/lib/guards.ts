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
      vote: new Ratelimit({ redis, prefix: "rl:vote", limiter: Ratelimit.slidingWindow(30, "1 h") }),
    }
  : null;

export class GuardError extends Error {
  constructor(message: string, public status = 429, public extra?: { code?: string; [k: string]: unknown }) {
    super(message);
  }
}

/** Per-user rate limit. shortcut: no-op without Upstash env (local dev only), set UPSTASH_* in production. */
export async function rateLimit(kind: "ai" | "upload" | "checkout" | "vote", key: string) {
  if (!limiters) {
    if (process.env.NODE_ENV === "production") throw new GuardError("Rate limiter not configured", 503);
    return;
  }
  const { success } = await limiters[kind].limit(key);
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

// Best-effort text filter for the requests we pass to the stylist and image models. The models are also instructed to refuse
// these, so this is one layer, not the only one. It normalises first so "n.u.d.e", full-width letters and zero-width characters don't slip past.
const normalise = (t: string) => t.normalize("NFKC").replace(/[\p{M}\u200B-\u200F\u2060\uFEFF]/gu, "").toLowerCase();
const squash = (t: string) => normalise(t).replace(/[^\p{L}]/gu, "");

const BLOCKED_WORDS =
  /\b(nudes?|naked|topless|nsfw|lingerie|sexy|sexier|sexual|erotic|boudoir|undress\w*|see[- ]?through|nipples?|porn\w*|fetish|bikini|underwear|cleavage|shirtless|revealing|children|child|kids?|teens?|teenage\w*|underage|minors?|younger|celebrity|celebrities|look(?:s|ing)? like|lookalike|resembl\w+|blackface)\b/;
const BLOCKED_PHRASES = [
  /\b(change|swap|alter|switch|make)\b.{0,25}\b(my )?(race|ethnicity|skin colou?r|skin tone)\b/,
  /\b(lighter|darker|paler|whiter|browner)[- ](skin|skinned|complexion)\b/,
  /\b(whiten|bleach)\b.{0,15}\bskin\b/,
  /\bmake me (look )?(more )?(asian|black|white|latina|latino|hispanic|indian|arab)\b/,
  /\bmake me (look )?\d{1,2}\b/,
];
// Words that stay blocked even when spaced out or punctuated.
const BLOCKED_SQUASHED = /(nude|naked|nsfw|topless|lingerie|porn|erotic|boudoir|undress|underage|blackface)/;

/** Rejects free text asking for sexualised edits, minors, celebrity likeness or identity/race changes. */
export function assertSafePrompt(text: string | undefined | null) {
  if (!text) return;
  if (text.length > 300) throw new GuardError("Keep it under 300 characters.", 400);
  const t = normalise(text);
  if (BLOCKED_WORDS.test(t) || BLOCKED_PHRASES.some((r) => r.test(t)) || BLOCKED_SQUASHED.test(squash(text))) {
    throw new GuardError("We can't style that request. Glowie keeps you looking like you.", 400);
  }
}

// Used on text the stylist model wrote before it reaches the image model. Narrower than the input filter, because model text
// legitimately says things like "skin tone", "race day" or "kid leather gloves".
const UNSAFE_OUTPUT = /\b(nudes?|naked|topless|nsfw|lingerie|erotic|boudoir|undress\w*|see[- ]?through|nipples?|porn\w*|fetish|bikini|underwear|cleavage|shirtless|children|child|teens?|underage|minors?|celebrity|lookalike)\b/;

export function assertSafeGenerated(...parts: string[]) {
  if (UNSAFE_OUTPUT.test(normalise(parts.join(" ")))) throw new GuardError("That look can't be previewed safely. Try another look or vibe.", 422);
}
