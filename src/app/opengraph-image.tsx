import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/brand-mark";

export const alt = "Glowie: try the look before you book it. No subscription, ever.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "linear-gradient(135deg, #f2f3f5 0%, #f6e4e4 100%)", color: "#16171a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <BrandMark size={120} />
          <div style={{ fontSize: 88, fontWeight: 800, letterSpacing: -2 }}>Glowie</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 56, fontWeight: 800, textTransform: "uppercase", letterSpacing: -1, lineHeight: 1.05 }}>Try the look before you book it.</div>
        <div style={{ marginTop: 16, fontSize: 34, color: "#5d6068" }}>No subscription, ever. Credits never expire. A full glowup for about $1.</div>
      </div>
    ),
    size,
  );
}
