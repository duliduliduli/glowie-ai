import { db } from "@/lib/db";
import { readImage, verifySignature } from "@/lib/storage";

/** Serves a private photo only with a valid, unexpired signature. */
export async function GET(req: Request, ctx: RouteContext<"/api/img/[id]">) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  if (!verifySignature(id, url.searchParams.get("exp"), url.searchParams.get("sig"))) return new Response("Forbidden", { status: 403 });
  const photo = await db.photo.findUnique({ where: { id } });
  if (!photo || photo.deletedAt) return new Response("Not found", { status: 404 });
  const { bytes, contentType } = await readImage(photo.blobPath);
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=3600" } });
}
