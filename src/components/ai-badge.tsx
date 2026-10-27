/** Small "AI" label for generated images. Put it inside a `relative` wrapper. */
export function AiBadge({ className = "left-2 top-2" }: { className?: string }) {
  return <span className={`pointer-events-none absolute rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white ${className}`}>AI</span>;
}
