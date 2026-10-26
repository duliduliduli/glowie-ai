// Single source of truth for prices, packs, models and vibes. Model IDs verified on OpenRouter 2026-10-26.

export const APP_NAME = "Glowie";
export const SHARE_WATERMARK = process.env.NEXT_PUBLIC_SHARE_WATERMARK ?? "glowupai.app";

/** Retail value of one credit in USD. */
export const CREDIT_USD = 0.1;
/** Settled price = provider cost x MARKUP. */
export const MARKUP = 3;
/** Estimates are padded so a slightly longer response still fits inside the hold. */
export const ESTIMATE_BUFFER = 1.25;

export const PACKS = [
  { id: "starter", name: "Starter", usdCents: 499, credits: 50 },
  { id: "popular", name: "Popular", usdCents: 999, credits: 110, badge: "+10% bonus" },
  { id: "pro", name: "Pro", usdCents: 1999, credits: 240, badge: "+20% bonus" },
] as const;
export type PackId = (typeof PACKS)[number]["id"];
export const getPack = (id: string) => PACKS.find((p) => p.id === id);

export const REFERRAL_CREDITS = 20; // $2 each way
export const NEW_ACCOUNT_DAYS = 7;
export const NEW_ACCOUNT_FIRST_PURCHASE_MAX_CENTS = 2000;
export const NEW_ACCOUNT_WEEK_MAX_CENTS = 5000;

type Usage = { promptTokens: number; completionTokens: number; imageInputs: number; imageOutputTokens: number };

export const MODELS = {
  analysis: {
    models: ["google/gemini-4-argon", "openai/gpt-5.4-mini"],
    maxTokens: 1800,
    usage: { promptTokens: 2500, completionTokens: 1800, imageInputs: 1, imageOutputTokens: 0 },
  },
  looks: {
    models: ["google/gemini-4-argon", "openai/gpt-5.4-mini"],
    maxTokens: 4500,
    usage: { promptTokens: 4000, completionTokens: 4500, imageInputs: 0, imageOutputTokens: 0 },
  },
  image: {
    models: ["google/gemini-nano-banana-2.1", "google/gemini-2.5-flash-image"],
    maxTokens: 1500,
    usage: { promptTokens: 3000, completionTokens: 500, imageInputs: 2, imageOutputTokens: 1300 },
  },
  moderation: {
    models: ["google/gemini-3.5-flash-lite", "openai/gpt-5.4-mini"],
    maxTokens: 400,
    usage: { promptTokens: 3000, completionTokens: 400, imageInputs: 2, imageOutputTokens: 0 },
  },
} satisfies Record<string, { models: string[]; maxTokens: number; usage: Usage }>;
export type ModelRole = keyof typeof MODELS;

export const VIBES = [
  { id: "clean-girl", label: "Clean Girl" },
  { id: "old-money", label: "Old Money" },
  { id: "streetwear", label: "Streetwear" },
  { id: "date-night", label: "Date Night" },
  { id: "office-chic", label: "Office Chic" },
  { id: "soft-glam", label: "Soft Glam" },
  { id: "edgy", label: "Edgy" },
  { id: "boho", label: "Boho" },
  { id: "wedding-guest", label: "Wedding Guest" },
  { id: "custom", label: "Custom" },
] as const;
export const vibeLabel = (id: string) => VIBES.find((v) => v.id === id)?.label ?? id;

export const PHOTO_RETENTION_DAYS = 30;
