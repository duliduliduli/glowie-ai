import type { Metadata } from "next";
import Link from "next/link";
import { CalendarHeart, Camera, Clapperboard, Flame, Images, Palette, PartyPopper, Scissors, ShoppingBag, Sparkles, Timer, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BeforeAfterSlider } from "@/components/before-after";
import { PACKS, TAGLINE, VIBES } from "@/lib/config";

export const metadata: Metadata = {
  title: "Glowie: try the look before you book it",
  description:
    "See new hair, makeup and outfits on your own photo before the salon. No subscription, ever: credits never expire and a full glowup costs about $1. Try it free.",
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
  { vibe: "Date Night", before: portrait("#e9ebee", "#2d2420", "#c4c7cc", "#c99a90"), after: portrait("#f6e4e4", "#3a2a22", "#d9a7a9", "#c46a72") },
];

const PROOF = [
  { big: "$0/mo", small: "No subscription, ever" },
  { big: "Forever", small: "Credits never expire" },
  { big: "~$1", small: "A full glowup. Less than one week of the other apps." },
];

const STEPS = [
  { icon: Camera, title: "Selfie coach", body: "We score your lighting, angle and framing before you spend a cent, so previews come out right." },
  { icon: Palette, title: "Your analysis", body: "Face shape, undertone, seasonal colour palette and hair type." },
  { icon: Wand2, title: "Looks on you", body: "3 complete looks per vibe: hair, makeup and outfit, previewed on your own photo." },
];

const FEATURES = [
  { icon: Camera, title: "Selfie coach", body: "A photo score with quick tips, before any credits are used." },
  { icon: Palette, title: "Colour analysis", body: "Your season, best colours, neutrals and what to skip." },
  { icon: Images, title: "3 looks on you", body: "Before/after slider for every look, on your real photo." },
  { icon: Timer, title: "Hair regret simulator", body: "See it at week 1, month 3 and month 6, plus yearly upkeep cost and salon time." },
  { icon: Scissors, title: "Stylist handoff card", body: "Salon-ready level, tone, technique and cut, with the reference on your own face." },
  { icon: Flame, title: "Roast my fit", body: "An honest score and quick fixes for any outfit. Shareable, if you dare." },
  { icon: ShoppingBag, title: "Shop the look", body: "The same look at about $50, $200 or $800." },
  { icon: PartyPopper, title: "Glowup Party", body: "Send two looks to friends. They vote, no account needed." },
  { icon: CalendarHeart, title: "Event mode", body: "\"Get me ready for Saturday\": weather, dress code, full look and a packing list." },
  { icon: Sparkles, title: "Story cards", body: "Auto 9:16 before/after images for Instagram and TikTok." },
  { icon: Clapperboard, title: "Animated look", body: "A 3-second video of your new look, for up to 5 credits." },
];

const FAQ = [
  { q: "Is there a subscription?", a: "Never. You buy a credit pack when you want one, starting at $2.99. Nothing renews." },
  { q: "Do credits expire?", a: "No. Credits stay on your account until you use them." },
  { q: "How much does a glowup cost?", a: "A full session (analysis, 3 looks and 3 previews of you) is usually about $1. An extra preview is about $0.35, and an animated video is up to $0.50. You always see the maximum price before you tap, and you're charged actual cost, often less." },
  { q: "What if a generation fails?", a: "You're not charged. Credits are only held while the AI works and are released in full if anything fails." },
  { q: "Is there a free trial?", a: "Yes: a free analysis, 3 looks and 1 real preview of you. Voting in a friend's Glowup Party gets you 1 more free preview." },
  { q: "Why do you ask for my phone number?", a: "Only to keep the free trial to one per person. We never use it for marketing." },
  { q: "What happens to my photos?", a: "They're private and only shown to you through links that expire. Originals are deleted after 30 days, or immediately if you choose. They are never used to train AI. Anything you share (a stylist card, a roast, a party) shows only what you picked, and you can turn the link off any time." },
  { q: "Will the preview still look like me?", a: "That's the point. Glowie only edits your own photo and keeps your face, skin tone and features. We never change race or identity, or create celebrity lookalikes." },
  { q: "Can I get a refund?", a: "Unused credits aren't refundable except where the law requires it. Failed generations are never charged." },
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
          <p className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">No subscription, ever</p>
          <h1 className="heading mt-4 text-5xl leading-[0.95] md:text-7xl">{TAGLINE.split(". ")[0]}.</h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            See new hair, makeup and outfits on your own photo before the salon or the checkout. {TAGLINE.split(". ")[1]}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/sign-up">Try it free</Link>
            </Button>
            <Button asChild size="lg" variant="white">
              <Link href="/home">Open app</Link>
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Free analysis + 1 free preview of you on signup.</p>
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

      <section aria-label="Why Glowie" className="grid gap-3 sm:grid-cols-3">
        {PROOF.map((p) => (
          <div key={p.big} className="rounded-[28px] bg-card p-6 shadow-sm">
            <p className="text-4xl font-extrabold">{p.big}</p>
            <p className="mt-1 text-muted-foreground">{p.small}</p>
          </div>
        ))}
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

      <section className="py-10" aria-labelledby="features">
        <h2 id="features" className="heading text-3xl">Everything in one glowup</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex gap-4 rounded-[24px] bg-card p-5 shadow-sm">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
                <f.icon className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-bold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="py-10" aria-labelledby="vibes">
        <h2 id="vibes" className="heading text-3xl">Pick your vibe</h2>
        <ul className="mt-6 flex flex-wrap gap-2">
          {VIBES.map((v) => (
            <li key={v.id} className="rounded-full bg-card px-4 py-2.5 font-semibold shadow-sm">
              {v.id === "custom" ? "Or describe your own" : v.label}
            </li>
          ))}
          <li className="rounded-full bg-primary px-4 py-2.5 font-semibold text-primary-foreground">Event mode</li>
        </ul>
      </section>

      <section className="py-10" aria-labelledby="pricing">
        <h2 id="pricing" className="heading text-3xl">No subscription, ever</h2>
        <p className="mt-2 text-muted-foreground">
          Buy credits when you want them. Credits never expire. A full session is about $1, an extra preview about $0.35, an animated video up to $0.50. Failed generations are never charged.
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
                {p.credits} credits · ${(p.usdCents / 100 / p.credits).toFixed(3)} per credit · never expire
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm font-semibold">Free trial: an analysis, 3 looks and 1 real preview of you.</p>
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
        <h2 className="heading text-3xl md:text-4xl">Try the look before you book it</h2>
        <p className="mt-2 opacity-70">Your first analysis and preview are on us. AI suggestions, not professional advice.</p>
        <Button asChild size="lg" variant="white" className="mt-6">
          <Link href="/sign-up">Get started free</Link>
        </Button>
      </section>
    </main>
  );
}
