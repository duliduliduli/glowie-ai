import { CheckCircle2, Lightbulb } from "lucide-react";
import { SELFIE_MIN_SCORE } from "@/lib/config";
import { cn } from "@/lib/utils";

export type Coach = { score: number; tips: string[]; lighting: number; angle: number; sharpness: number; faceVisible: number };

/** Selfie coach result: overall score, the four factors, and tips. */
export function CoachCard({ coach }: { coach: Coach }) {
  const ok = coach.score >= SELFIE_MIN_SCORE;
  const bars = [
    ["Lighting", coach.lighting],
    ["Face visible", coach.faceVisible],
    ["Angle", coach.angle],
    ["Sharpness", coach.sharpness],
  ] as const;
  return (
    <div role="status" className={cn("space-y-3 rounded-[24px] p-5", ok ? "bg-card shadow-sm" : "bg-accent-soft")}>
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-bold">
          {ok ? <CheckCircle2 className="size-5 text-emerald-600" aria-hidden /> : <Lightbulb className="size-5 text-accent" aria-hidden />}
          {ok ? "Selfie coach: looking good" : "Selfie coach: let's retake"}
        </p>
        <span className="text-2xl font-extrabold tabular-nums">{coach.score}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {bars.map(([k, v]) => (
          <div key={k}>
            <dt className="flex justify-between text-muted-foreground"><span>{k}</span><span>{v}/10</span></dt>
            <dd className="mt-1 h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary" style={{ width: `${v * 10}%` }} /></dd>
          </div>
        ))}
      </dl>
      {coach.tips.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{coach.tips.map((t) => <li key={t}>{t}</li>)}</ul> : null}
    </div>
  );
}
