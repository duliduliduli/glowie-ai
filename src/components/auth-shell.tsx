import Link from "next/link";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <Link href="/" className="text-3xl font-extrabold tracking-tight">
        Glowie<span className="text-accent">.</span>
      </Link>
      {children}
      <p className="max-w-sm text-center text-sm text-muted-foreground">
        18+ only. By continuing you agree to our{" "}
        <Link href="/terms" className="font-semibold text-foreground underline underline-offset-4">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="font-semibold text-foreground underline underline-offset-4">
          Privacy Policy
        </Link>
        .
      </p>
    </main>
  );
}
