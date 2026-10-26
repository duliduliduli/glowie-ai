import { requireUser, verifiedPhone } from "@/lib/auth";
import { getBalance } from "@/lib/ledger";
import { estimateCredits } from "@/lib/openrouter";
import { EVENT_VIBE, VIBES } from "@/lib/config";
import { NewLookFlow } from "./flow";

export const metadata = { title: "New look" };

export default async function NewPage({ searchParams }: PageProps<"/new">) {
  const user = await requireUser();
  const { vibe } = await searchParams;
  const trial = !user.trialUsedAt;
  const [{ available }, analysis, looks, image, phone] = await Promise.all([
    getBalance(user.id),
    estimateCredits("analysis"),
    estimateCredits("looks"),
    estimateCredits("image"),
    trial ? verifiedPhone(user.clerkId) : null,
  ]);
  return (
    <NewLookFlow
      initialVibe={vibe === EVENT_VIBE || VIBES.some((v) => v.id === vibe) ? (vibe as string) : null}
      prices={{ analysis, looks, image }}
      balance={available}
      freePreviews={user.freePreviews}
      trial={trial}
      phoneVerified={!!phone}
      turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null}
    />
  );
}
