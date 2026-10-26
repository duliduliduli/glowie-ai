import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="pt-safe sticky top-0 z-30 bg-background/80 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex min-h-11 items-center text-xl font-extrabold tracking-tight">
            Glowie<span className="text-accent">.</span>
          </Link>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/sign-up">Get started</Link>
            </Button>
          </div>
        </nav>
      </header>
      {children}
      <footer className="mx-auto max-w-6xl px-4 pt-10 pb-36 text-sm text-muted-foreground md:pb-12">
        <p>AI suggestions, not professional advice. Glowie is for adults 18+.</p>
        <div className="mt-3 flex flex-wrap gap-x-5">
          {[
            ["/privacy", "Privacy"],
            ["/terms", "Terms"],
            ["/cookies", "Cookies"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="inline-flex min-h-11 items-center hover:text-foreground">
              {label}
            </Link>
          ))}
        </div>
        <p className="mt-2">© {new Date().getFullYear()} Glowie</p>
      </footer>
    </div>
  );
}
