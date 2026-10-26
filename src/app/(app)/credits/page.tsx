import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBalance } from "@/lib/ledger";
import { estimateCredits } from "@/lib/openrouter";
import { PACKS, REFERRAL_CREDITS } from "@/lib/config";
import { PageHeader } from "@/components/page-header";
import { AutoTopUp, BuyButton, PaidToast, ReferralCard } from "./client";

export const metadata = { title: "Credits" };

export default async function CreditsPage({ searchParams }: PageProps<"/credits">) {
  const user = await requireUser();
  const [{ available, held }, entries, analysis, looks, image] = await Promise.all([
    getBalance(user.id),
    db.ledgerEntry.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    estimateCredits("analysis"),
    estimateCredits("looks"),
    estimateCredits("image"),
  ]);
  const paid = (await searchParams).paid === "1";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="space-y-6">
      {paid ? <PaidToast /> : null}
      <PageHeader title="Credits" subtitle="Prepaid, pay as you go. No subscription." />

      <section className="rounded-[28px] bg-primary p-6 text-primary-foreground">
        <p className="text-sm text-white/70">Available</p>
        <p className="text-5xl font-extrabold tabular-nums">{available}</p>
        {held ? <p className="text-xs text-white/60">{held} reserved for a generation in progress</p> : null}
        <dl className="mt-4 grid grid-cols-3 gap-2 text-xs text-white/80">
          <div><dt>Analysis</dt><dd className="font-semibold text-white">≤ {analysis} cr</dd></div>
          <div><dt>3 looks</dt><dd className="font-semibold text-white">≤ {looks} cr</dd></div>
          <div><dt>Preview image</dt><dd className="font-semibold text-white">≤ {image} cr</dd></div>
        </dl>
      </section>

      {user.purchasesBlocked ? (
        <p className="rounded-[28px] bg-accent-soft p-5 text-sm">Purchases are disabled on this account. Contact support if you think this is a mistake.</p>
      ) : (
        <section className="space-y-3">
          <h2 className="heading text-lg">Buy credits</h2>
          {PACKS.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-[24px] bg-card p-4 shadow-sm">
              <div>
                <p className="font-bold">{p.name} · {p.credits} credits</p>
                <p className="text-sm text-muted-foreground">{"badge" in p ? <span className="font-semibold text-accent">{p.badge} · </span> : null}Apple Pay, Google Pay or card</p>
              </div>
              <BuyButton packId={p.id} label={`$${(p.usdCents / 100).toFixed(2)}`} />
            </div>
          ))}
          <p className="px-2 text-xs text-muted-foreground">You&apos;re charged actual AI cost, never more than the price shown before each action. Failed generations are free.</p>
        </section>
      )}

      {user.stripeCustomerId && !user.purchasesBlocked ? (
        <AutoTopUp packId={user.autoTopUpPackId} below={user.autoTopUpBelow ?? 10} packs={PACKS.map((p) => ({ id: p.id, label: `${p.name} ($${(p.usdCents / 100).toFixed(2)})` }))} />
      ) : null}

      <ReferralCard url={`${appUrl}/r/${user.referralCode}`} credits={REFERRAL_CREDITS} />

      <section className="space-y-3">
        <h2 className="heading text-lg">History</h2>
        {entries.length ? (
          <ul className="divide-y rounded-[24px] bg-card px-4 shadow-sm">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium capitalize">{e.note ?? e.type.replace("_", " ")}</p>
                  <p className="text-xs text-muted-foreground">{e.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
                </div>
                <span className={e.amount > 0 ? "font-semibold text-emerald-700 tabular-nums" : "font-semibold tabular-nums"}>
                  {e.amount > 0 ? "+" : ""}{e.amount}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[24px] bg-card p-5 text-sm text-muted-foreground">No transactions yet.</p>
        )}
      </section>
    </div>
  );
}
