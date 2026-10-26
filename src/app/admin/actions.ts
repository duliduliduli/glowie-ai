"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { clawback, grant } from "@/lib/ledger";

export type AdminState = { message: string; ok: boolean } | null;

export async function adjustCredits(_: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const amount = Number(form.get("amount"));
  const note = String(form.get("note") ?? "").slice(0, 200) || `Admin adjust by ${admin.email}`;
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 10_000) {
    return { ok: false, message: "Amount must be a non-zero whole number up to 10,000." };
  }
  const user = await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (!user) return { ok: false, message: `No user with email ${email}.` };
  const key = `admin:${crypto.randomUUID()}`;
  if (amount > 0) {
    await grant(user.id, "admin_adjust", amount, key, { note });
    revalidatePath("/admin");
    return { ok: true, message: `Granted ${amount} credits to ${email}.` };
  }
  // clawback never takes the balance below active holds.
  const removed = await clawback(user.id, "admin_adjust", -amount, key, note);
  revalidatePath("/admin");
  return { ok: true, message: `Removed ${removed} credits from ${email}.` };
}

export async function unfreeze(form: FormData) {
  await requireAdmin();
  const userId = String(form.get("userId") ?? "");
  if (!userId) return;
  await db.user.update({ where: { id: userId }, data: { frozenAt: null, purchasesBlocked: false } });
  revalidatePath("/admin");
}
