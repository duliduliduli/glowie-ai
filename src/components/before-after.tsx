"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Before/after comparison. Drag, tap or use arrow keys on the slider. `before`/`after` are image URLs. */
export function BeforeAfterSlider({ before, after, alt, className }: { before: string; after: string; alt: string; className?: string }) {
  const [pos, setPos] = useState(50);
  return (
    <div className={cn("relative aspect-[4/5] overflow-hidden rounded-[28px] bg-muted select-none", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- signed/data URLs, not optimisable */}
      <img src={after} alt={`${alt}, after`} className="absolute inset-0 size-full object-cover" draggable={false} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before} alt={`${alt}, before`} className="absolute inset-0 size-full object-cover" draggable={false} />
      </div>
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }}>
        <span className="absolute top-1/2 left-1/2 grid size-11 -translate-1/2 place-items-center rounded-full bg-white text-sm font-bold shadow-md">↔</span>
      </div>
      <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">Before</span>
      <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">After · AI</span>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={`Compare before and after: ${alt}`}
        className="absolute inset-0 size-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}
