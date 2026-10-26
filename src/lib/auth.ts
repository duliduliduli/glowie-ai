import "server-only";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";

const code = () => crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();

/** Signed-in DB user, created on first visit. Redirects to sign-in / age gate as needed. */
export async function requireUser({ allowUnconfirmedAge = false } = {}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");
  let user = await db.user.findUnique({ where: { clerkId } });
  if (!user) {
    const cu = await currentUser();
    const ref = (await cookies()).get("ref")?.value;
    const referrer = ref ? await db.user.findUnique({ where: { referralCode: ref } }) : null;
    user = await db.user.upsert({
      where: { clerkId },
      update: {},
      create: {
        clerkId,
        email: cu?.primaryEmailAddress?.emailAddress ?? "",
        referralCode: code(),
        referredById: referrer?.id,
      },
    });
  }
  if (!allowUnconfirmedAge && !user.ageConfirmedAt) redirect("/welcome");
  return user;
}

/** For route handlers: same as requireUser but returns null instead of redirecting. */
export async function apiUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;
  const user = await db.user.findUnique({ where: { clerkId } });
  return user?.ageConfirmedAt ? user : null;
}

/** The user's verified phone number from Clerk, or null. */
export async function verifiedPhone(clerkId: string) {
  const u = await (await clerkClient()).users.getUser(clerkId);
  return u.phoneNumbers.find((p) => p.verification?.status === "verified")?.phoneNumber ?? null;
}

export const isAdmin = (email: string) =>
  (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());

export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdmin(user.email)) redirect("/home");
  return user;
}
