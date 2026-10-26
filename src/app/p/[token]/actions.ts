"use server";

import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { castVote, getParty } from "@/lib/sharing";
import { rateLimit } from "@/lib/guards";

/** Anonymous vote: one per device (cookie), rate-limited per IP. */
export async function vote(token: string, choice: 0 | 1) {
  if (choice !== 0 && choice !== 1) return { error: "Invalid vote" };
  const data = await getParty(token);
  if (!data) return { error: "This party has ended." };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  await rateLimit("vote", ip);
  const did = (await cookies()).get("did")?.value;
  if (!did) return { error: "Please enable cookies to vote." };
  const ok = await castVote(data.party.id, choice, createHash("sha256").update(did).digest("hex"));
  revalidatePath(`/p/${token}`);
  return ok ? { ok } : { error: "You already voted." };
}
