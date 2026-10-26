import { ImageResponse } from "next/og";
import { apiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dataUrl } from "@/lib/storage";
import { SHARE_WATERMARK, vibeLabel } from "@/lib/config";
import type { Look } from "@/lib/ai";

export const maxDuration = 60;

/** 9:16 before/after story image for Instagram/TikTok. Owner only. */
export async function GET(_req: Request, ctx: RouteContext<"/api/share/[lookId]">) {
  const user = await apiUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { lookId } = await ctx.params;
  const look = await db.look.findFirst({ where: { id: lookId, session: { userId: user.id } }, include: { session: true } });
  if (!look?.previewId) return new Response("Generate a preview first", { status: 404 });
  const [before, after] = await Promise.all(
    [look.session.fullBodyId ?? look.session.selfieId, look.previewId].map(async (id) => {
      const p = await db.photo.findUnique({ where: { id } });
      return p && !p.deletedAt ? dataUrl(p.blobPath) : null;
    }),
  );
  if (!after) return new Response("Preview not found", { status: 404 });
  const data = look.data as Look;

  const panel = (src: string | null, label: string) => (
    <div style={{ position: "relative", display: "flex", flex: 1, borderRadius: 48, overflow: "hidden", background: "#e7e8ec" }}>
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
      <div style={{ position: "absolute", top: 32, left: 32, padding: "12px 28px", borderRadius: 999, background: "rgba(17,17,20,0.75)", color: "white", fontSize: 34, fontWeight: 700, letterSpacing: 2 }}>
        {label}
      </div>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f2f3f5", padding: 56, gap: 32, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 30, color: "#c56b78", fontWeight: 700, letterSpacing: 4 }}>{vibeLabel(look.session.vibe).toUpperCase()}</div>
          <div style={{ fontSize: 64, fontWeight: 800, color: "#111114", lineHeight: 1.05 }}>{data.title}</div>
        </div>
        {before ? panel(before, "BEFORE") : null}
        {panel(after, "AFTER · AI PREVIEW")}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 34, color: "#111114" }}>
          <div style={{ fontWeight: 800 }}>✦ Glowie</div>
          <div style={{ color: "#6b6e76" }}>{SHARE_WATERMARK}</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920, headers: { "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="glowie-${lookId}.png"` } },
  );
}
