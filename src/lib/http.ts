import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { GuardError } from "./guards";
import { AccountFrozenError, InsufficientCreditsError } from "./ledger";

/** Maps known errors to JSON responses; everything else is a 500 with a friendly message. */
export async function handle(fn: () => Promise<unknown>) {
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    if (e instanceof GuardError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof InsufficientCreditsError)
      return NextResponse.json({ error: `You need ${e.needed} credits (you have ${e.available}).`, code: "insufficient_credits" }, { status: 402 });
    if (e instanceof AccountFrozenError) return NextResponse.json({ error: "Your account is on hold. Contact support." }, { status: 403 });
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "Something went wrong. You weren't charged." }, { status: 500 });
  }
}
