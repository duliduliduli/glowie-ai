// Generates the static PWA icons in public/. Run: node scripts/make-icons.mjs
import sharp from "sharp";

const sparkle = (s, cx, cy) => {
  const k = s / 24;
  const p = [[12, 1.5], [14.2, 9.8], [22.5, 12], [14.2, 14.2], [12, 22.5], [9.8, 14.2], [1.5, 12], [9.8, 9.8]];
  return p.map(([x, y]) => `${cx + (x - 12) * k},${cy + (y - 12) * k}`).join(" ");
};

// `inset` shrinks the glyph into the maskable safe zone (inner 80%).
const svg = (size, { radius, inset = 1 }) => {
  const g = size * 0.56 * inset;
  const c = size / 2;
  const dot = size * 0.065 * inset;
  const off = size * 0.265 * inset;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#16171a"/>
  <polygon points="${sparkle(g, c, c)}" fill="#ffffff"/>
  <circle cx="${c + off}" cy="${c - off}" r="${dot}" fill="#cf8a8f"/>
</svg>`;
};

const out = [
  ["public/icon-192.png", 192, { radius: 42 }],
  ["public/icon-512.png", 512, { radius: 112 }],
  ["public/icon-maskable-512.png", 512, { radius: 0, inset: 0.75 }],
];
for (const [file, size, opts] of out) await sharp(Buffer.from(svg(size, opts))).png().toFile(file);
console.log("icons written");
