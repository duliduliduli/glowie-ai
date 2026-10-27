import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";

// Photos are private blobs. The browser only ever sees our own short-lived HMAC-signed URLs.
function secret() {
  const s = process.env.SIGNING_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("SIGNING_SECRET is not set");
  return s ?? "dev-only-signing-secret";
}
const sign = (id: string, exp: number) => createHmac("sha256", secret()).update(`${id}.${exp}`).digest("base64url");

// shortcut: without BLOB_READ_WRITE_TOKEN (local dev only) photos live on disk in .local-blobs; set the token in production.
const local = !process.env.BLOB_READ_WRITE_TOKEN && process.env.NODE_ENV !== "production";
const LOCAL_DIR = path.join(process.cwd(), ".local-blobs");
const localPath = (p: string) => path.join(LOCAL_DIR, p.replace(/[^\w.-]/g, "_"));

export async function putImage(blobName: string, bytes: Buffer | Uint8Array, contentType: string) {
  if (local) {
    await mkdir(LOCAL_DIR, { recursive: true });
    const name = `${blobName.replace(/[^\w.-]/g, "_")}-${crypto.randomUUID().slice(0, 8)}`;
    await writeFile(localPath(name), bytes);
    await writeFile(`${localPath(name)}.type`, contentType);
    return name;
  }
  const blob = await put(blobName, Buffer.from(bytes), { access: "private", contentType, addRandomSuffix: true });
  return blob.pathname;
}

export async function readImage(blobPath: string) {
  if (local) return { bytes: await readFile(localPath(blobPath)), contentType: await readFile(`${localPath(blobPath)}.type`, "utf8") };
  const r = await get(blobPath, { access: "private" });
  if (!r || r.statusCode !== 200 || !r.stream) throw new Error("Image not found");
  return { bytes: Buffer.from(await new Response(r.stream).arrayBuffer()), contentType: r.blob.contentType };
}

export async function dataUrl(blobPath: string) {
  const { bytes, contentType } = await readImage(blobPath);
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

export async function deleteImages(paths: string[]) {
  if (local) return void (await Promise.all(paths.flatMap((p) => [rm(localPath(p), { force: true }), rm(`${localPath(p)}.type`, { force: true })])));
  if (paths.length) await del(paths);
}

/** Public pages mint short links, so turning a share link off takes effect within minutes. */
export const PUBLIC_TTL = 300;

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
