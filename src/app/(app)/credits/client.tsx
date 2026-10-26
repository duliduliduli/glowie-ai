"use client";

import { useEffect, useState, useTransition } from "react";
import { Gift, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { buyPack, setAutoTopUp } from "../actions";

export function BuyButton({ packId, label }: { packId: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await buyPack(packId);
          if (r?.error) toast.error(r.error);
        })
      }
    >
      {pending ? "Opening..." : label}
    </Button>
  );
}

export function PaidToast() {
  useEffect(() => {
    toast.success("Payment received. Credits appear as soon as your bank confirms, usually within seconds.");
  }, []);
  return null;
}

export function AutoTopUp({ packId, below, packs }: { packId: string | null; below: number; packs: { id: string; label: string }[] }) {
  const [on, setOn] = useState(!!packId);
  const [pack, setPack] = useState(packId ?? packs[0].id);
  const [threshold, setThreshold] = useState(below);
  const [pending, start] = useTransition();
  const save = (next: { on: boolean; pack: string; threshold: number }) =>
    start(async () => {
      await setAutoTopUp({ packId: next.on ? next.pack : null, below: next.threshold });
      toast.success(next.on ? "Auto top-up on" : "Auto top-up off");
    });

  return (
    <section className="space-y-4 rounded-[24px] bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Auto top-up</h2>
          <p className="text-sm text-muted-foreground">Buy a pack with your saved card when you run low.</p>
        </div>
        <Switch checked={on} disabled={pending} aria-label="Auto top-up" onCheckedChange={(v) => { setOn(v); save({ on: v, pack, threshold }); }} />
      </div>
      {on ? (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="space-y-1">
            <span className="text-muted-foreground">Pack</span>
            <select className="min-h-11 w-full rounded-xl border bg-background px-3" value={pack} onChange={(e) => { setPack(e.target.value); save({ on, pack: e.target.value, threshold }); }}>
              {packs.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">When below</span>
            <select className="min-h-11 w-full rounded-xl border bg-background px-3" value={threshold} onChange={(e) => { setThreshold(Number(e.target.value)); save({ on, pack, threshold: Number(e.target.value) }); }}>
              {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n} credits</option>)}
            </select>
          </label>
        </div>
      ) : null}
    </section>
  );
}

export function ReferralCard({ url, credits }: { url: string; credits: number }) {
  const share = () => {
    const text = `I'm using Glowie to find my colours and new looks. Get $${(credits / 10).toFixed(0)} in credits:`;
    if (navigator.share) navigator.share({ title: "Glowie", text, url }).catch(() => {});
    else navigator.clipboard.writeText(url).then(() => toast.success("Link copied"));
  };
  return (
    <section className="space-y-3 rounded-[24px] bg-accent-soft p-5">
      <div className="flex items-center gap-3">
        <Gift className="size-6 text-accent" aria-hidden />
        <h2 className="font-bold">Give ${(credits / 10).toFixed(0)}, get ${(credits / 10).toFixed(0)}</h2>
      </div>
      <p className="text-sm">Friends get {credits} bonus credits and so do you, once they make their first purchase.</p>
      <div className="flex gap-2">
        <code className="flex min-h-11 flex-1 items-center truncate rounded-xl bg-card px-3 text-xs">{url}</code>
        <Button onClick={share} aria-label="Share referral link"><Share2 aria-hidden /> Share</Button>
      </div>
    </section>
  );
}
