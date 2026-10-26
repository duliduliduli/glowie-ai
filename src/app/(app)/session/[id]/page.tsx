import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { signedUrl } from "@/lib/storage";
import { estimateCredits } from "@/lib/openrouter";
import { vibeLabel } from "@/lib/config";
import { LookSchema, type Analysis } from "@/lib/ai";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Disclaimer } from "@/components/disclaimer";
import { LookCard } from "./look-card";
import { Poller, RetryButton } from "./status";

export const metadata = { title: "Your looks" };

export default async function SessionPage({ params }: PageProps<"/session/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const s = await db.styleSession.findFirst({ where: { id, userId: user.id }, include: { looks: { orderBy: { index: "asc" } } } });
  if (!s) notFound();
  const photos = await db.photo.findMany({ where: { id: { in: [s.selfieId, s.fullBodyId].filter(Boolean) as string[] }, deletedAt: null } });
  const selfie = photos.find((p) => p.id === s.selfieId);
  const base = photos.find((p) => p.id === (s.fullBodyId ?? s.selfieId));
  const analysis = s.analysis as Analysis | null;
  const imagePrice = await estimateCredits("image");

  return (
    <div className="space-y-6">
      <section className="relative -mx-4 overflow-hidden rounded-b-[36px] bg-muted">
        {selfie ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={signedUrl(selfie.id)} alt="Your selfie" className="aspect-[4/4] w-full object-cover" />
        ) : (
          <div className="aspect-[4/3] bg-gradient-to-br from-accent-soft to-secondary" />
        )}
        <Button asChild variant="white" size="icon" className="absolute left-4 top-[max(env(safe-area-inset-top),1rem)]" aria-label="Back">
          <Link href="/home"><ChevronLeft /></Link>
        </Button>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/85 to-transparent px-5 pb-5 pt-16">
          <p className="text-sm font-semibold text-accent">{vibeLabel(s.vibe)}</p>
          <h1 className="heading text-2xl">{analysis ? analysis.season : "Your colours"}</h1>
          {analysis ? <p className="text-sm text-muted-foreground">{analysis.undertone} undertone · {analysis.faceShape} face · {analysis.metals} metals</p> : null}
        </div>
      </section>

      {s.status === "analyzing" || s.status === "pending" ? (
        <>
          <Poller />
          <div className="space-y-3">
            <Skeleton className="h-28 rounded-[28px]" />
            <Skeleton className="h-96 rounded-[28px]" />
          </div>
        </>
      ) : null}

      {s.status === "failed" ? (
        <div className="space-y-3 rounded-[28px] bg-card p-5 shadow-sm">
          <h2 className="font-bold">That didn&apos;t work</h2>
          <p className="text-sm text-muted-foreground">The stylist hit a snag. You weren&apos;t charged for anything that failed.</p>
          <RetryButton sessionId={s.id} />
        </div>
      ) : null}

      {analysis ? (
        <section className="space-y-4 rounded-[28px] bg-card p-5 shadow-sm">
          <h2 className="heading text-lg">Your palette</h2>
          <Swatches colors={analysis.bestColors} />
          <div>
            <p className="pb-2 text-xs font-semibold uppercase text-muted-foreground">Neutrals</p>
            <Swatches colors={analysis.neutrals} small />
          </div>
          <div>
            <p className="pb-2 text-xs font-semibold uppercase text-muted-foreground">Go easy on</p>
            <Swatches colors={analysis.avoidColors} small />
          </div>
          <p className="text-sm">{analysis.seasonNotes}</p>
          <div className="rounded-2xl bg-background p-4 text-sm">
            <p className="font-semibold capitalize">{analysis.faceShape} face shape</p>
            <p className="text-muted-foreground">{analysis.faceShapeNotes}</p>
          </div>
          {analysis.highlights.length ? (
            <ul className="flex flex-wrap gap-2">
              {analysis.highlights.map((h) => (
                <li key={h} className="rounded-full bg-accent-soft px-3 py-1.5 text-sm">{h}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {s.looks.map((l) => (
        <LookCard
          key={l.id}
          id={l.id}
          look={LookSchema.parse(l.data)}
          before={base ? signedUrl(base.id) : null}
          preview={l.previewId ? signedUrl(l.previewId) : null}
          favorite={l.favorite}
          imagePrice={imagePrice}
          previewBlocked={!base ? "Your original photo was deleted, so new previews aren't possible." : !selfie?.fromCamera ? "Previews need a live camera selfie. Start a new look with the camera." : null}
        />
      ))}
      {s.status === "ready" ? <Disclaimer /> : null}
    </div>
  );
}

function Swatches({ colors, small }: { colors: { name: string; hex: string }[]; small?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-3">
      {colors.map((c) => (
        <li key={c.hex + c.name} className="flex flex-col items-center gap-1">
          <span className={small ? "size-9 rounded-full border" : "size-12 rounded-2xl border"} style={{ background: c.hex }} />
          <span className="max-w-16 truncate text-[11px] text-muted-foreground">{c.name}</span>
        </li>
      ))}
    </ul>
  );
}
