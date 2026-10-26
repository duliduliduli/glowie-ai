"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { retrySession } from "../../actions";

const COPY = ["Finding your colours...", "Reading your undertone...", "Measuring your face shape...", "Pulling outfits from the rails...", "Picking your perfect lip...", "Styling three looks just for you..."];

/** Refreshes the server page until the session is ready, with honest progress copy. */
export function Poller() {
  const router = useRouter();
  const [i, setI] = useState(0);
  useEffect(() => {
    const refresh = setInterval(() => router.refresh(), 3000);
    const copy = setInterval(() => setI((x) => (x + 1) % COPY.length), 2500);
    return () => {
      clearInterval(refresh);
      clearInterval(copy);
    };
  }, [router]);
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-[28px] bg-card p-5 shadow-sm">
      <Loader2 className="size-6 shrink-0 animate-spin text-accent" aria-hidden />
      <div>
        <p className="font-semibold">{COPY[i]}</p>
        <p className="text-xs text-muted-foreground">Usually 30 to 60 seconds. You can leave and come back.</p>
      </div>
    </div>
  );
}

export function RetryButton({ sessionId }: { sessionId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button className="w-full" disabled={pending} onClick={() => start(() => retrySession(sessionId))}>
      {pending ? "Retrying..." : "Try again"}
    </Button>
  );
}
