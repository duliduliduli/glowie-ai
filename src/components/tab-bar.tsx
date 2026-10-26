"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Images, Plus, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/lookbook", label: "Lookbook", icon: Images },
  { href: "/credits", label: "Credits", icon: Sparkles },
  { href: "/settings", label: "Profile", icon: User },
];

/** Tabs are destinations; "New look" is a separate action button in the middle (HIG: don't make a tab an action). */
export function TabBar() {
  const path = usePathname();
  const tab = (t: (typeof TABS)[number]) => {
    const active = path.startsWith(t.href);
    return (
      <Link
        key={t.href}
        href={t.href}
        aria-current={active ? "page" : undefined}
        className={cn("flex min-h-11 min-w-16 flex-col items-center justify-center gap-1 text-[13px]", active ? "font-semibold text-foreground" : "text-muted-foreground")}
      >
        <t.icon className="size-6" strokeWidth={active ? 2.4 : 1.8} aria-hidden />
        {t.label}
      </Link>
    );
  };
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 rounded-t-[36px] bg-card/95 pb-safe pt-3 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-around px-2">
        {TABS.slice(0, 2).map(tab)}
        <Link
          href="/new"
          aria-label="New look"
          className="-mt-8 grid size-[72px] place-items-center rounded-full bg-gradient-to-b from-white to-neutral-200 shadow-lg"
        >
          <span className="grid size-14 place-items-center rounded-full bg-primary text-primary-foreground">
            <Plus className="size-7" aria-hidden />
          </span>
        </Link>
        {TABS.slice(2).map(tab)}
      </div>
    </nav>
  );
}
