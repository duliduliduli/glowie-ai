"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

function consented() {
  try {
    return localStorage.getItem("cookie-consent") === "all";
  } catch {
    return false;
  }
}

function PageViews() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    posthog.capture("$pageview", { $current_url: window.location.href });
  }, [pathname, search]);
  return null;
}

/** PostHog, loaded only after the visitor accepts analytics cookies. */
export function Analytics() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!KEY) return;
    const init = () => {
      if (!consented() || posthog.__loaded) return;
      posthog.init(KEY, { api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com", capture_pageview: false, person_profiles: "identified_only" });
      setReady(true);
    };
    init();
    window.addEventListener("cookie-consent", init);
    return () => window.removeEventListener("cookie-consent", init);
  }, []);
  return ready ? (
    <Suspense fallback={null}>
      <PageViews />
    </Suspense>
  ) : null;
}
