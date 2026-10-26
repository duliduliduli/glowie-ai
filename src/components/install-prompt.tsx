"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = "install-dismissed";

export function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {}
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    if (standalone) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- platform detection needs the browser
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setEvent(null);
    setIos(false);
  };

  if (!event && !ios) return null;

  return (
    <div className="relative rounded-[28px] bg-card p-5 pr-14 shadow-sm">
      <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={dismiss} aria-label="Dismiss">
        <X />
      </Button>
      <p className="font-bold">Add Glowie to your home screen</p>
      {event ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">Open it like an app, one tap away.</p>
          <Button
            className="mt-3"
            onClick={async () => {
              await event.prompt();
              await event.userChoice;
              dismiss();
            }}
          >
            Install
          </Button>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          Tap <span className="font-semibold text-foreground">Share</span> then <span className="font-semibold text-foreground">Add to Home Screen</span>.
        </p>
      )}
    </div>
  );
}
