import "server-only";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import { db } from "./db";
import { dataUrl } from "./storage";
import { APP_DOMAIN } from "./config";
import type { Look, Roast } from "./ai";

// 9:16 share cards for Stories, rendered with Satori (inline styles only).
const INK = "#111114";
const ROSE = "#c56b78";
const MUTED = "#6b6e76";

export async function photoData(id: string | null | undefined) {
  if (!id) return null;
  const p = await db.photo.findUnique({ where: { id } });
  return p && !p.deletedAt ? dataUrl(p.blobPath) : null;
}

function Frame({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f2f3f5", padding: 56, gap: 28, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 30, color: ROSE, fontWeight: 700, letterSpacing: 4 }}>{kicker.toUpperCase()}</div>
        <div style={{ fontSize: 60, fontWeight: 800, color: INK, lineHeight: 1.05 }}>{title}</div>
      </div>
      {children}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 34, color: INK }}>
        <div style={{ fontWeight: 800 }}>✦ Glowie</div>
        <div style={{ color: MUTED }}>{APP_DOMAIN}</div>
      </div>
    </div>
  );
}

function Panel({ src, label }: { src: string | null; label?: string }) {
  return (
    <div style={{ position: "relative", display: "flex", flex: 1, borderRadius: 48, overflow: "hidden", background: "#e7e8ec" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain img */}
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
      {label ? (
        <div style={{ position: "absolute", top: 32, left: 32, padding: "12px 28px", borderRadius: 999, background: "rgba(17,17,20,0.75)", color: "white", fontSize: 32, fontWeight: 700, letterSpacing: 2 }}>
          {label}
        </div>
      ) : null}
    </div>
  );
}

function Box({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 12, background: "white", borderRadius: 40, padding: 40, fontSize: 32, color: INK }}>{children}</div>;
}

const render = (node: ReactNode, name: string) =>
  new ImageResponse(<>{node}</>, { width: 1080, height: 1920, headers: { "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="${name}.png"` } });

export const storyCard = (o: { kicker: string; title: string; before: string | null; after: string }) =>
  render(
    <Frame kicker={o.kicker} title={o.title}>
      {o.before ? <Panel src={o.before} label="BEFORE" /> : null}
      <Panel src={o.after} label="AFTER · AI PREVIEW" />
    </Frame>,
    "glowie-glowup",
  );

export const stylistCard = (o: { image: string | null; look: Look }) =>
  render(
    <Frame kicker="For my stylist" title={o.look.hair.style}>
      <Panel src={o.image} label="REFERENCE · AI PREVIEW ON ME" />
      <Box>
        <div style={{ display: "flex" }}><b style={{ width: 220 }}>Level</b>{o.look.hair.salon.level}</div>
        <div style={{ display: "flex" }}><b style={{ width: 220 }}>Tone</b>{o.look.hair.salon.tone}</div>
        <div style={{ display: "flex" }}><b style={{ width: 220 }}>Technique</b>{o.look.hair.salon.technique}</div>
        <div style={{ display: "flex" }}><b style={{ width: 220 }}>Cut</b>{o.look.hair.salon.cut}</div>
      </Box>
    </Frame>,
    "glowie-stylist-card",
  );

export const roastCard = (o: { image: string | null; roast: Roast }) =>
  render(
    <Frame kicker={`Roast my fit · ${o.roast.score}/10`} title={o.roast.headline}>
      <Panel src={o.image} />
      <Box>
        {o.roast.quickFixes.slice(0, 3).map((f) => (
          <div key={f} style={{ display: "flex" }}>→ {f}</div>
        ))}
      </Box>
    </Frame>,
    "glowie-roast",
  );
