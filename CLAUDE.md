# Working on Glowie

See AGENTS.md for Next.js 16 notes and README.md for architecture.

## Code: Ponytail rules (https://github.com/DietrichGebert/ponytail)
- Read the code your change touches first; list every caller, test and config it must reach.
- Take the first option that fully works: does it need to exist → already in the codebase → stdlib/platform → installed dependency → one clear line → minimum new code.
- No speculative abstractions, options or "for later" code. Keep existing structure and conventions.
- Never cut: validation at trust boundaries, security, accessibility, data-loss handling.
- Money, security, parsers and branching logic leave a test behind (see tests/ledger.test.ts).
- Known shortcuts get a comment: `shortcut: <limit>, <when to upgrade>`.
- End replies with what was skipped or not checked.

## Billing invariants (do not break)
- Credits are added only from verified Stripe webhooks; every ledger write has a unique idempotencyKey.
- Every AI call goes through `runAi()` (hold → settle at cost x3 → release on failure). Never call OpenRouter directly.
- Ledger is append-only; balance changes lock the user row.

## UI: Apple HIG rules this app follows (https://github.com/AyushRajSinghParihar/apple-human-interface-skills)
- Touch targets ≥ 44px; primary actions reachable one-handed; respect safe-area insets.
- Tab bar = stable destinations only; creating a look is a separate action button. Empty destinations explain themselves instead of hiding.
- Label AI-generated content; put Regenerate/Retry next to outputs; show the price before any paid action and require confirmation.
- Loading states show real progress/status and offer retry; never a permanent skeleton.
- Honour reduced motion; real account deletion, clearly explained.
