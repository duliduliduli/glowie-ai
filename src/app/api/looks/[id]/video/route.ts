import { after } from "next/server";
import { apiUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { startVideo } from "@/lib/flows";
import { GuardError } from "@/lib/guards";

export const maxDuration = 300;

export async function POST(req: Request, ctx: RouteContext<"/api/looks/[id]/video">) {
  return handle(async () => {
    const user = await apiUser();
    if (!user) throw new GuardError("Sign in first", 401);
    const job = await startVideo(user.id, (await ctx.params).id, process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin);
    after(job);
    return { started: true };
  });
}
