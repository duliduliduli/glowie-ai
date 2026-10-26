import type { Metadata } from "next";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getParty } from "@/lib/sharing";
import { signedUrl } from "@/lib/storage";
import { PARTY_VOTER_FREE_PREVIEWS } from "@/lib/config";
import type { Look } from "@/lib/ai";
import { Ballot } from "./ballot";

export const metadata: Metadata = { title: "Glowup Party: which look?", robots: { index: false } };

/** Public vote page. Shows only the two AI previews the host picked, never their original photo. */
export default async function PartyPage({ params }: PageProps<"/p/[token]">) {
  const { token } = await params;
  const data = await getParty(token);
  if (!data) notFound();
  const did = (await cookies()).get("did")?.value;
  const voted = did
    ? await db.partyVote.findUnique({ where: { partyId_voterHash: { partyId: data.party.id, voterHash: createHash("sha256").update(did).digest("hex") } } })
    : null;
  const { userId } = await auth();
  const isHost = !!userId && (await db.user.findUnique({ where: { clerkId: userId } }))?.id === data.party.userId;
  const looks = data.looks.map((l) => ({ title: (l.data as Look).title, image: signedUrl(l.previewId!) }));

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 py-8">
      <div>
        <p className="text-sm font-semibold text-accent">Glowup Party</p>
        <h1 className="heading text-3xl">Which look should I go with?</h1>
        <p className="text-sm text-muted-foreground">Tap your favourite. No account needed. Previews are AI-generated.</p>
      </div>
      <Ballot token={token} looks={looks} tally={data.tally} voted={voted?.choice ?? null} isHost={isHost} bonus={PARTY_VOTER_FREE_PREVIEWS} />
    </main>
  );
}
