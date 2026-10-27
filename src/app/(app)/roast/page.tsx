import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { estimateCredits } from "@/lib/openrouter";
import { signedUrl } from "@/lib/storage";
import { RoastSchema } from "@/lib/ai";
import { PageHeader } from "@/components/page-header";
import { RoastFlow } from "./roast-flow";

export const metadata = { title: "Roast my fit" };

export default async function RoastPage() {
  const user = await requireUser();
  const [price, roasts, selfie, links] = await Promise.all([
    estimateCredits("roast"),
    db.roast.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.photo.findFirst({ where: { userId: user.id, kind: "selfie", deletedAt: null } }),
    db.shareLink.findMany({ where: { userId: user.id, kind: "roast", revokedAt: null }, select: { refId: true } }),
  ]);
  const shared = new Set(links.map((l) => l.refId));
  return (
    <div>
      <PageHeader title="Roast my fit" subtitle="Honest score, quick fixes. We roast the outfit, never you." />
      <RoastFlow
        price={price}
        hasSelfie={!!selfie}
        past={roasts.map((r) => ({ id: r.id, image: signedUrl(r.photoId), result: RoastSchema.parse(r.result), shared: shared.has(r.id) }))}
      />
    </div>
  );
}
