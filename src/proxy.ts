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
  "/api/stripe/webhook",
  "/api/cron/(.*)",
  "/api/img/(.*)",
  "/manifest.webmanifest",
  "/opengraph-image(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
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
