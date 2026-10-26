import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { del, get, put } from "@vercel/blob";

// Photos are private blobs. The browser only ever sees our own short-lived HMAC-signed URLs.
function secret() {
  const s = process.env.SIGNING_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("SIGNING_SECRET is not set");
  return s ?? "dev-only-signing-secret";
}
const sign = (id: string, exp: number) => createHmac("sha256", secret()).update(`${id}.${exp}`).digest("base64url");

export async function putImage(path: string, bytes: Buffer | Uint8Array, contentType: string) {
  const blob = await put(path, Buffer.from(bytes), { access: "private", contentType, addRandomSuffix: true });
  return blob.pathname;
}

export async function readImage(path: string) {
  const r = await get(path, { access: "private" });
  if (!r || r.statusCode !== 200 || !r.stream) throw new Error("Image not found");
  return { bytes: Buffer.from(await new Response(r.stream).arrayBuffer()), contentType: r.blob.contentType };
}

export async function dataUrl(path: string) {
  const { bytes, contentType } = await readImage(path);
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

export async function deleteImages(paths: string[]) {
  if (paths.length) await del(paths);
}

export function signedUrl(photoId: string, ttlSeconds = 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `/api/img/${photoId}?exp=${exp}&sig=${sign(photoId, exp)}`;
}

export function verifySignature(photoId: string, exp: string | null, sig: string | null) {
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const a = Buffer.from(sign(photoId, Number(exp)));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
