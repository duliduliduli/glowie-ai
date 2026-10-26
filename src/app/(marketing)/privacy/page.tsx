// Template content: have a lawyer review before launch (GDPR/CCPA/BIPA obligations depend on your jurisdiction).
import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

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
      </ul>

      <h2>How we handle your photos</h2>
      <ul>
        <li>Photos are stored privately (Vercel Blob) and are only shown to you through short-lived signed links.</li>
        <li>Original photos are deleted automatically after 30 days. You can choose to delete them immediately after your looks are ready.</li>
        <li>To analyse and edit a photo we send it to AI providers through OpenRouter with data collection disabled. Your photos are never used to train AI models, by us or by them.</li>
        <li>Every photo is automatically checked for safety (real person, one face, adult, no nudity). We do not use photos to identify you.</li>
      </ul>

      <h2>Why we use your data</h2>
      <ul>
        <li>To provide the service: analysis, recommendations, previews, your lookbook and credit balance.</li>
        <li>To keep Glowie safe: fraud prevention, rate limits, bot checks (Cloudflare Turnstile), and enforcing our Terms.</li>
        <li>To improve the product with aggregated analytics, only if you accept analytics cookies.</li>
        <li>To send service emails (Resend), such as receipts and account notices.</li>
      </ul>

      <h2>Service providers</h2>
      <p>We share data only with providers that help us run Glowie: Clerk (accounts), Stripe (payments and fraud screening), OpenRouter and the model providers it routes to (AI processing), Vercel (hosting and photo storage), Neon (database), Upstash (rate limiting), PostHog (analytics), Sentry (error monitoring), Resend (email) and Cloudflare Turnstile (bot protection). We do not sell your personal data.</p>

      <h2>Retention and deletion</h2>
      <p>You can delete your account at any time in Settings. This permanently removes your photos, generated images, looks, history and profile. We keep minimal payment records where the law requires it.</p>

      <h2>Your rights</h2>
      <p>Depending on where you live, you may have the right to access, correct, export or delete your data, and to object to certain processing. Contact us at privacy@glowupai.app.</p>

      <h2>Age</h2>
      <p>Glowie is only for adults 18 and over. We do not knowingly collect data from anyone under 18, and photos of minors are rejected.</p>

      <h2>Changes</h2>
      <p>If we make material changes we will update this page and, where appropriate, let you know by email.</p>
    </LegalPage>
  );
}
