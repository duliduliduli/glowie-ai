"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Heart, Loader2, RefreshCw, Scissors, Share2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BeforeAfterSlider } from "@/components/before-after";
import { shopLinks } from "@/lib/shop";
import { cn } from "@/lib/utils";
import type { Look } from "@/lib/ai";
import { toggleFavorite } from "../../actions";

type Props = {
  id: string;
  look: Look;
  before: string | null;
  preview: string | null;
  favorite: boolean;
  imagePrice: number;
  previewBlocked: string | null;
};

const TABS = ["Outfit", "Hair", "Makeup", "Colours"] as const;
const GEN_COPY = ["Trying on the outfit...", "Doing your hair...", "Blending the makeup...", "Checking the lighting..."];

export function LookCard({ id, look, before, preview, favorite, imagePrice, previewBlocked }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Outfit");
  const [fav, setFav] = useState(favorite);
  const [generating, setGenerating] = useState(false);
  const [copy, setCopy] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [, startFav] = useTransition();

  useEffect(() => {
    if (!generating) return;
    const t = setInterval(() => setCopy((c) => (c + 1) % GEN_COPY.length), 2500);
    return () => clearInterval(t);
  }, [generating]);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/looks/${id}/preview`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Preview ready · ${data.charged} credit${data.charged === 1 ? "" : "s"}`);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message || "Preview failed. You weren't charged.");
    } finally {
      setGenerating(false);
    }
  };

  const share = async () => {
    setSharing(true);
    try {
      const res = await fetch(`/api/share/${id}`);
      if (!res.ok) throw new Error(await res.text());
      const file = new File([await res.blob()], `glowie-${id}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: look.title }).catch(() => {});
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (e) {
      toast.error((e as Error).message || "Couldn't create the share image");
    } finally {
      setSharing(false);
    }
  };

  const onFav = () => {
    setFav(!fav);
    startFav(async () => {
      const r = await toggleFavorite(id);
      if (r === undefined) setFav(fav);
      else toast.success(r ? "Saved to your lookbook" : "Removed from lookbook");
    });
  };

  return (
    <article className="space-y-4 rounded-[28px] bg-card p-4 shadow-sm">
      <div className="relative">
        {preview && before ? (
          <BeforeAfterSlider before={before} after={preview} alt={look.title} />
        ) : (
          <div className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-[24px] bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {before ? <img src={before} alt="Your photo" className={cn("absolute inset-0 size-full object-cover", generating && "blur-sm")} /> : null}
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

      {previewBlocked ? (
        <p className="rounded-2xl bg-background p-3 text-xs text-muted-foreground">{previewBlocked}</p>
      ) : (
        <div className="flex gap-2">
          <Button className="flex-1" onClick={generate} disabled={generating}>
            {preview ? <RefreshCw aria-hidden /> : <Wand2 aria-hidden />}
            {preview ? "Regenerate" : "See it on me"} · up to {imagePrice} cr
          </Button>
          {preview ? (
            <Button variant="secondary" size="icon" onClick={share} disabled={sharing} aria-label="Share before and after">
              {sharing ? <Loader2 className="animate-spin" /> : <Share2 />}
            </Button>
          ) : null}
        </div>
      )}

      <p className="text-sm"><span className="font-semibold">Why it suits you: </span>{look.whyItSuits}</p>

      <div role="tablist" aria-label="Look details" className="no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-background p-1">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn("min-h-11 flex-1 rounded-full px-3 text-sm font-medium", tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
          >
            {t}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="space-y-3">
        {tab === "Outfit" ? (
          <ul className="space-y-3">
            {look.outfit.map((o) => (
              <li key={o.piece} className="rounded-2xl bg-background p-4">
                <p className="font-semibold">{o.piece} <span className="font-normal text-muted-foreground">· {o.color}</span></p>
                <p className="text-sm text-muted-foreground">{o.description}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {shopLinks(o.searchQuery).map((l) => (
                    <a key={l.name} href={l.url} target="_blank" rel="noopener sponsored" className="inline-flex min-h-11 items-center gap-1 rounded-full bg-card px-3 text-sm shadow-sm">
                      {l.name} <ArrowUpRight className="size-3.5" aria-hidden />
                    </a>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {tab === "Hair" ? (
          <>
            <Routine title={look.hair.style} steps={look.hair.steps} products={look.hair.products} />
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary" className="w-full"><Scissors aria-hidden /> Show my stylist</Button>
              </DialogTrigger>
              <DialogContent className="rounded-[28px]">
                <DialogTitle className="heading">For my stylist</DialogTitle>
                <DialogDescription className="sr-only">A summary card to show your hairstylist or makeup artist.</DialogDescription>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {preview ?? before ? <img src={(preview ?? before)!} alt="Reference look" className="aspect-[4/5] w-full rounded-2xl object-cover" /> : null}
                <div className="space-y-2 text-sm">
                  <p><span className="font-semibold">Hair: </span>{look.hair.style}</p>
                  <p>{look.hair.stylistNote}</p>
                  <p><span className="font-semibold">Makeup: </span>{look.makeup.look}</p>
                </div>
                <Button
                  onClick={() => {
                    const text = `Hair: ${look.hair.style}\n${look.hair.stylistNote}\nMakeup: ${look.makeup.look}`;
                    if (navigator.share) navigator.share({ title: "My look", text }).catch(() => {});
                    else navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
                  }}
                >
                  <Share2 aria-hidden /> Send to stylist
                </Button>
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

function Routine({ title, steps, products }: { title: string; steps: string[]; products: string[] }) {
  return (
    <div className="space-y-3 rounded-2xl bg-background p-4">
      <p className="font-semibold">{title}</p>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
      {products.length ? (
        <div className="flex flex-wrap gap-2">{products.map((p) => <span key={p} className="rounded-full bg-card px-3 py-1 text-xs">{p}</span>)}</div>
      ) : null}
    </div>
  );
}

function ColorRow({ label, colors }: { label: string; colors: { name: string; hex: string }[] }) {
  return (
    <div className="rounded-2xl bg-background p-4">
      <p className="pb-2 text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <ul className="flex flex-wrap gap-3">
        {colors.map((c) => (
          <li key={c.hex + c.name} className="flex items-center gap-2 text-sm">
            <span className="size-7 rounded-full border" style={{ background: c.hex }} /> {c.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
