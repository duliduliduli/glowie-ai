import { apiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { photoData, storyCard } from "@/lib/cards";
import { vibeLabel } from "@/lib/config";
import type { Look } from "@/lib/ai";

export const maxDuration = 60;

/** 9:16 before/after story image for Instagram/TikTok. Owner only. */
export async function GET(_req: Request, ctx: RouteContext<"/api/share/[lookId]">) {
  const user = await apiUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { lookId } = await ctx.params;
  const look = await db.look.findFirst({ where: { id: lookId, session: { userId: user.id } }, include: { session: true } });
  if (!look?.previewId) return new Response("Generate a preview first", { status: 404 });
  const [before, after] = await Promise.all([photoData(look.session.fullBodyId ?? look.session.selfieId), photoData(look.previewId)]);
  if (!after) return new Response("Preview not found", { status: 404 });
  return storyCard({ kicker: vibeLabel(look.session.vibe), title: (look.data as Look).title, before, after });
}
