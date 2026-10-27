import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { openRouterBalance } from "@/lib/openrouter";
import { CREDIT_USD, MARKUP } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { AdjustForm } from "./adjust-form";
import { unfreeze } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-3xl bg-card p-5 shadow-sm [overflow-wrap:anywhere] ${className}`}>
      <h2 className="heading mb-3 text-sm text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default async function AdminPage() {
  await requireAdmin();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const windows = [
    { label: "Today", since: startOfDay },
    { label: "7 days", since: daysAgo(7) },
    { label: "30 days", since: daysAgo(30) },
    { label: "All time", since: new Date(0) },
  ];

  const [periods, liability, orBalance, failedCount, failures, purchases, frozen, activeHolds, daily] = await Promise.all([
    Promise.all(
      windows.map(async (w) => {
        const [rev, spend] = await Promise.all([
          db.ledgerEntry.aggregate({ where: { type: "purchase", createdAt: { gte: w.since } }, _sum: { usdCents: true } }),
          db.aiCall.aggregate({ where: { createdAt: { gte: w.since } }, _sum: { costUsd: true } }),
        ]);
        return { ...w, revenue: (rev._sum.usdCents ?? 0) / 100, spend: spend._sum.costUsd ?? 0 };
      }),
    ),
    db.ledgerEntry.aggregate({ _sum: { amount: true } }),
    openRouterBalance().catch(() => null),
    db.aiCall.count({ where: { status: "failed", createdAt: { gte: daysAgo(1) } } }),
    db.aiCall.findMany({ where: { status: "failed" }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.ledgerEntry.findMany({ where: { type: "purchase" }, orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { email: true } } } }),
    db.user.findMany({ where: { frozenAt: { not: null } }, orderBy: { frozenAt: "desc" }, take: 50 }),
    db.creditHold.count({ where: { status: "active" } }),
    db.$queryRaw<{ day: Date; revenue: number; spend: number }[]>`
      SELECT d.day::date AS day,
        COALESCE((SELECT SUM("usdCents") FROM "LedgerEntry" WHERE type = 'purchase' AND "createdAt" >= d.day AND "createdAt" < d.day + interval '1 day'), 0)::float / 100 AS revenue,
        COALESCE((SELECT SUM("costUsd") FROM "AiCall" WHERE "createdAt" >= d.day AND "createdAt" < d.day + interval '1 day'), 0)::float AS spend
      FROM generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') AS d(day)
      ORDER BY d.day DESC`,
  ]);

  const since30 = daysAgo(30);
  const [byRole, trials, parties, votes, roasts, freePreviews] = await Promise.all([
    db.aiCall.groupBy({ by: ["role"], where: { createdAt: { gte: since30 } }, _sum: { costUsd: true, credits: true }, _count: true }),
    db.user.count({ where: { trialUsedAt: { gte: since30 } } }),
    db.party.count({ where: { createdAt: { gte: since30 } } }),
    db.partyVote.count({ where: { createdAt: { gte: since30 } } }),
    db.roast.count({ where: { createdAt: { gte: since30 } } }),
    db.user.aggregate({ _sum: { freePreviews: true } }),
  ]);
  const liabilityCredits = liability._sum.amount ?? 0;
  const liabilityUsd = liabilityCredits * CREDIT_USD;
  const providerNeeded = liabilityUsd / MARKUP;
  const threshold = Number(process.env.OPENROUTER_ALERT_THRESHOLD_USD ?? 20);
  const cap = Number(process.env.DAILY_SPEND_CAP_USD ?? 50);
  const today = periods[0];
  const lowBalance = orBalance !== null && (orBalance < threshold || orBalance < providerNeeded);
  const maxDay = Math.max(1, ...daily.map((d) => Math.max(d.revenue, d.spend)));

  return (
    <main className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-4 px-4 py-6 pb-safe">
      <h1 className="heading text-2xl">Admin</h1>

      {lowBalance && (
        <div role="alert" className="rounded-3xl bg-destructive/10 p-4 text-sm font-semibold text-destructive">
          OpenRouter balance {usd(orBalance!)} is below {orBalance! < threshold ? `the ${usd(threshold)} alert threshold` : `the ${usd(providerNeeded)} needed to serve outstanding credits`}. Top up now.
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {periods.map((p) => (
          <Card key={p.label} title={p.label}>
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Revenue</dt>
              <dd className="text-right font-semibold">{usd(p.revenue)}</dd>
              <dt className="text-muted-foreground">Provider spend</dt>
              <dd className="text-right font-semibold">{usd(p.spend)}</dd>
              <dt className="text-muted-foreground">Gross margin</dt>
              <dd className="text-right font-semibold">
                {usd(p.revenue - p.spend)}
                {p.revenue > 0 && <span className="ml-1 text-muted-foreground">({Math.round(((p.revenue - p.spend) / p.revenue) * 100)}%)</span>}
              </dd>
            </dl>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-3">
        <Card title="Credit liability">
          <p className="text-2xl font-extrabold">{liabilityCredits.toLocaleString()} credits</p>
          <p className="text-sm text-muted-foreground">{usd(liabilityUsd)} retail · ~{usd(providerNeeded)} provider cost</p>
        </Card>
        <Card title="OpenRouter balance">
          <p className={`text-2xl font-extrabold ${lowBalance ? "text-destructive" : ""}`}>{orBalance === null ? "Unavailable" : usd(orBalance)}</p>
          <p className="text-sm text-muted-foreground">Alert below {usd(threshold)}</p>
        </Card>
        <Card title="Today's spend vs cap">
          <p className="text-2xl font-extrabold">
            {usd(today.spend)} <span className="text-base text-muted-foreground">/ {usd(cap)}</span>
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round((today.spend / cap) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Daily spend cap used">
            <div className="h-full bg-accent" style={{ width: `${Math.min(100, (today.spend / cap) * 100)}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{activeHolds} active holds · {failedCount} failed calls (24h)</p>
        </Card>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <Card title="Last 30 days by feature">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr><th>Role</th><th>Calls</th><th>Spend</th><th>Credits</th></tr></thead>
            <tbody>
              {byRole.map((r) => (
                <tr key={r.role}><td>{r.role}</td><td>{r._count}</td><td>{usd(r._sum.costUsd ?? 0)}</td><td>{r._sum.credits ?? 0}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Growth (30 days)">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt>Free trials claimed</dt><dd className="font-semibold">{trials}</dd>
            <dt>Glowup Parties</dt><dd className="font-semibold">{parties}</dd>
            <dt>Party votes</dt><dd className="font-semibold">{votes}</dd>
            <dt>Roasts</dt><dd className="font-semibold">{roasts}</dd>
            <dt>Unused free previews</dt><dd className="font-semibold">{freePreviews._sum.freePreviews ?? 0}</dd>
          </dl>
        </Card>
      </div>

      <Card title="Last 14 days: revenue vs spend">
        <ul className="grid gap-2 text-sm">
          {daily.map((d) => (
            <li key={d.day.toISOString()} className="grid grid-cols-[4.5rem_1fr_5rem] items-center gap-2">
              <span className="text-muted-foreground">{d.day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</span>
              <span className="grid gap-0.5">
                <span className="h-2 rounded-full bg-primary" style={{ width: `${(d.revenue / maxDay) * 100}%` }} />
                <span className="h-2 rounded-full bg-accent" style={{ width: `${(d.spend / maxDay) * 100}%` }} />
              </span>
              <span className="text-right tabular-nums">{usd(d.revenue)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Black: revenue · Rose: provider spend</p>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <Card title="Adjust credits">
          <AdjustForm />
        </Card>
        <Card title={`Frozen accounts (${frozen.length})`}>
          {frozen.length === 0 ? (
            <p className="text-sm text-muted-foreground">No frozen accounts.</p>
          ) : (
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
              {frozen.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    {u.email} <span className="text-muted-foreground">· {u.frozenAt?.toLocaleDateString()}</span>
                  </span>
                  <form action={unfreeze} className="shrink-0">
                    <input type="hidden" name="userId" value={u.id} />
                    <Button type="submit" variant="outline">Unfreeze</Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Recent purchases">
        {purchases.length === 0 ? (
          <p className="text-sm text-muted-foreground">No purchases yet.</p>
        ) : (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Scrollable table">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr><th className="py-1 font-medium">When</th><th className="font-medium">User</th><th className="font-medium">Pack</th><th className="text-right font-medium">Paid</th></tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="py-2 pr-2 whitespace-nowrap">{p.createdAt.toLocaleString()}</td>
                    <td className="max-w-40 truncate pr-2">{p.user.email}</td>
                    <td className="pr-2">{p.note} · {p.amount} cr</td>
                    <td className="text-right">{usd((p.usdCents ?? 0) / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Recent AI failures">
        {failures.length === 0 ? (
          <p className="text-sm text-muted-foreground">No failures.</p>
        ) : (
          <ul className="grid gap-2 text-sm">
            {failures.map((f) => (
              <li key={f.id} className="rounded-2xl bg-muted p-3">
                <p className="font-semibold">{f.role} · {f.model ?? "no model"} · {f.createdAt.toLocaleString()}</p>
                <p className="break-words text-muted-foreground">{f.error}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
