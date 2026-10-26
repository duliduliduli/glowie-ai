// Single source of truth for brand, prices, packs, models and vibes. Model IDs verified on OpenRouter 2026-10-26.

export const APP_NAME = "Glowie";
/** Domain TBD: the only place it lives. Used for the share-card watermark and emails. */
export const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "glowie.app";
export const TAGLINE = "Try the look before you book it. No subscription, ever.";

/** Retail value of one credit in USD. */
export const CREDIT_USD = 0.1;
/** Settled price = provider cost x MARKUP. */
export const MARKUP = 3;
/** Estimates are padded so a slightly longer response still fits inside the hold. */
export const ESTIMATE_BUFFER = 1.25;

export const PACKS = [
  { id: "starter", name: "Starter", usdCents: 299, credits: 30 },
  { id: "popular", name: "Popular", usdCents: 999, credits: 110, badge: "+10% bonus" },
  { id: "pro", name: "Pro", usdCents: 1999, credits: 240, badge: "+20% bonus" },
] as const;
export type PackId = (typeof PACKS)[number]["id"];
export const getPack = (id: string) => PACKS.find((p) => p.id === id);

export const REFERRAL_CREDITS = 20; // $2 each way, after the friend's first purchase
export const NEW_ACCOUNT_DAYS = 7;
export const NEW_ACCOUNT_FIRST_PURCHASE_MAX_CENTS = 2000;
export const NEW_ACCOUNT_WEEK_MAX_CENTS = 5000;

/** Free trial: 1 analysis (+3 looks) and 1 real preview. Party voters get 1 extra preview. */
export const TRIAL_FREE_PREVIEWS = 1;
export const PARTY_VOTER_FREE_PREVIEWS = 1;

/** Selfie coach: photos scoring below this are sent back with tips before any credits are spent. */
export const SELFIE_MIN_SCORE = 55;

type Usage = { promptTokens: number; completionTokens: number; imageInputs: number; imageOutputTokens: number };

export const MODELS = {
  analysis: {
    models: ["google/gemini-4-argon", "openai/gpt-5.4-mini"],
    maxTokens: 1800,
    usage: { promptTokens: 2500, completionTokens: 1800, imageInputs: 1, imageOutputTokens: 0 },
  },
  looks: {
    models: ["google/gemini-4-argon", "openai/gpt-5.4-mini"],
    maxTokens: 6000,
    usage: { promptTokens: 4000, completionTokens: 6000, imageInputs: 0, imageOutputTokens: 0 },
  },
  roast: {
    models: ["google/gemini-4-argon", "openai/gpt-5.4-mini"],
    maxTokens: 1500,
    usage: { promptTokens: 2000, completionTokens: 1500, imageInputs: 1, imageOutputTokens: 0 },
  },
  image: {
    // Nano Banana 2, then Seedream 5.0 Flash. Seedream bills fewer $ per image, so NB2 sets the hold.
    models: ["google/gemini-3.1-flash-image", "bytedance-seed/seedream-5-0-flash"],
    maxTokens: 1500,
    usage: { promptTokens: 3000, completionTokens: 500, imageInputs: 1, imageOutputTokens: 1300 },
  },
  moderation: {
    models: ["google/gemini-3.5-flash-lite", "openai/gpt-5.4-mini"],
    maxTokens: 500,
    usage: { promptTokens: 3000, completionTokens: 500, imageInputs: 2, imageOutputTokens: 0 },
  },
} satisfies Record<string, { models: string[]; maxTokens: number; usage: Usage }>;
export type ModelRole = keyof typeof MODELS;

/** Image-only models must be asked for modalities ["image"]; the rest return image + text. */
export const IMAGE_ONLY_MODELS = ["bytedance-seed/seedream-5-0-flash"];

/** 3-second image-to-video on OpenRouter's video API. Both cost under $0.17 so 3x markup fits the 5-credit price. */
export const VIDEO = {
  credits: 5,
  seconds: 3,
  models: [
    { id: "x-ai/grok-imagine-video-1.5-lite", resolution: "720p" }, // ~$0.10 per 3s clip
    { id: "alibaba/wan-3.0", resolution: "480p" }, // ~$0.15 per 3s clip
  ],
};

export const VIBES = [
  { id: "date-night", label: "Date Night" },
  { id: "wedding-guest", label: "Wedding Guest" },
  { id: "clean-girl", label: "Clean Girl" },
  { id: "old-money", label: "Old Money" },
  { id: "custom", label: "Custom" },
] as const;
/** Event mode is a session type, not a vibe in the picker. */
export const EVENT_VIBE = "event";
export const vibeLabel = (id: string) => (id === EVENT_VIBE ? "Event" : (VIBES.find((v) => v.id === id)?.label ?? id));

export const BUDGET_TIERS = [50, 200, 800] as const;

export const PHOTO_RETENTION_DAYS = 30;
