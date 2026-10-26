"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Clapperboard, Clock, Heart, Link2, Loader2, RefreshCw, Scissors, Share2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BeforeAfterSlider } from "@/components/before-after";
import { pieceBudget, shopLinks } from "@/lib/shop";
import { BUDGET_TIERS } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { Look } from "@/lib/ai";
import { shareCard, toggleFavorite } from "../../actions";

type Props = {
  id: string;
  look: Look;
  before: string | null;
  selfie: string | null;
  preview: string | null;
  favorite: boolean;
  hair: { status: string | null; stages: { label: string; url: string }[] };
  video: { status: string | null; url: string | null };
  prices: { image: number; hair: number; video: number };
  freePreviews: number;
  previewBlocked: string | null;
  autoPreviewing: boolean;
  defaultBudget?: number;
};

const TABS = ["Outfit", "Hair", "Makeup", "Colours"] as const;
const GEN_COPY = ["Trying on the outfit...", "Doing your hair...", "Blending the makeup...", "Checking the lighting..."];

async function post(url: string) {
  const res = await fetch(url, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. You weren't charged.");
  return data;
}

/** Shares a URL or file with the system share sheet, falling back to copy / download. */
async function share(data: { url?: string; file?: File; title: string }) {
  if (data.file && navigator.canShare?.({ files: [data.file] })) return navigator.share({ files: [data.file], title: data.title }).catch(() => {});
  if (data.url && navigator.share) return navigator.share({ url: data.url, title: data.title }).catch(() => {});
  if (data.url) return navigator.clipboard.writeText(data.url).then(() => toast.success("Link copied"));
  if (data.file) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(data.file);
    a.download = data.file.name;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

export function LookCard(p: Props) {
  const { id, look } = p;
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Outfit");
  const [fav, setFav] = useState(p.favorite);
  const [busy, setBusy] = useState<string | null>(null);
  const [copy, setCopy] = useState(0);
  const [budget, setBudget] = useState(() => {
    const i = BUDGET_TIERS.findIndex((t) => (p.defaultBudget ?? 200) <= t);
    return i === -1 ? BUDGET_TIERS.length - 1 : i;
  });
  const [, startFav] = useTransition();
  const generating = busy === "preview" || p.autoPreviewing;
  const free = p.freePreviews > 0;

  useEffect(() => {
    if (!generating) return;
    const t = setInterval(() => setCopy((c) => (c + 1) % GEN_COPY.length), 2500);
    return () => clearInterval(t);
  }, [generating]);

  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(what);
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const generate = () =>
    run("preview", async () => {
      const data = await post(`/api/looks/${id}/preview`);
      toast.success(data.charged ? `Preview ready · ${data.charged} credit${data.charged === 1 ? "" : "s"}` : "Preview ready · free");
      router.refresh();
    });
  const startJob = (what: "hair" | "video") =>
    run(what, async () => {
      await post(`/api/looks/${id}/${what}`);
      toast.success(what === "hair" ? "Growing it out... about a minute" : "Animating your look... about a minute");
      router.refresh();
    });
  const shareStory = () =>
    run("story", async () => {
      const res = await fetch(`/api/share/${id}`);
      if (!res.ok) throw new Error(await res.text());
      await share({ file: new File([await res.blob()], `glowie-${id}.png`, { type: "image/png" }), title: look.title });
    });

  const shareStylist = (asImage: boolean) =>
    run("stylist", async () => {
      const url = await shareCard("stylist", id);
      if (!asImage) {
        await share({ url, title: "For my stylist" });
        return;
      }
      const res = await fetch(`${url}/image`);
      await share({ file: new File([await res.blob()], "glowie-stylist-card.png", { type: "image/png" }), title: "For my stylist" });
    });

  const onFav = () => {
    setFav(!fav);
    startFav(async () => {
      const r = await toggleFavorite(id);
      if (r === undefined) setFav(fav);
      else toast.success(r ? "Saved to your lookbook" : "Removed from lookbook");
    });
  };

  const shares = look.outfit.map((o) => o.budgetShare);
  const total = BUDGET_TIERS[budget];

  return (
    <article className="space-y-4 rounded-[28px] bg-card p-4 shadow-sm">
      <div className="relative">
        {p.preview && p.before ? (
          <BeforeAfterSlider before={p.before} after={p.preview} alt={look.title} />
        ) : (
          <div className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-[24px] bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.before ? <img src={p.before} alt="Your photo" className={cn("absolute inset-0 size-full object-cover", generating && "blur-sm")} /> : null}
            {generating ? (
              <div role="status" className="relative flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold">
                <Loader2 className="size-4 animate-spin" aria-hidden /> {GEN_COPY[copy]}
              </div>
            ) : null}
          </div>
        )}
        <Button variant="white" size="icon" className="absolute bottom-3 right-3" aria-label={fav ? "Remove from lookbook" : "Save to lookbook"} aria-pressed={fav} onClick={onFav}>
          <Heart className={cn(fav && "fill-accent text-accent")} />
        </Button>
      </div>

      <div>
        <h2 className="heading text-xl">{look.title}</h2>
        <p className="text-sm text-muted-foreground">{look.summary}</p>
      </div>

      {p.previewBlocked ? (
        <p className="rounded-2xl bg-background p-3 text-xs text-muted-foreground">{p.previewBlocked}</p>
      ) : (
        <div className="flex gap-2">
          <Button className="flex-1" onClick={generate} disabled={!!busy || generating}>
            {p.preview ? <RefreshCw aria-hidden /> : <Wand2 aria-hidden />}
            {p.preview ? "Regenerate" : "See it on me"} · {free ? "free" : `up to ${p.prices.image} cr`}
          </Button>
          {p.preview ? (
            <Button variant="secondary" size="icon" onClick={shareStory} disabled={!!busy} aria-label="Share before and after to Stories">
              {busy === "story" ? <Loader2 className="animate-spin" /> : <Share2 />}
            </Button>
          ) : null}
        </div>
      )}

      {p.preview && !p.previewBlocked ? (
        p.video.status === "ready" && p.video.url ? (
          <VideoClip src={p.video.url} />
        ) : (
          <Button variant="secondary" className="w-full" onClick={() => startJob("video")} disabled={!!busy || p.video.status === "generating"}>
            {p.video.status === "generating" ? <Loader2 className="animate-spin" aria-hidden /> : <Clapperboard aria-hidden />}
            {p.video.status === "generating" ? "Animating..." : `Animate it · 3s video · up to ${p.prices.video} cr`}
          </Button>
        )
      ) : null}
      {p.video.status === "failed" ? <p className="text-xs text-muted-foreground">The video didn&apos;t work. You weren&apos;t charged; try again.</p> : null}

      <p className="text-sm"><span className="font-semibold">Why it suits you: </span>{look.whyItSuits}</p>

      <div role="tablist" aria-label="Look details" className="no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-background p-1">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("min-h-11 flex-1 rounded-full px-3 text-sm font-medium", tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            {t}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="space-y-3">
        {tab === "Outfit" ? (
          <>
            <label className="block rounded-2xl bg-background p-4">
              <span className="flex justify-between text-sm font-semibold">
                <span>Outfit budget</span>
                <span className="tabular-nums">about ${total}</span>
              </span>
              <input type="range" min={0} max={BUDGET_TIERS.length - 1} step={1} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="mt-3 h-11 w-full accent-[var(--primary)]" aria-valuetext={`about $${total}`} />
              <span className="flex justify-between text-xs text-muted-foreground">{BUDGET_TIERS.map((t) => <span key={t}>${t}</span>)}</span>
            </label>
            <ul className="space-y-3">
              {look.outfit.map((o) => {
                const max = pieceBudget(total, o.budgetShare, shares);
                return (
                  <li key={o.piece} className="rounded-2xl bg-background p-4">
                    <p className="font-semibold">{o.piece} <span className="font-normal text-muted-foreground">· {o.color} · ~${max}</span></p>
                    <p className="text-sm text-muted-foreground">{o.description}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {shopLinks(o.searchQuery, max).map((l) => (
                        <a key={l.name} href={l.url} target="_blank" rel="noopener sponsored" className="inline-flex min-h-11 items-center gap-1 rounded-full bg-card px-3 text-sm shadow-sm">
                          {l.name} <ArrowUpRight className="size-3.5" aria-hidden />
                        </a>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
        {tab === "Hair" ? (
          <>
            <Routine title={look.hair.style} steps={look.hair.steps} products={look.hair.products} />
            <RegretSimulator look={look} stages={p.hair.stages} status={p.hair.status} price={p.freePreviews >= 3 ? 0 : p.prices.hair} blocked={!!p.previewBlocked} busy={!!busy} onStart={() => startJob("hair")} />
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary" className="w-full"><Scissors aria-hidden /> Stylist handoff card</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-[28px]">
                <DialogTitle className="heading">For my stylist</DialogTitle>
                <DialogDescription>Salon-ready notes with an AI reference on your own face.</DialogDescription>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.hair.stages[0]?.url ?? p.preview ? <img src={(p.hair.stages[0]?.url ?? p.preview)!} alt="Reference look" className="aspect-[4/5] w-full rounded-2xl object-cover" /> : null}
                <dl className="grid grid-cols-[6rem_1fr] gap-y-1.5 text-sm">
                  {Object.entries(look.hair.salon).map(([k, v]) => (
                    <div key={k} className="contents"><dt className="font-semibold capitalize">{k}</dt><dd>{v}</dd></div>
                  ))}
                </dl>
                <p className="text-sm">{look.hair.stylistNote}</p>
                {p.preview ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => shareStylist(true)} disabled={!!busy}><Share2 aria-hidden /> Image</Button>
                    <Button variant="secondary" onClick={() => shareStylist(false)} disabled={!!busy}><Link2 aria-hidden /> Link</Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Generate the preview first to share this card.</p>
                )}
              </DialogContent>
            </Dialog>
          </>
        ) : null}
        {tab === "Makeup" ? <Routine title={look.makeup.look} steps={look.makeup.steps} products={look.makeup.products} /> : null}
        {tab === "Colours" ? (
          <div className="space-y-3">
            <ColorRow label="Wear" colors={look.colorsToWear} />
            <ColorRow label="Avoid" colors={look.colorsToAvoid} />
          </div>
        ) : null}
      </div>
    </article>
  );
}

function RegretSimulator({ look, stages, status, price, blocked, busy, onStart }: { look: Look; stages: { label: string; url: string }[]; status: string | null; price: number; blocked: boolean; busy: boolean; onStart: () => void }) {
  const m = look.hair.maintenance;
  const yearly = [m.costPerVisitUsd[0] * m.salonVisitsPerYear, m.costPerVisitUsd[1] * m.salonVisitsPerYear].map(Math.round);
  return (
    <div className="space-y-3 rounded-2xl bg-background p-4">
      <p className="font-semibold">Regret simulator</p>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div><dt className="text-muted-foreground">Upkeep / year</dt><dd className="font-semibold">${yearly[0]}–${yearly[1]}</dd></div>
        <div><dt className="text-muted-foreground">Salon visits</dt><dd className="font-semibold">{m.salonVisitsPerYear}×, {m.salonHours}h each</dd></div>
        <div className="col-span-2 flex items-center gap-1.5 text-muted-foreground"><Clock className="size-4" aria-hidden /> {m.dailyMinutes} min daily styling</div>
      </dl>
      {stages.length ? (
        <div className="grid grid-cols-3 gap-2">
          {stages.map((s) => (
            <figure key={s.label} className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt={`AI preview at ${s.label}`} className="aspect-[4/5] w-full rounded-xl object-cover" />
              <figcaption className="text-center text-xs font-semibold">{s.label}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li><b>Week 1:</b> {look.hair.growOut.week1}</li>
          <li><b>Month 3:</b> {look.hair.growOut.month3}</li>
          <li><b>Month 6:</b> {look.hair.growOut.month6}</li>
        </ul>
      )}
      {!blocked && status !== "ready" ? (
        <Button className="w-full" onClick={onStart} disabled={busy || status === "generating"}>
          {status === "generating" ? <><Loader2 className="animate-spin" aria-hidden /> Growing it out...</> : `${status === "failed" ? "Retry" : "See it grow out on me"} · ${price ? `up to ${price} cr` : "free"}`}
        </Button>
      ) : null}
    </div>
  );
}

/** Private videos are fetched whole and played from a blob URL (our image route doesn't serve byte ranges, which iOS needs). */
function VideoClip({ src }: { src: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | undefined;
    fetch(src).then((r) => r.blob()).then((b) => setUrl((u = URL.createObjectURL(b))));
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [src]);
  return url ? (
    <video src={url} autoPlay loop muted playsInline controls className="aspect-[3/4] w-full rounded-[24px] bg-black object-cover" aria-label="AI animation of this look" />
  ) : (
    <div className="grid aspect-[3/4] place-items-center rounded-[24px] bg-muted"><Loader2 className="animate-spin" aria-hidden /></div>
  );
}

function Routine({ title, steps, products }: { title: string; steps: string[]; products: string[] }) {
  return (
    <div className="space-y-3 rounded-2xl bg-background p-4">
      <p className="font-semibold">{title}</p>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
      {products.length ? <div className="flex flex-wrap gap-2">{products.map((x) => <span key={x} className="rounded-full bg-card px-3 py-1 text-xs">{x}</span>)}</div> : null}
    </div>
  );
}

function ColorRow({ label, colors }: { label: string; colors: { name: string; hex: string }[] }) {
  return (
    <div className="rounded-2xl bg-background p-4">
      <p className="pb-2 text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <ul className="flex flex-wrap gap-3">
        {colors.map((c) => (
          <li key={c.hex + c.name} className="flex items-center gap-2 text-sm"><span className="size-7 rounded-full border" style={{ background: c.hex }} /> {c.name}</li>
        ))}
      </ul>
    </div>
  );
}
