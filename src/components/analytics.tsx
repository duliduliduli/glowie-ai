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
    // /c/<token> and /p/<token> are bearer links: send the route, not the token.
    const url = new URL(window.location.href);
    url.pathname = url.pathname.replace(/^\/(c|p)\/[^/]+/, "/$1/[token]");
    posthog.capture("$pageview", { $current_url: url.toString() });
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
