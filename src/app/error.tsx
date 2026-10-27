"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-content-center gap-4 px-6 text-center">
      <h1 className="heading text-2xl">Something went wrong</h1>
      <p className="text-muted-foreground">It wasn&apos;t you. Nothing was charged for anything that failed.</p>
      <Button size="lg" onClick={reset}>Try again</Button>
    </main>
  );
}
