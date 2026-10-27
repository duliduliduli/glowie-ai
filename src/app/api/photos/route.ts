import { apiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FREE_PHOTO_CHECKS } from "@/lib/config";
import { handle } from "@/lib/http";
import { uploadPhoto } from "@/lib/flows";
import { GuardError, rateLimit } from "@/lib/guards";
import { getBalance } from "@/lib/ledger";
import { signedUrl } from "@/lib/storage";

export const maxDuration = 60;

export async function POST(req: Request) {
  return handle(async () => {
    const user = await apiUser();
    if (!user) throw new GuardError("Sign in first", 401);
    await rateLimit("upload", user.id);
    // Photo checks are free, but only for people who can actually use them (trial left or credits), and an account that
    // hasn't paid gets a lifetime allowance so throwaway sign-ups can't run free checks forever.
    const trial = !user.trialUsedAt || user.freePreviews > 0;
    const { available } = await getBalance(user.id);
    if (!trial && available < 1) throw new GuardError("Add credits to upload a new photo.", 402);
    if (available < 1) {
      const used = await db.aiCall.count({ where: { userId: user.id, role: "moderation" } });
      if (used >= FREE_PHOTO_CHECKS) throw new GuardError("You've used your free photo checks. Add credits to keep uploading.", 402);
    }
    const form = await req.formData().catch(() => {
      throw new GuardError("That photo is too large or couldn't be read. Try a smaller one.", 413);
    });
    const file = form.get("file");
    const kind = form.get("kind");
    if (!(file instanceof File) || (kind !== "selfie" && kind !== "fullbody" && kind !== "outfit")) throw new GuardError("Invalid upload", 400);
    const { photo, coach } = await uploadPhoto(user.id, file, kind, form.get("fromCamera") === "1");
    return { id: photo.id, url: signedUrl(photo.id), fromCamera: photo.fromCamera, coach };
  });
}
