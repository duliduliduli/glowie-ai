"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, o: { sitekey: string; callback: (t: string) => void }) => string };
  }
}

export function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (t: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if ((loaded || window.turnstile) && el.current && !el.current.hasChildNodes()) window.turnstile?.render(el.current, { sitekey: siteKey, callback: onToken });
  }, [loaded, siteKey, onToken]);
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setLoaded(true)} />
      <div ref={el} className="min-h-16" />
    </>
  );
}
