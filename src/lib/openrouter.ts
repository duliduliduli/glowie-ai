import "server-only";
import { db } from "./db";
import { ESTIMATE_BUFFER, MARKUP, CREDIT_USD, MODELS, type ModelRole } from "./config";

const API = "https://openrouter.ai/api/v1";
const headers = () => ({
  Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
  "Content-Type": "application/json",
  "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  "X-Title": "Glowie",
});

export type Content = string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
export type Message = { role: "system" | "user" | "assistant"; content: Content };

export type AiResult = { text: string; images: string[]; costUsd: number; model: string };

export class AiError extends Error {}

async function call(role: ModelRole, messages: Message[], json: boolean): Promise<AiResult> {
  const cfg = MODELS[role];
  const res = await fetch(`${API}/chat/completions`, {
    method: "POST",
    headers: headers(),
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      // OpenRouter tries each model in order when the previous one errors.
      models: cfg.models,
      messages,
      max_tokens: cfg.maxTokens,
      usage: { include: true },
      // Never let providers store or train on user photos.
      provider: { data_collection: "deny" },
      ...(role === "image" ? { modalities: ["image", "text"] } : {}),
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new AiError(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  if (data.error) throw new AiError(`OpenRouter: ${data.error.message ?? "unknown error"}`);
  const msg = data.choices?.[0]?.message;
  const images: string[] = (msg?.images ?? []).map((i: { image_url: { url: string } }) => i.image_url.url);
  const text: string = typeof msg?.content === "string" ? msg.content : "";
  if (role === "image" ? !images.length : !text) throw new AiError("Empty response from model");
  return { text, images, costUsd: Number(data.usage?.cost ?? 0), model: data.model };
}

/** One call with model fallback, retried once on failure. */
export async function complete(role: ModelRole, messages: Message[], { json = false } = {}) {
  try {
    return await call(role, messages, json);
  } catch (e) {
    console.warn(`[openrouter] ${role} failed, retrying once`, e);
    return call(role, messages, json);
  }
}

/** Parses the model's JSON reply, tolerating ```json fences. */
export function parseJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  return JSON.parse(t);
}

const FALLBACK_PRICE = { promptUsd: 5e-6, completionUsd: 3e-5, imageInputUsd: 5e-6, imageOutputUsd: 6e-5 };
const IMAGE_INPUT_TOKENS = 1300;

/** Max credits a call can cost: worst-case price across the role's models x markup, rounded up. Used as the hold. */
export async function estimateCredits(role: ModelRole) {
  const { models, usage } = MODELS[role];
  const prices = await db.modelPrice.findMany({ where: { model: { in: models } } });
  const worst = models
    .map((m) => prices.find((p) => p.model === m) ?? FALLBACK_PRICE)
    .map(
      (p) =>
        usage.promptTokens * p.promptUsd +
        usage.imageInputs * IMAGE_INPUT_TOKENS * (p.imageInputUsd || p.promptUsd) +
        usage.completionTokens * p.completionUsd +
        usage.imageOutputTokens * p.imageOutputUsd,
    )
    .reduce((a, b) => Math.max(a, b), 0);
  return Math.max(1, Math.ceil((worst * ESTIMATE_BUFFER * MARKUP) / CREDIT_USD));
}

/** Daily cron: cache current OpenRouter prices for every configured model. */
export async function syncModelPrices() {
  const res = await fetch(`${API}/models`);
  if (!res.ok) throw new Error(`OpenRouter models ${res.status}`);
  const { data } = (await res.json()) as { data: { id: string; pricing: Record<string, string> }[] };
  const wanted = new Set(Object.values(MODELS).flatMap((m) => m.models));
  const found = data.filter((m) => wanted.has(m.id));
  for (const m of found) {
    const n = (k: string) => Number(m.pricing[k] ?? 0) || 0;
    const price = { promptUsd: n("prompt"), completionUsd: n("completion"), imageInputUsd: n("image"), imageOutputUsd: n("image_output") };
    await db.modelPrice.upsert({ where: { model: m.id }, create: { model: m.id, ...price }, update: price });
  }
  return { updated: found.length, missing: [...wanted].filter((id) => !found.some((m) => m.id === id)) };
}

/** OpenRouter account balance in USD (total purchased - total used). */
export async function openRouterBalance() {
  const res = await fetch(`${API}/credits`, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`OpenRouter credits ${res.status}`);
  const { data } = await res.json();
  return Number(data.total_credits) - Number(data.total_usage);
}
