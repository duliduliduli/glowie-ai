import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CloudSun, Luggage } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { stale } from "@/lib/flows";
import { db } from "@/lib/db";
import { signedUrl } from "@/lib/storage";
import { estimateCredits } from "@/lib/openrouter";
import { VIDEO, vibeLabel } from "@/lib/config";
import { LookSchema, type Analysis, type EventPlan } from "@/lib/ai";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Disclaimer } from "@/components/disclaimer";
import { LookCard } from "./look-card";
import { PartyCard } from "./party-card";
import { AutoRefresh, Poller, RetryButton } from "./status";

export const metadata = { title: "Your looks" };

export default async function SessionPage({ params }: PageProps<"/session/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const s = await db.styleSession.findFirst({ where: { id, userId: user.id }, include: { looks: { orderBy: { index: "asc" } } } });
  if (!s) notFound();
  const [photos, image, parties, links] = await Promise.all([
    db.photo.findMany({ where: { id: { in: [s.selfieId, s.fullBodyId].filter(Boolean) as string[] }, deletedAt: null } }),
    estimateCredits("image"),
    db.party.findMany({ where: { userId: user.id, revokedAt: null, lookAId: { in: s.looks.map((l) => l.id) } }, include: { votes: { select: { choice: true } } } }),
    db.shareLink.findMany({ where: { userId: user.id, kind: "stylist", revokedAt: null, refId: { in: s.looks.map((l) => l.id) } }, select: { refId: true } }),
  ]);
  const shared = new Set(links.map((l) => l.refId));
  const selfie = photos.find((p) => p.id === s.selfieId);
  const base = photos.find((p) => p.id === (s.fullBodyId ?? s.selfieId));
  const analysis = s.analysis as Analysis | null;
  const plan = s.extra as (EventPlan & { event: { description: string; date: string; location: string } }) | null;
  const live = (d: Date) => d > stale();
  const previewing = s.status === "previewing" && live(s.createdAt);
  const busy = previewing || s.looks.some((l) => live(l.updatedAt) && (l.hairStatus === "generating" || l.videoStatus === "generating"));
  const previewBlocked = !base ? "Your original photo was deleted, so new previews aren't possible." : !selfie?.fromCamera ? "Previews need a live camera selfie. Start a new look with the camera." : null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="space-y-6">
      <section className="relative -mx-4 overflow-hidden rounded-b-[36px] bg-muted">
        {selfie ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={signedUrl(selfie.id)} alt="Your selfie" className="aspect-square w-full object-cover" />
        ) : (
          <div className="aspect-[4/3] bg-gradient-to-br from-accent-soft to-secondary" />
        )}
        <Button asChild variant="white" size="icon" className="absolute left-4 top-[max(env(safe-area-inset-top),1rem)]" aria-label="Back">
          <Link href="/home"><ChevronLeft /></Link>
        </Button>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/85 to-transparent px-5 pb-5 pt-16">
          <p className="text-sm font-semibold text-accent">{vibeLabel(s.vibe)}</p>
          <h1 className="heading text-2xl">{analysis ? analysis.season : "Your colours"}</h1>
          {analysis ? <p className="text-sm text-muted-foreground">{analysis.undertone} undertone · {analysis.faceShape} face · {analysis.hairType} hair</p> : null}
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
      {busy ? <AutoRefresh /> : null}

      {s.status === "failed" ? (
        <div className="space-y-3 rounded-[28px] bg-card p-5 shadow-sm">
          <h2 className="font-bold">That didn&apos;t work</h2>
          <p className="text-sm text-muted-foreground">The stylist hit a snag. You weren&apos;t charged for anything that failed.</p>
          <RetryButton sessionId={s.id} />
        </div>
      ) : null}

      {plan?.dressCode ? (
        <section className="space-y-3 rounded-[28px] bg-card p-5 shadow-sm">
          <h2 className="heading text-lg">Your event plan</h2>
          <p className="text-sm text-muted-foreground">{plan.event.description} · {plan.event.date} · {plan.event.location}</p>
          <p className="text-sm"><span className="font-semibold">Dress code: </span>{plan.dressCode}</p>
          <p className="flex gap-2 text-sm"><CloudSun className="size-5 shrink-0 text-accent" aria-hidden />{plan.weatherNote}</p>
          <div className="rounded-2xl bg-background p-4">
            <p className="flex items-center gap-2 pb-2 font-semibold"><Luggage className="size-4" aria-hidden /> Packing list</p>
            <ul className="space-y-1.5 text-sm">
              {plan.packingList.map((p) => (
                <li key={p}><label className="flex min-h-8 items-center gap-2"><input type="checkbox" className="size-4 accent-[var(--primary)]" /> {p}</label></li>
              ))}
            </ul>
          </div>
        </section>
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
              {analysis.highlights.map((h) => <li key={h} className="rounded-full bg-accent-soft px-3 py-1.5 text-sm">{h}</li>)}
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
          selfie={selfie ? signedUrl(selfie.id) : null}
          preview={l.previewId ? signedUrl(l.previewId) : null}
          favorite={l.favorite}
          shared={shared.has(l.id)}
          hair={{ status: l.hairStatus === "generating" && !live(l.updatedAt) ? "failed" : l.hairStatus, stages: ((l.hairStages as { label: string; photoId: string }[] | null) ?? []).map((st) => ({ label: st.label, url: signedUrl(st.photoId) })) }}
          video={{ status: l.videoStatus === "generating" && !live(l.updatedAt) ? "failed" : l.videoStatus, url: l.videoId ? signedUrl(l.videoId) : null }}
          prices={{ image, hair: image * 3, video: VIDEO.credits }}
          freePreviews={user.freePreviews}
          previewBlocked={previewBlocked}
          autoPreviewing={previewing && !l.previewId}
          defaultBudget={(s.extra as { event?: { budgetUsd: number } } | null)?.event?.budgetUsd}
        />
      ))}

      {s.status !== "analyzing" && s.looks.length > 1 ? (
        <PartyCard
          looks={s.looks.filter((l) => l.previewId).map((l) => ({ id: l.id, title: LookSchema.parse(l.data).title, image: signedUrl(l.previewId!) }))}
          parties={parties.map((p) => ({ id: p.id, url: `${appUrl}/p/${p.token}`, tally: [0, 1].map((c) => p.votes.filter((v) => v.choice === c).length), titles: [p.lookAId, p.lookBId].map((lid) => LookSchema.parse(s.looks.find((l) => l.id === lid)!.data).title) }))}
        />
      ) : null}
      {s.looks.length ? <Disclaimer /> : null}
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
