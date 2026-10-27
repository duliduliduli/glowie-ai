import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublic = createRouteMatcher([
  "/",
  "/privacy",
  "/terms",
  "/cookies",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/r/(.*)",
  "/c/(.*)",
  "/p/(.*)",
  "/api/stripe/webhook",
  "/api/cron/(.*)",
  "/api/img/(.*)",
  "/manifest.webmanifest",
  "/opengraph-image(.*)",
  "/icon(.*)",
  "/apple-icon(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) {
    // API calls get JSON (the app reloads to renew the session); pages redirect to sign-in.
    if (req.nextUrl.pathname.startsWith("/api/")) {
      if (!(await auth()).userId) return NextResponse.json({ error: "Your session expired. Please refresh." }, { status: 401 });
    } else await auth.protect();
  }
  const res = NextResponse.next();
  // Anonymous device id, used to allow one free trial per device.
  if (!req.cookies.get("did")) {
    res.cookies.set("did", crypto.randomUUID(), { httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 * 5 });
  }
  return res;
});

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
