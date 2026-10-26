"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const KEY = "cookie-consent";

export function CookieNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
      setOpen(!localStorage.getItem(KEY));
    } catch {
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  const choose = (value: "all" | "essential") => {
    try {
      localStorage.setItem(KEY, value);
    } catch {}
    window.dispatchEvent(new Event("cookie-consent"));
    setOpen(false);
  };

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-4 z-40 mx-auto max-w-md rounded-[28px] bg-card p-4 shadow-lg ring-1 ring-border bottom-[calc(96px+env(safe-area-inset-bottom))] md:bottom-6"
    >
      <p className="text-sm text-muted-foreground">
        We use essential cookies to keep you signed in, and optional analytics to improve Glowie.{" "}
        <Link href="/cookies" className="font-semibold text-foreground underline underline-offset-4">
          Learn more
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <Button className="flex-1" onClick={() => choose("all")}>
          Accept
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => choose("essential")}>
          Essential only
        </Button>
      </div>
    </div>
  );
}
