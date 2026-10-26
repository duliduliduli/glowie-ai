import { NextResponse } from "next/server";

/** From a Glowup Party: remember the party so the voter's free preview is added when they claim their trial. */
export async function GET(req: Request, ctx: RouteContext<"/p/[token]/join">) {
  const { token } = await ctx.params;
  const res = NextResponse.redirect(new URL("/sign-up", req.url));
  if (/^[\w-]{8,32}$/.test(token)) res.cookies.set("party", token, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
