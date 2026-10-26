import { db } from "@/lib/db";
import { photoData, roastCard, stylistCard } from "@/lib/cards";
import { getShareLink } from "@/lib/sharing";
import { LookSchema, RoastSchema } from "@/lib/ai";

/** Public card image for a shared link (stylist handoff or roast). */
export async function GET(_req: Request, ctx: RouteContext<"/c/[token]/image">) {
  const link = await getShareLink((await ctx.params).token);
  if (!link) return new Response("Not found", { status: 404 });
  if (link.kind === "stylist") {
    const look = await db.look.findUnique({ where: { id: link.refId } });
    if (!look) return new Response("Not found", { status: 404 });
    return stylistCard({ image: await photoData(look.previewId), look: LookSchema.parse(look.data) });
  }
  const roast = await db.roast.findUnique({ where: { id: link.refId } });
  if (!roast) return new Response("Not found", { status: 404 });
  return roastCard({ image: await photoData(roast.photoId), roast: RoastSchema.parse(roast.result) });
}
