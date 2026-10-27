import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getShareLink } from "@/lib/sharing";
import { PUBLIC_TTL, signedUrl } from "@/lib/storage";
import { LookSchema, RoastSchema } from "@/lib/ai";
import { TAGLINE } from "@/lib/config";
import { Button } from "@/components/ui/button";

export async function generateMetadata({ params }: PageProps<"/c/[token]">): Promise<Metadata> {
  const { token } = await params;
  return { title: "A Glowie card", robots: { index: false }, openGraph: { images: [`/c/${token}/image`] } };
}

/** Public stylist handoff / roast card. Shows only AI previews or the photo the owner chose to share. */
export default async function CardPage({ params }: PageProps<"/c/[token]">) {
  const { token } = await params;
  const link = await getShareLink(token);
  if (!link) notFound();
  let body;
  if (link.kind === "stylist") {
    const row = await db.look.findUnique({ where: { id: link.refId } });
    if (!row) notFound();
    const look = LookSchema.parse(row.data);
    const ref = (row.hairStages as { photoId: string }[] | null)?.[0]?.photoId ?? row.previewId;
    body = (
      <>
        <p className="text-sm font-semibold text-accent">For my stylist</p>
        <h1 className="heading text-2xl">{look.hair.style}</h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {ref ? <img src={signedUrl(ref, PUBLIC_TTL)} alt="Reference: AI preview of this hairstyle on me" className="aspect-[4/5] w-full rounded-[24px] object-cover" /> : null}
        <dl className="grid grid-cols-[6rem_1fr] gap-y-2 rounded-[24px] bg-card p-5 text-sm shadow-sm">
          {Object.entries(look.hair.salon).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-semibold capitalize">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm">{look.hair.stylistNote}</p>
        <p className="text-xs text-muted-foreground">Reference image is an AI preview, not a real photo of a finished cut.</p>
      </>
    );
  } else {
    const roast = await db.roast.findUnique({ where: { id: link.refId } });
    if (!roast) notFound();
    const r = RoastSchema.parse(roast.result);
    body = (
      <>
        <p className="text-sm font-semibold text-accent">Roast my fit · {r.score}/10</p>
        <h1 className="heading text-2xl">{r.headline}</h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={signedUrl(roast.photoId, PUBLIC_TTL)} alt="The outfit" className="aspect-[4/5] w-full rounded-[24px] object-cover" />
        <div className="space-y-2 rounded-[24px] bg-card p-5 text-sm shadow-sm">
          <p className="font-semibold">What works</p>
          <ul className="list-disc pl-5">{r.whatWorks.map((w) => <li key={w}>{w}</li>)}</ul>
          <p className="pt-2 font-semibold">Quick fixes</p>
          <ul className="list-disc pl-5">{r.quickFixes.map((w) => <li key={w}>{w}</li>)}</ul>
          <p className="pt-2">{r.verdict}</p>
        </div>
      </>
    );
  }
  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-8">
      {body}
      <div className="space-y-2 rounded-[24px] bg-primary p-5 text-primary-foreground">
        <p className="font-bold">{TAGLINE}</p>
        <Button asChild variant="white" className="w-full">
          <Link href="/sign-up">Try Glowie free</Link>
        </Button>
      </div>
    </main>
  );
}
