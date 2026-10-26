import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { roastFit } from "@/lib/flows";
import { GuardError } from "@/lib/guards";

export const maxDuration = 120;

export async function POST(req: Request) {
  return handle(async () => {
    const user = await apiUser();
    if (!user) throw new GuardError("Sign in first", 401);
    const { photoId } = z.object({ photoId: z.string() }).parse(await req.json());
    return roastFit(user.id, photoId);
  });
}
