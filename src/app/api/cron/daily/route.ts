import { db } from "@/lib/db";
import { releaseStaleHolds } from "@/lib/ledger";
import { openRouterBalance, syncModelPrices } from "@/lib/openrouter";
import { deleteImages } from "@/lib/storage";
import { sendEmail } from "@/lib/email";
import { PHOTO_RETENTION_DAYS } from "@/lib/config";

export const maxDuration = 300;

async function deleteExpiredOriginals() {
  const cutoff = new Date(Date.now() - PHOTO_RETENTION_DAYS * 86_400_000);
  let deleted = 0;
  for (;;) {
    const batch = await db.photo.findMany({
      where: { kind: { in: ["selfie", "fullbody", "outfit"] }, deletedAt: null, createdAt: { lt: cutoff } },
      select: { id: true, blobPath: true },
      take: 500,
    });
    if (!batch.length) return deleted;
    await deleteImages(batch.map((p) => p.blobPath));
    await db.photo.updateMany({ where: { id: { in: batch.map((p) => p.id) } }, data: { deletedAt: new Date() } });
    deleted += batch.length;
  }
}

async function checkOpenRouterBalance() {
  const balance = await openRouterBalance();
  const threshold = Number(process.env.OPENROUTER_ALERT_THRESHOLD_USD ?? 20);
  if (balance < threshold && process.env.ALERT_EMAIL) {
    await sendEmail(
      process.env.ALERT_EMAIL,
      `Glowie: OpenRouter balance low ($${balance.toFixed(2)})`,
      `Your OpenRouter balance is $${balance.toFixed(2)}, below the $${threshold} alert threshold. Top up at https://openrouter.ai/settings/credits so AI calls keep working.`,
    );
  }
  return { balance, alerted: balance < threshold };
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const steps = { prices: syncModelPrices, staleHolds: releaseStaleHolds, expiredPhotos: deleteExpiredOriginals, openRouter: checkOpenRouterBalance };
  const summary: Record<string, unknown> = {};
  for (const [name, run] of Object.entries(steps)) {
    try {
      summary[name] = await run();
    } catch (e) {
      console.error(`[cron] ${name} failed`, e);
      summary[name] = { error: String(e) };
    }
  }
  return Response.json(summary);
}
