import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@/components/analytics";
import { CookieNotice } from "@/components/cookie-notice";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });

const url = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: { default: "Glowie: your AI stylist for outfits, hair & makeup", template: "%s · Glowie" },
  description:
    "Upload a selfie, pick a vibe, and see yourself in personalised outfits, hairstyles and makeup. Seasonal colour analysis, face-shape tips and shoppable looks.",
  applicationName: "Glowie",
  appleWebApp: { capable: true, title: "Glowie", statusBarStyle: "default" },
  openGraph: { type: "website", siteName: "Glowie" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#f2f3f5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
        <body className="min-h-full bg-background">
          {children}
          <Toaster position="top-center" />
          <CookieNotice />
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
