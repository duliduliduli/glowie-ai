"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { vote } from "./actions";

type Props = { token: string; looks: { title: string; image: string }[]; tally: number[]; voted: number | null; isHost: boolean; bonus: number };

export function Ballot({ token, looks, tally, voted, isHost, bonus }: Props) {
  const [mine, setMine] = useState(voted);
  const [pending, start] = useTransition();
  const showResults = mine !== null || isHost;
  const total = tally[0] + tally[1] || 1;

  const pick = (choice: 0 | 1) =>
    start(async () => {
      const r = await vote(token, choice);
      if (r.error) toast.error(r.error);
      else setMine(choice);
    });

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {looks.map((l, i) => (
          <button
            key={l.image}
            type="button"
            disabled={showResults || pending}
            onClick={() => pick(i as 0 | 1)}
            aria-pressed={mine === i}
            className={cn("relative overflow-hidden rounded-[24px] bg-card text-left shadow-sm transition active:scale-[0.98]", mine === i && "ring-3 ring-accent")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.image} alt={`Look ${i === 0 ? "A" : "B"}: ${l.title}`} className="aspect-[4/5] w-full object-cover" />
            <div className="p-3">
              <p className="truncate text-sm font-semibold">{l.title}</p>
              {showResults ? <p className="text-xs text-muted-foreground">{Math.round((tally[i] / total) * 100)}% · {tally[i]} votes</p> : <p className="text-xs text-muted-foreground">Tap to vote</p>}
            </div>
            {mine === i ? <Check className="absolute right-3 top-3 size-8 rounded-full bg-accent p-1.5 text-white" aria-hidden /> : null}
          </button>
        ))}
      </div>
      {mine !== null && !isHost ? (
        <div className="space-y-3 rounded-[24px] bg-primary p-5 text-primary-foreground">
          <p className="font-bold">Thanks for voting! Your turn?</p>
          <p className="text-sm text-white/75">See yourself in new looks. Sign up for a free analysis plus {1 + bonus} free AI previews of you.</p>
          <Button asChild variant="white" className="w-full">
            <Link href={`/p/${token}/join`}>Get my free glowup</Link>
          </Button>
        </div>
      ) : null}
    </>
  );
}
