import { after } from "next/server";
import { apiUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { startHairTryOn } from "@/lib/flows";
import { assertUnderSpendCap, GuardError } from "@/lib/guards";

export const maxDuration = 300;

export async function POST(_req: Request, ctx: RouteContext<"/api/looks/[id]/hair">) {
  return handle(async () => {
    const user = await apiUser();
    if (!user) throw new GuardError("Sign in first", 401);
    await assertUnderSpendCap();
    const job = await startHairTryOn(user.id, (await ctx.params).id);
    after(job);
    return { started: true };
  });
}
