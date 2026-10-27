import "server-only";
import { db } from "./db";

/** Which of these photo ids still exist (not deleted). Lets pages show a placeholder instead of a broken image. */
export async function liveIds(ids: (string | null | undefined)[]) {
  const want = ids.filter((x): x is string => !!x);
  if (!want.length) return new Set<string>();
  const rows = await db.photo.findMany({ where: { id: { in: want }, deletedAt: null }, select: { id: true } });
  return new Set(rows.map((r) => r.id));
}
