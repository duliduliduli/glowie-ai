# Glowie

Glowie (working name "Glowup AI") is an AI stylist for outfits, hair and makeup. You upload a selfie and pick a vibe. You get a seasonal colour analysis, face-shape notes, three complete looks with shoppable outfit pieces and hair and makeup routines, and AI previews of yourself in each look. Each preview edits your own photo, so your face stays yours.

It is mobile-first, installable as a PWA, and **fully prepaid**: users buy credits up front, and every AI call is paid from credits the user already holds. The operator never fronts provider costs.

## Stack

| Concern | Choice |
|---|---|
| App | Next.js 16 (App Router, TypeScript), Tailwind 4, shadcn/ui, Motion |
| Data | Neon Postgres + Prisma 7 (`@prisma/adapter-pg`) |
| Auth | Clerk (Google, Apple, email magic link) |
| Payments | Stripe Checkout (Apple Pay / Google Pay, Radar) |
| AI | OpenRouter (one key, pay per use) |
| Storage | Vercel Blob, **private** store, served only via HMAC-signed URLs |
| Rate limits | Upstash Redis |
| Email / analytics / errors | Resend, PostHog (after cookie consent), Sentry |

## Architecture

### Prepaid credit ledger (`src/lib/ledger.ts`)

- `LedgerEntry` is **append-only**. Its types are `purchase`, `usage`, `refund`, `referral` and `admin_adjust`. The balance is `SUM(amount)`.
- Every balance change runs in a transaction that first takes `SELECT … FOR UPDATE` on the user row. Concurrent requests are serialised, so the balance can never go negative. A test covers this.
- **Holds:** before each AI call, `reserve()` holds the worst-case cost. That is the most expensive model in the role's fallback list, at cached `ModelPrice` prices, × 1.25 buffer × 3 markup, rounded up to whole credits. It is rejected if `available = balance − active holds` is too low.
- **Settle:** after success, `settle()` charges `min(hold, ceil(provider cost × 3 / $0.10))`. The cost is the actual USD figure OpenRouter reports in `usage.cost`.
- **Release:** on any failure, the hold is released. A failed generation is never charged. The daily cron releases holds that crashed requests left behind.

### Payments (`src/lib/billing.ts`, `/api/stripe/webhook`)

- Credits are added **only** from verified Stripe webhooks: `checkout.session.completed` / `async_payment_succeeded` with `payment_status = paid`, and `payment_intent.succeeded`. Auto top-ups arrive through `payment_intent.succeeded`.
- The handler is idempotent twice over:
  - processed event IDs are stored in `StripeEvent`;
  - every ledger write has a unique `idempotencyKey` (`purchase:<payment_intent>`), so the session event and the PaymentIntent event credit only once.
- The amount paid is checked against the pack price before crediting.
- **New-account limits:** at most $20 on the first purchase and $50 in total during the first 7 days.
- **`charge.dispute.created`:** freezes the account, blocks purchases, turns off auto top-up and claws back all unused credits. Credits in in-flight holds still settle.
- **`charge.refunded`:** claws back the refunded share of that purchase's credits, never pushing the balance below zero.
- **Referrals:** $2 (20 credits) to each side, paid only after the referred user's first paid purchase, with idempotent keys.

### Circuit breakers (`src/lib/guards.ts`)

- Per-user Upstash rate limits apply to AI calls, uploads and checkout. They are required in production.
- `DAILY_SPEND_CAP_USD` stops all AI calls once today's provider spend reaches the cap.
- The daily cron emails `ALERT_EMAIL` when the OpenRouter balance falls below `OPENROUTER_ALERT_THRESHOLD_USD`. `/admin` shows outstanding credit liability next to the OpenRouter balance.

### AI (`src/lib/ai.ts`, `src/lib/openrouter.ts`, `src/lib/config.ts`)

All model calls go through `runAi()`, which applies, in order:

1. the spend cap;
2. the rate limit;
3. the hold, settle or release;
4. an `AiCall` audit row.

OpenRouter's `models: [primary, fallback]` handles fallback, and the call is retried once on failure. `provider.data_collection = "deny"` is sent on every request.

## Local setup

Requirements: Node 22+ and Postgres 16.

```bash
cp .env.example .env            # fill in keys; DATABASE_URL -> local Postgres
npm i                           # also runs prisma generate
npx prisma migrate dev
npm run db:seed                 # model prices + demo user with 50 credits
npm run dev
```

Forward Stripe webhooks locally:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,payment_intent.succeeded,charge.dispute.created,charge.refunded
# paste the printed whsec_… into STRIPE_WEBHOOK_SECRET
```

Without `UPSTASH_*` or `TURNSTILE_SECRET_KEY`, rate limits and Turnstile are skipped in development only. In production they are required.

## Tests

```bash
npm test
```

The tests run against a real Postgres database at `TEST_DATABASE_URL` (default `postgresql://postgres:postgres@localhost:5432/glowie_test`). Migrations are applied automatically, and each run uses unique IDs, so the database never needs wiping.

They cover:

- reserve, settle and release, including idempotency;
- insufficient balance and frozen accounts;
- concurrent reserves;
- stale holds;
- never charging for failures;
- webhook idempotency, including concurrent duplicate deliveries;
- referrals, disputes and refunds;
- new-account purchase limits.

## Deploy to Vercel

1. **Database.** Create a Neon project and set `DATABASE_URL` to the **pooled** connection string.
2. **Storage.** Create a **private** Vercel Blob store. `BLOB_READ_WRITE_TOKEN` is added automatically.
3. **Environment variables.** Add every variable in `.env.example` to the Vercel project. Generate `SIGNING_SECRET` and `CRON_SECRET` with `openssl rand -base64 32`.
4. **Build.** Vercel runs `npm run vercel-build`, which is `prisma generate && prisma migrate deploy && next build`, so migrations apply on deploy. Plain `npm run build` skips migrations. Use it for local or preview builds that have no database access.
5. **Clerk.** Enable Google, Apple and email magic link. Set the sign-in and sign-up paths to `/sign-in` and `/sign-up`.
6. **Stripe:**
   - Add a webhook endpoint at `https://<domain>/api/stripe/webhook` with the five events listed above, and copy its signing secret.
   - Under **Settings → Payment methods**, enable Apple Pay and Google Pay. Checkout shows them automatically, with no domain verification needed for hosted Checkout.
   - Radar is on by default.
7. **Cron.** `vercel.json` schedules `/api/cron/daily` at 06:00 UTC. It syncs model prices, releases stale holds, deletes original photos after 30 days and checks the OpenRouter balance. Vercel sends `Authorization: Bearer $CRON_SECRET`.
8. **Fund OpenRouter.** Top up OpenRouter before launch. Keep the balance comfortably above outstanding credit liability ÷ 3, which `/admin` shows.
9. **Sentry and PostHog.** Set `NEXT_PUBLIC_SENTRY_DSN` and `NEXT_PUBLIC_POSTHOG_KEY`. Source-map upload is not configured. To add it, wrap `next.config.ts` with `withSentryConfig` and set the `SENTRY_*` variables.

## Swapping models

Edit `MODELS` in `src/lib/config.ts`. Each role (`analysis`, `looks`, `image`, `moderation`) lists `[primary, fallback]` OpenRouter IDs, plus a worst-case token budget used for the hold.

1. Check that the IDs exist at <https://openrouter.ai/api/v1/models>.
2. Add the new models' prices to `prisma/seed.ts`, or let the daily cron fetch them.

Until a price is cached, estimates fall back to a deliberately high default.

## Credit economics

1 credit = $0.10 retail. The settled price is provider cost × 3, rounded up.

| Pack | Price | Credits | $/credit |
|---|---|---|---|
| Starter | $4.99 | 50 | $0.100 |
| Popular | $9.99 | 110 (+10%) | $0.091 |
| Pro | $19.99 | 240 (+20%) | $0.083 |

| Action | Typical provider cost | Typical charge | Hold (max) |
|---|---|---|---|
| Analysis (Gemini 4 Argon) | ~$0.02 | 1 credit | from `estimateCredits("analysis")` |
| 3 looks for a vibe | ~$0.04 | 2 credits | from `estimateCredits("looks")` |
| Preview image (Nano Banana 2.1) | ~$0.04 | 2 credits | from `estimateCredits("image")` |

The free trial covers one analysis plus looks, with no image generation. It is protected by Turnstile and limited to one per account and one per device.

## Safety and privacy

- **Age:** users must confirm they are 18 or older before using the app.
- **Photo moderation:** every upload is checked. A photo is rejected if it shows nudity, a minor, or anything other than a real person, or if it has more than one face. Full-body photos must match the user's live camera selfie.
- **Preview edits:** previews only edit the user's own photo. Prompts keep identity, skin tone, ethnicity, age and body shape. Custom prompts asking for sexualised edits, celebrity likeness or race or identity changes are blocked.
- **Storage:** photos live in a private Blob store behind signed URLs, and originals are deleted after 30 days, or immediately if the user chooses. Photos are never used for training: `data_collection: deny` is sent on every request.
- **Account deletion** removes all photos and data.
- AI output is labelled as suggestions, not professional advice.

## Design principles

- **Apple Human Interface Guidelines** ([skills](https://github.com/AyushRajSinghParihar/apple-human-interface-skills)):
  - 44pt minimum touch targets;
  - one-handed layouts that respect safe areas;
  - a tab bar for destinations only, with "new look" as a separate create action;
  - AI-generated content is labelled, with retry or regenerate next to each output;
  - the price is shown before every paid action;
  - honest loading states and empty states;
  - real account deletion.
- **[Ponytail](https://github.com/DietrichGebert/ponytail):** the smallest complete change. Reuse what exists, add no speculative abstractions, and never cut validation, security, accessibility or money tests.
