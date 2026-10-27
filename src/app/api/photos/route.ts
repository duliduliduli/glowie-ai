import { apiUser } from "@/lib/auth";
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
    // Photo checks are free, but only for people who can actually use them (trial left or credits).
    const trial = !user.trialUsedAt || user.freePreviews > 0;
    if (!trial && (await getBalance(user.id)).available < 1) throw new GuardError("Add credits to upload a new photo.", 402);
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
