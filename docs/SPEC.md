# Glowie: product spec

**Try the look before you book it. No subscription, ever.**

Glowie is a mobile-first, AI style, hair and makeup advisor. Users take a selfie, pick a vibe, and see personalised looks previewed on their own photo. Glowie is fully prepaid, pay-as-you-go: the operator never fronts provider costs.

## 1. Name and pitch

- **App name:** Glowie. The domain is TBD and lives in one constant: `APP_DOMAIN` in `src/lib/config.ts`, overridable with `NEXT_PUBLIC_APP_DOMAIN` (default `glowie.app`).
- **Tagline:** "Try the look before you book it. No subscription, ever."
- **The landing page leads with:**
  - no subscription;
  - credits never expire;
  - a full glowup for about $1, "less than one week of the other apps."

## 2. Stack (unchanged)

| Concern | Choice |
|---|---|
| App | Next.js (App Router, TypeScript), Tailwind + shadcn/ui, Motion |
| Data | Neon Postgres + Prisma |
| Auth | Clerk (Google, Apple, email magic link, SMS phone verification) |
| Payments | Stripe Checkout with Apple Pay and Google Pay, plus Radar |
| AI | OpenRouter for every model call: chat, image edit and video |
| Storage | Vercel Blob, private |
| Hosting | Vercel |
| App shell | PWA |
| Operations | PostHog, Sentry, Resend, Upstash rate limits |

## 3. Models

All IDs were verified on OpenRouter on 2026-10-26, and are swappable in `src/lib/config.ts`.

| Role | Primary | Fallback |
|---|---|---|
| Analysis, looks, event plan, roast | `google/gemini-4-argon` | `openai/gpt-5.4-mini` (cheaper) |
| Image edit (previews, hair stages) | `google/gemini-3.1-flash-image` (Nano Banana 2) | `bytedance-seed/seedream-5-0-flash` (Seedream 5.0 Flash) |
| Safety check + selfie coach | `google/gemini-3.5-flash-lite` | `openai/gpt-5.4-mini` |
| 3s image-to-video | `x-ai/grok-imagine-video-1.5-lite` at 720p | `alibaba/wan-3.0` at 480p |

How calls are made:

- Video uses OpenRouter's async `/api/v1/videos` API.
- Gemini 2.5 Flash Image has been removed everywhere.
- Each role falls back to its second model. Every call is retried once.
- A failed generation is never charged.
- A daily cron caches OpenRouter prices in `ModelPrice`. It reads `/models?output_modalities=all` so that image-only models are included.

## 4. Pricing

- 1 credit = $0.10 retail.
- Settled price = actual provider cost (`usage.cost`) × 3 markup, rounded up.
- Before each call, a hold is taken: the worst case across the role's models × 1.25 buffer × 3. The user always sees the hold as "up to N credits" and is never charged more.
- No subscriptions anywhere. Credits never expire.

| Pack | Price | Credits |
|---|---|---|
| Starter | $2.99 | 30 |
| Popular | $9.99 | 110 (+10% bonus) |
| Pro | $19.99 | 240 (+20% bonus) |

| Action | Hold | Typical charge |
|---|---|---|
| Analysis | ≤1 credit | 1 |
| 3 looks or event plan | ≤2 | 2 |
| Preview image | ≤4 | ~3 (Nano Banana 2 is ~$0.08 per image) |
| Hair regret simulator (3 images) | ≤12 | ~9 |
| Roast my fit | ≤1–2 | 1 |
| Animated video | ≤5 | ~3 |
| Photo check / selfie coach | free | – |

Against the targets:

- **Full session** (analysis + 3 looks + 3 previews): about 12 credits, or **$0.90–$1.50**. Target: $1–$2.
- **Extra preview:** about **$0.30–$0.40**. Target: about $0.49. To land on $0.49, raise `MARKUP`.

**Free trial:** 1 analysis + 3 looks + 1 real preview image.

- Limited to one per account, one per device, and one per verified phone number, with Turnstile.
- All checks pass or nothing is granted, in one transaction.
- Glowup Party voters who sign up get +1 free preview.

## 5. Prepaid billing (unchanged)

- **Append-only credit ledger.** Entry types are purchase, usage, refund, referral and admin_adjust. Balance = sum of entries. Row locks mean the balance can never go negative.
- **Webhook-only credits.** Credits are added only from verified Stripe webhooks (`checkout.session.completed` / `payment_intent.succeeded`). The handler is idempotent on both the event ID and the PaymentIntent.
- **Reserve, then settle.** Reserve the worst case, settle at cost × 3, release on failure, and release stale holds daily.
- **New-account caps.** At most $20 on the first purchase and $50 in the first 7 days.
- **Disputes.** `charge.dispute.created` freezes the account, claws back unused credits and blocks purchases. Refunds claw back the refunded share.
- **Fraud.** Stripe Radar.
- **Optional auto top-up** with a saved card.
- **Admin dashboard.** Revenue, provider spend, margin, and outstanding credit liability vs. the OpenRouter balance.
- **Alerts.** A low-balance email alert goes out when the OpenRouter balance drops below the threshold.
- **Limits.** Per-user Upstash rate limits, and a global daily spend circuit breaker (`DAILY_SPEND_CAP_USD`).
- **Referrals.** $2/$2 referral credit, paid only after the friend's first purchase.

## 6. Launch vibes

Date Night, Wedding Guest, Clean Girl, Old Money, Custom. Event mode is a separate session type, offered next to the vibes.

## 7. Launch features (priority order)

1. **Selfie coach.** One vision call does both the safety check and a quality score. It scores lighting, angle, sharpness and face visibility, combined into a 0–100 score, plus up to 3 tips. Selfies scoring below 55 are sent back with the tips before any credits are spent, which prevents failed generations.
2. **Analysis.** Face shape (with notes), undertone, 12-season colour palette (best colours, neutrals, avoid), metals, and hair type and length.
3. **3 looks per vibe**, each with hair, makeup and outfit.
   - Each look is auto-previewed on the user's own photo, using free previews first and then credits while the balance covers them.
   - Each preview has a before/after slider and a "Regenerate" button.
   - Previews need a live camera selfie.
4. **Hair try-on with regret simulator.** Three image edits show the hairstyle at week 1, month 3 and month 6 of grow-out. Alongside them, it shows:
   - estimated upkeep per year (visits × cost range);
   - salon hours per visit;
   - daily styling minutes.
5. **Stylist handoff card.** Salon-ready language (hair colour level, tone, technique, cut technique) plus a reference image on the user's own face. It can be shared as a 9:16 image or as a public, revocable link (`/c/[token]`).
6. **Roast my fit.** Upload an outfit photo (which must match the user's selfie) and get an honest 1–10 score, a headline, what works, quick fixes and a verdict. The result card is shareable as an image or link. It roasts the outfit, never the person.
7. **Shop the look with a budget slider.** The same look at about $50, $200 or $800. Each outfit piece carries a `budgetShare`, so the slider splits the budget across pieces. Each piece gets search links:
   - Amazon, with a price cap and the `NEXT_PUBLIC_AMAZON_AFFILIATE_TAG` affiliate tag;
   - Google Shopping, with a price cap;
   - Nordstrom and Zara.
8. **Glowup Party.** The main growth loop.
   - The user picks 2 previewed looks and shares `/p/[token]`.
   - Friends vote without an account, one vote per device.
   - The host sees live tallies.
   - Voters get a "Get my free glowup" link (`/p/[token]/join`) that adds 1 free preview to their trial.
   - The host can end the party at any time.
9. **Event mode** ("get me ready for Saturday"). The user enters the event, date, city and budget.
   - Open-Meteo provides the geocoding and forecast (up to 16 days ahead). `OPEN_METEO_API_KEY` is required for commercial use.
   - The model returns the dress code, a weather note, one full look and a packing list.
   - The look gets one preview.
10. **Share cards.** Automatic 9:16 before/after images for Stories, watermarked with Glowie and `APP_DOMAIN`, shared through the system share sheet or downloaded.
11. **Premium animated look.** A 3-second image-to-video of the look preview, for up to 5 credits. The hold is taken up front and settled at cost × 3.

## 8. Safety and privacy (unchanged, plus sharing rules)

- **Age:** a 18+ age gate at first use.
- **Photos:** every photo is checked. One real face, adult, no nudity. Full-body and outfit photos must match the user's selfie.
- **Edits:** image edits only change the user's own photo.
- **Blocked:** nudity, sexualised edits, minors, celebrity likeness, and race or identity changes. This is enforced both in prompts and by a custom-prompt blocklist.
- **Storage:** photos are private, served through HMAC-signed expiring URLs, and EXIF/GPS is stripped. Originals are auto-deleted after 30 days, or immediately if the user chooses. Photos are never used for training (`data_collection: deny`).
- **Public links:** stylist cards, roast cards and party pages show only AI previews or the photo the user chose to share. Party pages never show the original. Tokens are unguessable and revocable at any time.
- **Account deletion** removes all images and data.
- **Disclaimer:** "AI suggestions, not professional advice."

## 9. Later (not built; how the code is ready)

- **Men's mode:** the prompts and shopping queries are gender-neutral. A mode would be one more quiz field passed into the look prompts.
- **Closet-first wardrobe:** the `PhotoKind` enum already has `outfit`. Closet items would be a new kind plus a prompt that styles from them.
- **Paste a product link to try it on:** the preview pipeline (`editImage`) takes any prompt. It would need a fetched product image as a second image input.
- **Salon profiles:** `ShareLink` kinds are extensible, and stylist cards are already salon-ready.
- **More vibes:** add entries to `VIBES` in `src/lib/config.ts`. Nothing else changes.

## 10. Build order

1. Auth, Stripe and the credit ledger, including the trial claim (account, device, phone).
2. The analysis flow: selfie coach, analysis, looks and Event mode.
3. Image generation: previews, the hair regret simulator and video.
4. Sharing: Story cards, stylist cards, Roast my fit, Glowup Party and referrals.
5. Admin.

## Known deviations

- **Device "fingerprint":** this is a first-party device-ID cookie, not browser fingerprinting. Fingerprints collide on identical iPhones and raise privacy and consent issues. The verified phone number is the strong signal.
- **Preview price:** with the 3× markup kept, a preview comes to about $0.30–$0.40, under the $0.49 target. `MARKUP` is the one setting to change.
