"use client";

import { useState, useTransition } from "react";
import { PartyPopper, Share2 } from "lucide-react";
import { toast } from "sonner";
import { AiBadge } from "@/components/ai-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { endParty, startParty } from "../../actions";

type Props = {
  looks: { id: string; title: string; image: string }[];
  parties: { id: string; url: string; tally: number[]; titles: string[] }[];
};

// After an awaited server call iOS may refuse to open the share sheet, so every failure falls back to copying the link.
const send = async (url: string) => {
  try {
    if (navigator.share) return await navigator.share({ title: "Which look should I go with?", text: "Vote on my Glowie looks (no app needed):", url });
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
  }
  await navigator.clipboard.writeText(url).then(() => toast.success("Link copied. Paste it to your friends."), () => toast(url));
};

/** Glowup Party: pick 2 previewed looks, send the link, friends vote without an account. */
export function PartyCard({ looks, parties }: Props) {
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-2)));

  return (
    <section className="space-y-4 rounded-[28px] bg-accent-soft p-5">
      <div className="flex items-center gap-3">
        <PartyPopper className="size-6 text-accent" aria-hidden />
        <div>
          <h2 className="font-bold">Glowup Party</h2>
          <p className="text-sm">Can&apos;t decide? Let your friends vote. Each friend who joins gets a free preview.</p>
        </div>
      </div>
      {parties.map((p) => {
        const total = p.tally[0] + p.tally[1];
        return (
          <div key={p.id} className="space-y-2 rounded-2xl bg-card p-4 text-sm">
            {p.titles.map((t, i) => (
              <div key={t} className="flex justify-between gap-2">
                <span className="truncate">{t}</span>
                <span className="font-semibold tabular-nums">{p.tally[i]} vote{p.tally[i] === 1 ? "" : "s"}{total ? ` · ${Math.round((p.tally[i] / total) * 100)}%` : ""}</span>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="flex-1 h-11" onClick={() => send(p.url)}><Share2 aria-hidden /> Send again</Button>
              <Button size="sm" variant="ghost" className="h-11" onClick={() => start(() => endParty(p.id))} disabled={pending}>End</Button>
            </div>
          </div>
        );
      })}
      {looks.length >= 2 ? (
        <>
          <p className="text-sm font-semibold">Pick 2 looks</p>
          <div className="grid grid-cols-3 gap-2">
            {looks.map((l) => (
              <button key={l.id} type="button" aria-pressed={picked.includes(l.id)} onClick={() => toggle(l.id)} className={cn("overflow-hidden rounded-2xl bg-card text-left", picked.includes(l.id) && "ring-3 ring-primary")}>
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.image} alt="" className="aspect-[4/5] w-full object-cover" />
                  <AiBadge />
                </div>
                <span className="block truncate p-2 text-xs font-medium">{l.title}</span>
              </button>
            ))}
          </div>
          <Button
            className="w-full"
            disabled={picked.length !== 2 || pending}
            onClick={() =>
              start(async () => {
                const r = await startParty(picked[0], picked[1]);
                if ("error" in r) toast.error(r.error);
                else await send(r.url);
              })
            }
          >
            Start a party
          </Button>
          <p className="text-xs text-muted-foreground">Friends see only these two AI previews, never your original photo. You can end the party any time.</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Preview at least 2 looks to start a party.</p>
      )}
    </section>
  );
}
