import type { Metadata } from "next";
import Link from "next/link";
import { Camera, Palette, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BeforeAfterSlider } from "@/components/before-after";
import { PACKS, VIBES } from "@/lib/config";

export const metadata: Metadata = {
  title: "Glowie: AI stylist for outfits, hair & makeup",
  description:
    "Upload a selfie, pick a vibe, and preview yourself in personalised outfits, hairstyles and makeup. Seasonal colour analysis, face-shape tips and shoppable looks. Try one analysis free.",
  alternates: { canonical: "/" },
};

// Illustrated placeholders, not real people: a portrait silhouette with swappable hair/outfit/lip colours.
const portrait = (bg: string, hair: string, top: string, lips: string, hairUp = false) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
<defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs>
<rect width="400" height="500" fill="url(#b)"/>
${hairUp ? `<circle cx="200" cy="105" r="48" fill="${hair}"/>` : `<path d="M110 210 Q100 90 200 80 Q300 90 290 210 L300 360 L100 360 Z" fill="${hair}"/>`}
<path d="M60 500 Q70 380 200 370 Q330 380 340 500 Z" fill="${top}"/>
<rect x="178" y="300" width="44" height="70" rx="20" fill="#e7c2a8"/>
<ellipse cx="200" cy="215" rx="78" ry="98" fill="#efcdb4"/>
${hairUp ? `<path d="M122 190 Q130 120 200 118 Q270 120 278 190 Q240 150 200 152 Q160 150 122 190Z" fill="${hair}"/>` : `<path d="M122 200 Q140 120 200 118 Q262 120 278 200 Q250 150 200 146 Q150 150 122 200Z" fill="${hair}"/>`}
<ellipse cx="170" cy="215" rx="8" ry="5" fill="#3b2b26"/><ellipse cx="230" cy="215" rx="8" ry="5" fill="#3b2b26"/>
<path d="M183 266 Q200 278 217 266 Q200 284 183 266Z" fill="${lips}"/>
</svg>`)}`;

const EXAMPLES = [
  { vibe: "Old Money", before: portrait("#e9ebee", "#5a4636", "#9aa0a8", "#c98f86"), after: portrait("#efe6da", "#6b4e37", "#1f2a44", "#b0605e", true) },
  { vibe: "Soft Glam", before: portrait("#e9ebee", "#2d2420", "#c4c7cc", "#c99a90"), after: portrait("#f6e4e4", "#3a2a22", "#d9a7a9", "#c46a72") },
];

const STEPS = [
  { icon: Camera, title: "Snap a selfie", body: "Take a quick photo or upload one. Add a full-body shot for outfits." },
  { icon: Palette, title: "Find your colours", body: "Face shape, undertone, hair type and your seasonal palette in seconds." },
  { icon: Sparkles, title: "See your new look", body: "3 complete looks per vibe, with AI previews of you, routines and shopping links." },
];

const FAQ = [
  { q: "How much does it cost?", a: "Glowie is pay-as-you-go. Buy a credit pack, no subscription. An analysis is about 1 credit, a set of 3 looks about 2 credits, and each AI preview image about 2 credits. You always see the price before you tap." },
  { q: "Is there a free trial?", a: "Yes. Every new account gets one free analysis with looks for one vibe. Preview images need credits." },
  { q: "What happens to my photos?", a: "They're stored privately and only shown to you through short-lived signed links. Originals are deleted automatically after 30 days, or immediately if you choose. They are never used to train AI models." },
  { q: "Will the preview still look like me?", a: "That's the point. Glowie only edits your own photo and keeps your face, skin tone and features. We never change race or identity, or create celebrity lookalikes." },
  { q: "Is this professional advice?", a: "No. Glowie gives AI style suggestions for fun and inspiration, not professional, medical or dermatological advice." },
  { q: "Who can use Glowie?", a: "Adults 18 and over. Photos of children or of other people are not allowed." },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export default function Landing() {
  return (
    <main className="mx-auto max-w-6xl px-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="grid items-center gap-10 py-8 md:grid-cols-2 md:py-16">
        <div>
          <p className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">Your AI stylist</p>
          <h1 className="heading mt-4 text-5xl leading-[0.95] md:text-7xl">See your glow-up before you try it.</h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            Upload a selfie, pick a vibe, and get outfits, hair and makeup made for your colours and face shape, with AI previews of the new you.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/sign-up">Try it free</Link>
            </Button>
            <Button asChild size="lg" variant="white">
              <Link href="/home">Open app</Link>
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">1 free analysis on signup. No subscription.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {EXAMPLES.map((e) => (
            <figure key={e.vibe}>
              <BeforeAfterSlider before={e.before} after={e.after} alt={`${e.vibe} example`} />
              <figcaption className="mt-2 text-center text-sm font-semibold">{e.vibe}</figcaption>
            </figure>
          ))}
          <p className="col-span-2 text-center text-xs text-muted-foreground">Illustrated examples. Your previews are AI edits of your own photo.</p>
        </div>
      </section>

      <section className="py-10" aria-labelledby="how">
        <h2 id="how" className="heading text-3xl">How it works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-[28px] bg-card p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-2xl bg-muted">
                  <s.icon className="size-5" aria-hidden />
                </span>
                <span className="text-sm font-semibold text-muted-foreground">Step {i + 1}</span>
              </div>
              <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
              <p className="mt-1 text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="py-10" aria-labelledby="vibes">
        <h2 id="vibes" className="heading text-3xl">Pick your vibe</h2>
        <ul className="mt-6 flex flex-wrap gap-2">
          {VIBES.map((v) => (
            <li key={v.id} className="rounded-full bg-card px-4 py-2.5 font-semibold shadow-sm">
              {v.id === "custom" ? "Or describe your own" : v.label}
            </li>
          ))}
        </ul>
      </section>

      <section className="py-10" aria-labelledby="pricing">
        <h2 id="pricing" className="heading text-3xl">Simple pricing</h2>
        <p className="mt-2 text-muted-foreground">
          Pay as you go. Analysis ~1 credit, looks ~2 credits, each preview image ~2 credits. You only pay for what works: failed generations are never charged.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {PACKS.map((p) => (
            <div key={p.id} className={`rounded-[28px] p-6 shadow-sm ${p.id === "popular" ? "bg-primary text-primary-foreground" : "bg-card"}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{p.name}</h3>
                {"badge" in p && <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">{p.badge}</span>}
              </div>
              <p className="mt-3 text-4xl font-extrabold">${(p.usdCents / 100).toFixed(2)}</p>
              <p className="mt-1 opacity-70">
                {p.credits} credits · ${(p.usdCents / 100 / p.credits).toFixed(3)} per credit
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm font-semibold">1 free analysis on signup.</p>
      </section>

      <section className="py-10" aria-labelledby="faq">
        <h2 id="faq" className="heading text-3xl">FAQ</h2>
        <div className="mt-6 space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-[28px] bg-card px-6 shadow-sm">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between font-bold">
                {f.q}
                <span className="ml-4 text-xl transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="pb-5 text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="my-10 rounded-[28px] bg-primary p-8 text-center text-primary-foreground md:p-12">
        <h2 className="heading text-3xl md:text-4xl">Ready to glow?</h2>
        <p className="mt-2 opacity-70">Your first analysis is on us.</p>
        <Button asChild size="lg" variant="white" className="mt-6">
          <Link href="/sign-up">Get started</Link>
        </Button>
      </section>
    </main>
  );
}
