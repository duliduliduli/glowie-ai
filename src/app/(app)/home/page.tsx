import Link from "next/link";
import { ArrowUpRight, Briefcase, Crown, Heart, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBalance } from "@/lib/ledger";
import { signedUrl } from "@/lib/storage";
import { vibeLabel } from "@/lib/config";
import type { Analysis } from "@/lib/ai";
import { Brand } from "@/components/brand";
import { CreditPill } from "@/components/credit-pill";
import { InstallPrompt } from "@/components/install-prompt";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Home" };

const QUICK = [
  { id: "clean-girl", icon: Sparkles, note: "Effortless, glowy, polished" },
  { id: "old-money", icon: Crown, note: "Quiet luxury, timeless" },
  { id: "date-night", icon: Heart, note: "Romantic and confident" },
  { id: "office-chic", icon: Briefcase, note: "Sharp, modern, easy" },
];

export default async function HomePage() {
  const user = await requireUser();
  const [{ available }, sessions] = await Promise.all([
    getBalance(user.id),
    db.styleSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { looks: { where: { previewId: { not: null } }, take: 1, select: { previewId: true } } },
    }),
  ]);
  const latest = sessions.find((s) => s.analysis)?.analysis as Analysis | undefined;
  const trial = !user.trialUsedAt;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between pt-6">
        <Brand subtitle={trial ? "Free analysis ready" : "Your AI stylist"} />
        <CreditPill credits={available} />
      </header>

      <section className="relative overflow-hidden rounded-[28px] bg-card p-5 shadow-sm">
        <p aria-hidden className="pointer-events-none absolute -top-3 left-3 select-none text-[88px] font-extrabold leading-none tracking-tighter text-black/[0.04]">
          GLOWIE
        </p>
        <div className="relative mx-auto my-4 grid aspect-[16/9] place-items-center rounded-3xl bg-gradient-to-br from-accent-soft via-white to-secondary">
          <Sparkles className="size-16 text-accent" aria-hidden />
        </div>
        <div className="relative flex items-end justify-between gap-3">
          <div>
            <h1 className="heading text-2xl">Ready to glow</h1>
            <p className="text-sm text-muted-foreground">{trial ? "Your first analysis is free." : "Selfie, vibe, three looks."}</p>
          </div>
          <Button asChild size="lg">
            <Link href="/new">Start a look</Link>
          </Button>
        </div>
      </section>

      {latest ? (
        <section aria-label="Your profile" className="grid grid-cols-3 divide-x rounded-[28px] bg-card p-4 shadow-sm">
          {[
            ["Season", latest.season],
            ["Undertone", latest.undertone],
            ["Face", latest.faceShape],
          ].map(([k, v]) => (
            <div key={k} className="px-3">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="truncate font-semibold capitalize">{v}</p>
            </div>
          ))}
        </section>
      ) : null}

      <InstallPrompt />

      <section>
        <div className="flex items-baseline justify-between pb-3">
          <h2 className="heading text-lg">Quick vibes</h2>
          <span className="text-sm text-muted-foreground">One tap</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {QUICK.map((q, i) => (
            <Link
              key={q.id}
              href={`/new?vibe=${q.id}`}
              className={cn("flex min-h-36 flex-col justify-between rounded-[24px] p-4 shadow-sm transition active:scale-[0.98]", i === 0 ? "bg-primary text-primary-foreground" : "bg-card")}
            >
              <div className="flex items-center gap-3">
                <span className={cn("grid size-11 place-items-center rounded-2xl", i === 0 ? "bg-white/10" : "bg-background")}>
                  <q.icon className="size-5" aria-hidden />
                </span>
                <span className="font-bold leading-tight">{vibeLabel(q.id)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className={cn("truncate text-xs", i === 0 ? "text-white/70" : "text-muted-foreground")}>{q.note}</span>
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", i === 0 ? "bg-white text-foreground" : "")}>
                  <ArrowUpRight className="size-4" aria-hidden />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between pb-3">
          <h2 className="heading text-lg">Recent looks</h2>
          <Link href="/lookbook" className="min-h-11 content-center text-sm font-medium">See all</Link>
        </div>
        {sessions.length ? (
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
            {sessions.map((s) => (
              <Link key={s.id} href={`/session/${s.id}`} className="relative aspect-[4/5] w-40 shrink-0 overflow-hidden rounded-[24px] bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={signedUrl(s.looks[0]?.previewId ?? s.selfieId)} alt="" className="size-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 p-3 text-sm font-semibold text-white">{vibeLabel(s.vibe)}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-[24px] bg-card p-5 text-sm text-muted-foreground">Your looks will show up here after your first session.</p>
        )}
      </section>
    </div>
  );
}
