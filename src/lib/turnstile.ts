import "server-only";

export async function verifyTurnstile(token: string | null, ip: string | null) {
  if (!process.env.TURNSTILE_SECRET_KEY) return process.env.NODE_ENV !== "production";
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token, ...(ip ? { remoteip: ip } : {}) }),
  });
  return (await res.json()).success === true;
}
