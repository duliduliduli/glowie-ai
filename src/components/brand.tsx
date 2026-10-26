import { Sparkle } from "lucide-react";

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="relative grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
        <Sparkle className="size-5 fill-current" aria-hidden />
        <span className="absolute right-2 top-2 size-1.5 rounded-full bg-accent" />
      </span>
      <div className="leading-tight">
        <p className="text-lg font-bold">Glowie</p>
        {subtitle ? <p className="text-xs uppercase tracking-wide text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
  );
}
