"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flame, Link2, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Roast } from "@/lib/ai";
import { shareCard, stopSharing } from "../actions";
import { apiFetch } from "@/lib/api-fetch";

type Item = { id: string; image: string; result: Roast; shared: boolean };

export function RoastFlow({ price, hasSelfie, past }: { price: number; hasSelfie: boolean; past: Item[] }) {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [live, setLive] = useState<Set<string>>(() => new Set(past.filter((r) => r.shared).map((r) => r.id)));

  const go = async (f: File) => {
    try {
      if (f.size > 10 * 1024 * 1024) throw new Error("That photo is over 10 MB. Try a smaller one.");
      setBusy("Checking your photo...");
      const form = new FormData();
      form.set("file", f);
      form.set("kind", "outfit");
      const up = await apiFetch("/api/photos", { method: "POST", body: form }).then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({ error: "Upload failed. Please try again." })) }));
      if (!up.ok) throw new Error(up.data.error);
      setBusy("Sharpening our wit...");
      const res = await apiFetch("/api/roast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoId: up.data.id }) });
      const data = await res.json().catch(() => ({ error: "Something went wrong. Please try again." }));
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
    let url: string;
    try {
      url = await shareCard("roast", id);
    } catch {
      return toast.error("Couldn't create the link. Please try again.");
    }
    setLive((l) => new Set(l).add(id));
    try {
      if (asImage) {
        const res = await fetch(`${url}/image`);
        if (!res.ok) throw new Error("image");
        const f = new File([await res.blob()], "glowie-roast.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [f] })) return await navigator.share({ files: [f] });
      }
      if (navigator.share) return await navigator.share({ url, title: "Roast my fit" });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
    // The share sheet was refused or isn't available: copy the link instead, and show it if even that fails.
    await navigator.clipboard.writeText(url).then(() => toast.success("Link copied"), () => toast(url));
  };

  return (
    <div className="space-y-5">
      {hasSelfie ? (
        <>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) go(f); }} />
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
          {live.has(r.id) ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-background p-3 text-sm">
              <span>Your public link is on.</span>
              <Button variant="secondary" size="sm" className="h-11" onClick={async () => { await stopSharing("roast", r.id); setLive((l) => { const n = new Set(l); n.delete(r.id); return n; }); toast.success("Link turned off"); }}>Stop sharing</Button>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
