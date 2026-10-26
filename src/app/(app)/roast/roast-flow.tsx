"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flame, Link2, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Roast } from "@/lib/ai";
import { shareCard } from "../actions";

type Item = { id: string; image: string; result: Roast };

export function RoastFlow({ price, hasSelfie, past }: { price: number; hasSelfie: boolean; past: Item[] }) {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const go = async (f: File) => {
    try {
      setBusy("Checking your photo...");
      const form = new FormData();
      form.set("file", f);
      form.set("kind", "outfit");
      const up = await fetch("/api/photos", { method: "POST", body: form }).then(async (r) => ({ ok: r.ok, data: await r.json() }));
      if (!up.ok) throw new Error(up.data.error);
      setBusy("Sharpening our wit...");
      const res = await fetch("/api/roast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoId: up.data.id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
      if (file.current) file.current.value = "";
    }
  };

  const share = async (id: string, asImage: boolean) => {
    const url = await shareCard("roast", id);
    if (asImage) {
      const blob = await fetch(`${url}/image`).then((r) => r.blob());
      const f = new File([blob], "glowie-roast.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [f] })) return navigator.share({ files: [f] }).catch(() => {});
    }
    if (navigator.share) return navigator.share({ url, title: "Roast my fit" }).catch(() => {});
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  return (
    <div className="space-y-5">
      {hasSelfie ? (
        <>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && go(e.target.files[0])} />
          <Button size="lg" className="w-full" disabled={!!busy} onClick={() => file.current?.click()}>
            {busy ? <><Loader2 className="animate-spin" aria-hidden /> {busy}</> : <><Flame aria-hidden /> Roast my outfit · up to {price} cr</>}
          </Button>
          <p className="text-center text-xs text-muted-foreground">A mirror selfie or full-length photo of you works best.</p>
        </>
      ) : (
        <div className="space-y-3 rounded-[24px] bg-card p-5 text-sm shadow-sm">
          <p>Take a selfie first so we can check the outfit photo is really you.</p>
          <Button asChild className="w-full"><Link href="/new">Take a selfie</Link></Button>
        </div>
      )}

      {past.map((r) => (
        <article key={r.id} className="space-y-3 rounded-[28px] bg-card p-4 shadow-sm">
          <div className="flex gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.image} alt="Your outfit" className="aspect-[4/5] w-28 rounded-2xl object-cover" />
            <div>
              <p className="text-4xl font-extrabold tabular-nums">{r.result.score}<span className="text-base text-muted-foreground">/10</span></p>
              <p className="font-bold">{r.result.headline}</p>
            </div>
          </div>
          <div className="text-sm">
            <p className="font-semibold">What works</p>
            <ul className="list-disc pl-5">{r.result.whatWorks.map((w) => <li key={w}>{w}</li>)}</ul>
            <p className="pt-2 font-semibold">Quick fixes</p>
            <ul className="list-disc pl-5">{r.result.quickFixes.map((w) => <li key={w}>{w}</li>)}</ul>
            <p className="pt-2 text-muted-foreground">{r.result.verdict}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => share(r.id, true)}><Share2 aria-hidden /> Share card</Button>
            <Button variant="secondary" onClick={() => share(r.id, false)}><Link2 aria-hidden /> Link</Button>
          </div>
        </article>
      ))}
    </div>
  );
}
