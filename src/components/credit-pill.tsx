import Link from "next/link";
import { Zap } from "lucide-react";

export function CreditPill({ credits }: { credits: number }) {
  return (
    <Link href="/credits" className="flex min-h-11 items-center gap-2 rounded-full bg-card py-1.5 pl-1.5 pr-4 shadow-sm" aria-label={`${credits} credits. Buy more`}>
      <span className="grid size-8 place-items-center rounded-full bg-background">
        <Zap className="size-4" aria-hidden />
      </span>
      <span className="text-sm font-semibold tabular-nums">{credits}</span>
    </Link>
  );
}
