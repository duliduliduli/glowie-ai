import { apiUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { makePreview } from "@/lib/flows";
import { GuardError } from "@/lib/guards";
import { signedUrl } from "@/lib/storage";

export const maxDuration = 180;

export async function POST(_req: Request, ctx: RouteContext<"/api/looks/[id]/preview">) {
  return handle(async () => {
    const user = await apiUser();
    if (!user) throw new GuardError("Sign in first", 401);
    const { id } = await ctx.params;
    const { photoId, charged } = await makePreview(user.id, id);
    return { url: signedUrl(photoId), charged };
  });
}
