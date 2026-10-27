// Template content: have a lawyer review before launch (GDPR/CCPA/BIPA obligations depend on your jurisdiction).
import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { APP_DOMAIN } from "@/lib/config";

export const metadata: Metadata = { title: "Privacy Policy", alternates: { canonical: "/privacy" } };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>Glowie (&quot;we&quot;) helps you explore outfits, hair and makeup with AI. This policy explains what we collect, why, and the choices you have.</p>

      <h2>What we collect</h2>
      <ul>
        <li>Account details: your email and sign-in method, handled by Clerk.</li>
        <li>Photos you upload or take with your camera, and the AI preview images made from them.</li>
        <li>Your style answers (vibe, occasion, budget, features to highlight) and the analysis and looks we generate.</li>
        <li>Payment records: pack, amount and status. Card details are handled by Stripe and never reach our servers.</li>
        <li>Basic usage and error data (PostHog, Sentry) and a device identifier used to limit free trials to one per device.</li>
        <li>Your phone number, verified by Clerk, used only to keep the free trial to one per person. We store a one-way hash of it for this check and never use it for marketing.</li>
        <li>For Event mode, the event description, date, budget and city you type. The place you type is sent to Open-Meteo to look up the weather; use just a city if you prefer.</li>
      </ul>

      <h2>How we handle your photos</h2>
      <ul>
        <li>Photos are stored privately (Vercel Blob) and are only shown to you through short-lived signed links.</li>
        <li>Original photos (selfies, full-body and outfit photos) are deleted automatically after 30 days. You can choose to delete them immediately after your looks are ready. AI previews, hair previews and videos stay in your account until you delete them in Settings, and deleting them also turns off any public links to them.</li>
        <li>To analyse and edit a photo we send it to AI providers through OpenRouter with data collection disabled. We ask providers not to store or train on your photos and we never use them to train models. Video providers are chosen by OpenRouter and set their own handling, so check the video note below.</li>
        <li>Animated look videos are made by sending your AI preview image to a video model through OpenRouter, using a link that expires after 15 minutes. These video providers apply their own data policies.</li>
        <li>Every photo is automatically checked for safety (real person, one face, adult, no nudity). We compare your photos with each other to confirm they show the same person (so Glowie only styles you). We do not keep face templates and do not use photos to identify you anywhere else.</li>
      </ul>

      <h2>Things you choose to share</h2>
      <ul>
        <li>Stylist cards, roast cards and Glowup Party pages are public links that anyone with the link can open. They show only what you picked: AI previews of your looks, or the outfit photo you chose to roast. Party pages never show your original photo.</li>
        <li>You can turn any link off at any time; its images stop loading within a few minutes. Deleting your account removes them all.</li>
        <li>Party votes are anonymous. We store a one-way hash of the voter&apos;s device identifier to allow one vote per device.</li>
      </ul>

      <h2>Why we use your data</h2>
      <ul>
        <li>To provide the service: analysis, recommendations, previews, your lookbook and credit balance.</li>
        <li>To keep Glowie safe: fraud prevention, rate limits, bot checks (Cloudflare Turnstile), and enforcing our Terms.</li>
        <li>To improve the product with aggregated analytics, only if you accept analytics cookies.</li>
        <li>To send service emails (Resend), such as receipts and account notices.</li>
      </ul>

      <h2>Service providers</h2>
      <p>We share data only with providers that help us run Glowie: Clerk (accounts), Stripe (payments and fraud screening), OpenRouter and the image, text and video model providers it routes to (AI processing), Open-Meteo (weather for Event mode), Vercel (hosting and photo storage), Neon (database), Upstash (rate limiting), PostHog (analytics), Sentry (error monitoring), Resend (email) and Cloudflare Turnstile (bot protection). We do not sell your personal data.</p>

      <h2>Retention and deletion</h2>
      <p>You can delete your account at any time in Settings. This permanently removes your photos, generated images, looks, history and profile. We keep minimal payment records where the law requires it, and the one-way hashes of your device and phone number used to stop the free trial being claimed twice. Your Stripe customer profile is deleted too; analytics and error-monitoring providers may keep their own copies for a limited time.</p>

      <h2>Your rights</h2>
      <p>Depending on where you live, you may have the right to access, correct, export or delete your data, and to object to certain processing. Contact us at privacy@{APP_DOMAIN}.</p>

      <h2>Age</h2>
      <p>Glowie is only for adults 18 and over. We do not knowingly collect data from anyone under 18, and photos of minors are rejected.</p>

      <h2>Changes</h2>
      <p>If we make material changes we will update this page and, where appropriate, let you know by email.</p>
    </LegalPage>
  );
}
