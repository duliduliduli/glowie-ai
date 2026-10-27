"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { retrySession } from "../../actions";

const COPY = ["Finding your colours...", "Reading your undertone...", "Measuring your face shape...", "Pulling outfits from the rails...", "Picking your perfect lip...", "Styling three looks just for you..."];

/** Refreshes the server page until the session is ready, with honest progress copy. */
export function Poller() {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const refresh = setInterval(() => router.refresh(), 3000);
    const copy = setInterval(() => setI((x) => (x + 1) % COPY.length), 2500);
    const late = setTimeout(() => setSlow(true), 90_000);
    return () => {
      clearInterval(refresh);
      clearInterval(copy);
      clearTimeout(late);
    };
  }, [router]);
  return (
    <div className="flex items-center gap-3 rounded-[28px] bg-card p-5 shadow-sm">
      <Loader2 className="size-6 shrink-0 animate-spin text-accent" aria-hidden />
      {/* One steady announcement for screen readers; the rotating copy is visual only. */}
      <p role="status" className="sr-only">Creating your looks</p>
      <div aria-hidden>
        <p className="font-semibold">{COPY[i]}</p>
        <p className="text-xs text-muted-foreground">{slow ? "Taking longer than usual. It's still working; you can leave and come back." : "Usually 30 to 60 seconds. You can leave and come back."}</p>
      </div>
    </div>
  );
}

export function RetryButton({ sessionId }: { sessionId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      className="w-full"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await retrySession(sessionId).catch(() => ({ error: "Couldn't retry. Please try again." }));
          if (r.error) toast.error(r.error);
        })
      }
    >
      {pending ? "Retrying..." : "Try again"}
    </Button>
  );
}

/** Quiet refresh while background jobs (hair try-on, video) run. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
