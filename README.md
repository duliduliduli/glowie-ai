# Glowie

**Try the look before you book it. No subscription, ever.**

Glowie is an AI stylist for hair, makeup and outfits. A selfie coach scores your photo before you spend anything. Then you get a colour and face analysis and three complete looks per vibe, each previewed on your own photo with a before/after slider. Around that sit a hair regret simulator, a salon-ready stylist card, Roast my fit, shop-the-look at three budgets, Glowup Party voting, Event mode, Story share cards, and a 3-second animated video of the look.

It is mobile-first, installable as a PWA, and **fully prepaid**: users buy credit packs (no subscriptions, credits never expire), and every AI call is paid from credits the user already holds. The operator never fronts provider costs. A full glowup costs about $1.

The full product spec is in [docs/SPEC.md](docs/SPEC.md).

## Stack

| Concern | Choice |
|---|---|
| App | Next.js 16 (App Router, TypeScript), Tailwind 4, shadcn/ui, Motion |
| Data | Neon Postgres + Prisma 7 (`@prisma/adapter-pg`) |
| Auth | Clerk (Google, Apple, email magic link; SMS phone verification for the free trial) |
| Payments | Stripe Checkout (Apple Pay / Google Pay, Radar) |
| AI | OpenRouter (one key, pay per use): chat, image edit and video APIs |
| Weather | Open-Meteo (Event mode) |
| Storage | Vercel Blob, **private** store, served only via HMAC-signed URLs |
| Rate limits | Upstash Redis |
| Email / analytics / errors | Resend, PostHog (after cookie consent), Sentry |

## Testing locally without paid keys

These only work outside production builds (they are ignored on Vercel, including previews):

- `OPENROUTER_BASE_URL=http://localhost:4010` points AI calls at a fake OpenRouter server.
- With no `BLOB_READ_WRITE_TOKEN`, photos are stored on disk in `.local-blobs/` (git-ignored).
- `DEV_FAKE_PHONE=+15555550100` skips the SMS check for the free trial (use it only when your Clerk instance has no phone feature).

`npm test` runs the unit and integration tests against a real Postgres (`TEST_DATABASE_URL`).

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
- **Referrals:** $2 (20 credits) to each side, paid only after the referred user's first paid purchase, with idempotent keys. Glowup Party is the main growth loop; referrals stay as a second one.

### Free trial (`src/lib/trial.ts`)

- The trial is 1 analysis + 3 looks + 1 real preview image. It is claimed atomically, once per account, per device and per verified phone number:
  - the `did` device-id cookie (set by `src/proxy.ts`) and the Clerk-verified phone number are hashed into `TrialClaim` keys;
  - all three checks must pass or nothing is granted;
  - Cloudflare Turnstile runs before the claim.
- The device check is a first-party cookie, not browser fingerprinting. Fingerprints collide on identical iPhones and raise consent issues. The verified phone number is the strong signal.
- Arriving from a Glowup Party link (`/p/[token]/join`) adds 1 extra free preview when the trial is claimed. Free previews are spent atomically (`User.freePreviews`) and given back if the generation fails.

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

Fallback works like this:

- Text roles use OpenRouter's `models: [primary, fallback]`.
- Image roles try each model in turn, because Seedream is image-only and needs `modalities: ["image"]`.
- Every call is retried once on failure.
- `provider.data_collection = "deny"` is sent on every request.

Video (`generateVideo`) uses OpenRouter's async `/api/v1/videos` API: submit, poll, then download. The credit hold is taken up front and settled at actual `usage.cost` × 3, or released on failure. The video provider fetches the first frame from a 15-minute signed URL under `NEXT_PUBLIC_APP_URL`, so in production that must be the public https URL. Long jobs (session previews, hair try-on, video) run in `after()`. Jobs that haven't finished in 10 minutes are treated as dead, so they can be retried.

### Routes

| Route | What |
|---|---|
| `/new` | Selfie coach → optional full-body photo → vibe or Event mode → quiz → price → start |
| `/session/[id]` | Analysis, event plan, looks with previews, regret simulator, stylist card, budget slider, video, Glowup Party |
| `/roast` | Roast my fit |
| `/lookbook`, `/credits`, `/settings` | Favourites and history, packs and history, privacy and account |
| `/c/[token]`, `/c/[token]/image` | Public, revocable stylist or roast card (page and 9:16 image) |
| `/p/[token]`, `/p/[token]/join` | Public Glowup Party vote page (one vote per device, no account) and join link |
| `/api/share/[lookId]` | Owner-only 9:16 before/after Story card |
| `/admin` | Revenue, spend, margin, liability vs. OpenRouter balance |

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
- new-account purchase limits;
- trial claims (per account, device and phone, plus the party bonus) and concurrent free-preview spending;
- prompt safety, signed URLs, price estimates and shop links.

## Deploy to Vercel

1. **Database.** Create a Neon project and set `DATABASE_URL` to the **pooled** connection string.
2. **Storage.** Create a **private** Vercel Blob store. `BLOB_READ_WRITE_TOKEN` is added automatically.
3. **Environment variables.** Add every variable in `.env.example` to the Vercel project. Generate `SIGNING_SECRET` and `CRON_SECRET` with `openssl rand -base64 32`.
4. **Build.** Vercel runs `npm run vercel-build`, which is `prisma generate && prisma migrate deploy && next build`, so migrations apply on deploy. Plain `npm run build` skips migrations. Use it for local or preview builds that have no database access.
5. **Clerk.**
   - Enable Google, Apple and email magic link.
   - Also enable **phone numbers with SMS verification**. The free trial requires a verified phone. Clerk may charge for SMS outside its included allowance.
   - Set the sign-in and sign-up paths to `/sign-in` and `/sign-up`.
6. **Stripe:**
   - Add a webhook endpoint at `https://<domain>/api/stripe/webhook` with the five events listed above, and copy its signing secret.
   - Under **Settings → Payment methods**, enable Apple Pay and Google Pay. Checkout shows them automatically, with no domain verification needed for hosted Checkout.
   - Radar is on by default.
7. **Cron.** `vercel.json` schedules `/api/cron/daily` at 06:00 UTC. It syncs model prices, releases stale holds, deletes original photos after 30 days and checks the OpenRouter balance. Vercel sends `Authorization: Bearer $CRON_SECRET`.
8. **Fund OpenRouter.** Top up OpenRouter before launch. Keep the balance comfortably above outstanding credit liability ÷ 3, which `/admin` shows.
9. **Public URL.** Set `NEXT_PUBLIC_APP_URL` to the public https URL. Share links and party links use it, and video providers fetch the first frame from it. Set `NEXT_PUBLIC_APP_DOMAIN` once the domain is chosen; it is the share-card watermark and email domain.
10. **Weather.** Open-Meteo's free API is for non-commercial use only. Set `OPEN_METEO_API_KEY` (a paid plan) for production traffic.
11. **Sentry and PostHog.** Set `NEXT_PUBLIC_SENTRY_DSN` and `NEXT_PUBLIC_POSTHOG_KEY`. Source-map upload is not configured. To add it, wrap `next.config.ts` with `withSentryConfig` and set the `SENTRY_*` variables.

## Swapping models

Edit `MODELS` and `VIDEO` in `src/lib/config.ts`:

| Role | Primary | Fallback |
|---|---|---|
| `analysis`, `looks`, `roast` | `google/gemini-4-argon` | `openai/gpt-5.4-mini` |
| `image` (edits your photo) | `google/gemini-3.1-flash-image` (Nano Banana 2) | `bytedance-seed/seedream-5-0-flash` (Seedream 5.0 Flash) |
| `moderation` (safety + selfie coach) | `google/gemini-3.5-flash-lite` | `openai/gpt-5.4-mini` |
| video (3s, image-to-video) | `x-ai/grok-imagine-video-1.5-lite` @720p | `alibaba/wan-3.0` @480p |

All IDs were verified on OpenRouter on 2026-10-26.

To swap a model:

1. Check the ID exists at `https://openrouter.ai/api/v1/models?output_modalities=all`, or at `/api/v1/videos/models` for video.
2. Add its price to `prisma/seed.ts`, or let the daily cron fetch it.
3. If it's an image-only model, add it to `IMAGE_ONLY_MODELS`.

Until a price is cached, estimates fall back to a deliberately high default.

## Credit economics

1 credit = $0.10 retail. Holds are the worst case across a role's models × 1.25 buffer × 3 markup. The settled price is actual provider cost × 3, rounded up, never more than the hold. There are no subscriptions and credits never expire.

| Pack | Price | Credits | $/credit |
|---|---|---|---|
| Starter | $2.99 | 30 | $0.100 |
| Popular | $9.99 | 110 (+10%) | $0.091 |
| Pro | $19.99 | 240 (+20%) | $0.083 |

| Action | Typical provider cost | Typical charge | Hold (max) |
|---|---|---|---|
| Analysis | ~$0.02 | 1 credit | 1 credit |
| 3 looks (or event plan) | ~$0.05 | 2 credits | 2 credits |
| Preview image (Nano Banana 2) | ~$0.08 | 3 credits (~$0.30) | 4 credits |
| Hair regret simulator (3 images) | ~$0.25 | ~9 credits | 12 credits |
| Roast my fit | ~$0.02 | 1 credit | from `estimateCredits("roast")` |
| 3s video (Grok Imagine Lite) | ~$0.10 | 3 credits | 5 credits |
| Photo check / selfie coach | <$0.005 | free | – |

A full session (analysis + 3 looks + 3 previews) comes to about 12 credits, roughly $0.90–$1.50 depending on the pack. An extra preview is about $0.30–$0.40, under the $0.49 target. To charge more per preview, raise `MARKUP` in `src/lib/config.ts`.

## Safety and privacy

- **Age:** users must confirm they are 18 or older before using the app.
- **Selfie coach:** scores lighting, angle, sharpness and face visibility (0–100) before any credits are spent. Selfies below 55 are sent back with tips.
- **Photo moderation:** every upload is checked. A photo is rejected if it shows nudity, a minor, or anything other than a real person, or if it has more than one face. Full-body and outfit photos must match the user's selfie.
- **Preview edits:** previews only edit the user's own photo. Prompts keep identity, skin tone, ethnicity, age and body shape. Custom prompts asking for sexualised edits, celebrity likeness or race or identity changes are blocked.
- **Storage:** photos live in a private Blob store behind signed URLs, and originals are deleted after 30 days, or immediately if the user chooses. Photos are never used for training: `data_collection: deny` is sent on every request.
- **Public links** (stylist cards, roast cards, party pages) show only AI previews or the photo the user chose to share. They are unguessable and can be revoked. Party pages never show the original photo.
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
