import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { MODELS } from "../src/lib/config";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// Prices per token, verified on OpenRouter 2026-10-26. The daily cron keeps these fresh.
const PRICES: Record<string, { promptUsd: number; completionUsd: number; imageInputUsd?: number; imageOutputUsd?: number }> = {
  "google/gemini-4-argon": { promptUsd: 2e-6, completionUsd: 1e-5, imageInputUsd: 2e-6 },
  "openai/gpt-5.4-mini": { promptUsd: 7.5e-7, completionUsd: 4.5e-6 },
  "google/gemini-3.1-flash-image": { promptUsd: 5e-7, completionUsd: 3e-6, imageOutputUsd: 6e-5 },
  "bytedance-seed/seedream-5-0-flash": { promptUsd: 0, completionUsd: 0, imageOutputUsd: 4.31137724550898e-6 },
  "google/gemini-3.5-flash-lite": { promptUsd: 3e-7, completionUsd: 2.5e-6, imageInputUsd: 3e-7 },
};

async function main() {
  for (const model of new Set(Object.values(MODELS).flatMap((m) => m.models))) {
    const p = PRICES[model];
    if (!p) throw new Error(`No seed price for ${model}; add it to prisma/seed.ts`);
    await db.modelPrice.upsert({ where: { model }, create: { model, ...p }, update: p });
  }
  const user = await db.user.upsert({
    where: { clerkId: "seed_demo" },
    update: {},
    create: { clerkId: "seed_demo", email: "demo@glowie.app", referralCode: "DEMO", ageConfirmedAt: new Date() },
  });
  await db.ledgerEntry.createMany({
    data: [{ userId: user.id, type: "admin_adjust", amount: 50, idempotencyKey: "seed:demo", note: "Seed credits" }],
    skipDuplicates: true,
  });
  console.log("Seeded model prices and demo user");
}

main().finally(() => db.$disconnect());
