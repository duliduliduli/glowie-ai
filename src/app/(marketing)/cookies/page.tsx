// Template content: have a lawyer review before launch (ePrivacy/consent rules vary by jurisdiction).
import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Cookie Policy", alternates: { canonical: "/cookies" } };

export default function Cookies() {
  return (
    <LegalPage title="Cookie Policy">
      <p>We keep cookies to a minimum. There are only two kinds.</p>

      <h2>Essential</h2>
      <ul>
        <li>Sign-in session cookies from Clerk, so you stay logged in.</li>
        <li>A device identifier, used to allow one free trial per device and prevent abuse.</li>
        <li>A referral cookie when you arrive through a friend&apos;s invite link.</li>
        <li>Cloudflare Turnstile and Stripe may set cookies needed for bot protection and secure payments.</li>
      </ul>
      <p>These are required for Glowie to work and can&apos;t be turned off.</p>

      <h2>Analytics (optional)</h2>
      <p>If you choose &quot;Accept&quot;, PostHog sets cookies to help us understand which features are used so we can improve them. If you choose &quot;Essential only&quot;, analytics cookies are not set.</p>

      <h2>Changing your choice</h2>
      <p>Clear this site&apos;s data in your browser settings and you&apos;ll be asked again on your next visit.</p>
    </LegalPage>
  );
}
