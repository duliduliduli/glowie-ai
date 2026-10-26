import { NextResponse } from "next/server";

/** Referral link: remember the code for 30 days, then send them to sign up. */
export async function GET(req: Request, ctx: RouteContext<"/r/[code]">) {
  const { code } = await ctx.params;
  const res = NextResponse.redirect(new URL("/sign-up", req.url));
  if (/^[A-Z0-9]{4,12}$/.test(code)) res.cookies.set("ref", code, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
