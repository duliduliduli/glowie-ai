import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { confirmAge } from "../actions";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Welcome" };

export default async function WelcomePage() {
  const user = await requireUser({ allowUnconfirmedAge: true });
  if (user.ageConfirmedAt) redirect("/home");
  return (
    <div className="flex min-h-[80dvh] flex-col justify-center gap-6">
      <div className="rounded-[28px] bg-card p-6 shadow-sm">
        <p className="text-sm font-semibold text-accent">Welcome to Glowie</p>
        <h1 className="heading mt-1 text-3xl">One quick thing</h1>
        <p className="mt-3 text-muted-foreground">
          Glowie is for adults. Your first colour and style analysis is on us, no card needed.
        </p>
        <form action={confirmAge} className="mt-6 space-y-5">
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input type="checkbox" name="adult" required className="mt-0.5 size-5 accent-[var(--primary)]" />
            <span>I confirm I am 18 or older and agree to the <a className="underline" href="/terms">Terms</a> and <a className="underline" href="/privacy">Privacy Policy</a>.</span>
          </label>
          <Button size="lg" className="w-full">Continue</Button>
        </form>
      </div>
    </div>
  );
}
