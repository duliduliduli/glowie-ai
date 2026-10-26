import { requireUser } from "@/lib/auth";
import { getBalance } from "@/lib/ledger";
import { estimateCredits } from "@/lib/openrouter";
import { VIBES } from "@/lib/config";
import { NewLookFlow } from "./flow";

export const metadata = { title: "New look" };

export default async function NewPage({ searchParams }: PageProps<"/new">) {
  const user = await requireUser();
  const { vibe } = await searchParams;
  const [{ available }, analysis, looks, image] = await Promise.all([
    getBalance(user.id),
    estimateCredits("analysis"),
    estimateCredits("looks"),
    estimateCredits("image"),
  ]);
  return (
    <NewLookFlow
      initialVibe={VIBES.some((v) => v.id === vibe) ? (vibe as string) : null}
      prices={{ analysis, looks, image }}
      balance={available}
      trial={!user.trialUsedAt}
      turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null}
    />
  );
}
