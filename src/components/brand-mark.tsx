/** Glowie app mark for next/og images: black rounded square, white sparkle, dusty-rose dot. Inline styles only (Satori). */
export function BrandMark({ size, radius = size * 0.22 }: { size: number; radius?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: "#16171a", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24">
        <path d="M12 1.5 14.2 9.8 22.5 12 14.2 14.2 12 22.5 9.8 14.2 1.5 12 9.8 9.8Z" fill="#ffffff" />
      </svg>
      <div style={{ position: "absolute", top: size * 0.2, right: size * 0.2, width: size * 0.13, height: size * 0.13, borderRadius: 999, background: "#cf8a8f" }} />
    </div>
  );
}
