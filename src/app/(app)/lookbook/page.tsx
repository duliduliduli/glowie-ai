import Link from "next/link";
import { Heart } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { signedUrl } from "@/lib/storage";
import { liveIds } from "@/lib/photos";
import { AiBadge } from "@/components/ai-badge";
import { vibeLabel } from "@/lib/config";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Lookbook" };

export default async function LookbookPage({ searchParams }: PageProps<"/lookbook">) {
  const user = await requireUser();
  const view = (await searchParams).view === "history" ? "history" : "favorites";
  const [favorites, sessions] = await Promise.all([
    db.look.findMany({ where: { favorite: true, session: { userId: user.id } }, orderBy: { createdAt: "desc" }, include: { session: true } }),
    db.styleSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { looks: { where: { previewId: { not: null } }, take: 1, select: { previewId: true } }, _count: { select: { looks: true } } },
    }),
  ]);

  const alive = await liveIds([...favorites.flatMap((l) => [l.previewId, l.session.selfieId]), ...sessions.flatMap((s) => [s.looks[0]?.previewId, s.selfieId])]);
  const label: Record<string, string> = { analyzing: "in progress", pending: "in progress", previewing: "in progress", failed: "didn't finish" };

  const tile = (href: string, previewId: string | null | undefined, selfieId: string, title: string, sub: string, key: string, fav?: boolean) => (
    <Link key={key} href={href} className="relative aspect-[4/5] overflow-hidden rounded-[24px] bg-muted">
      {previewId && alive.has(previewId) ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={signedUrl(previewId)} alt="" className="size-full object-cover" />
          <AiBadge className="left-3 top-3" />
        </>
      ) : alive.has(selfieId) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={signedUrl(selfieId)} alt="" className="size-full object-cover" />
      ) : (
        <div className="size-full bg-gradient-to-br from-accent-soft to-secondary" />
      )}
      {fav ? <Heart className="absolute right-3 top-3 size-5 fill-white text-white drop-shadow" aria-hidden /> : null}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-10 text-white">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="truncate text-xs text-white/75">{sub}</p>
      </div>
    </Link>
  );

  return (
    <div>
      <PageHeader title="Lookbook" subtitle="Your saved looks and every session." />
      <nav aria-label="Lookbook view" className="mb-5 flex gap-1 rounded-full bg-card p-1 shadow-sm">
        {(["favorites", "history"] as const).map((v) => (
          <Link
            key={v}
            href={`/lookbook?view=${v}`}
            aria-current={view === v ? "page" : undefined}
            className={cn("flex min-h-11 flex-1 items-center justify-center rounded-full text-sm font-medium", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
          >
            {v === "favorites" ? `Favourites (${favorites.length})` : `History (${sessions.length})`}
          </Link>
        ))}
      </nav>

      {view === "favorites" ? (
        favorites.length ? (
          <div className="grid grid-cols-2 gap-3">
            {favorites.map((l) =>
              tile(`/session/${l.sessionId}`, l.previewId, l.session.selfieId, (l.data as { title: string }).title, vibeLabel(l.session.vibe), l.id, true),
            )}
          </div>
        ) : (
          <Empty text="Tap the heart on any look to save it here." />
        )
      ) : sessions.length ? (
        <div className="grid grid-cols-2 gap-3">
          {sessions.map((s) =>
            tile(
              `/session/${s.id}`,
              s.looks[0]?.previewId,
              s.selfieId,
              vibeLabel(s.vibe),
              `${s.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${s.status === "ready" ? `${s._count.looks} looks` : (label[s.status] ?? s.status)}`,
              s.id,
            ),
          )}
        </div>
      ) : (
        <Empty text="No sessions yet. Start your first look." />
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="space-y-4 rounded-[28px] bg-card p-8 text-center shadow-sm">
      <p className="text-muted-foreground">{text}</p>
      <Button asChild>
        <Link href="/new">Start a look</Link>
      </Button>
    </div>
  );
}
