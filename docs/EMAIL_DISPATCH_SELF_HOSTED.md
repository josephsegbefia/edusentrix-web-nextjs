# Email dispatch on self-hosted Coolify

Outbound email no longer depends on `GET /api/cron/email-dispatch` or a Coolify scheduler for that route.

Delivery uses:

```
EmailMessage + BackgroundJob kind=EMAIL_DISPATCH + Inngest + Resend
```

`vercel.json` keeps IMAP recovery and subscription crons only. The retired email-dispatch route returns HTTP **410** so leftover schedulers fail closed.

Invitation, authentication, and onboarding emails still send immediately through Resend. They enqueue one `EMAIL_DISPATCH` job against the same EmailMessage only if the immediate provider call fails (`enqueueOnFailure: true`).

These ordinary flows persist an EmailMessage and enqueue `EMAIL_DISPATCH` (no immediate Resend):

- lesson published notifications
- library notifications
- subscription renewal notice *delivery* (scheduling stays on `/api/cron/subscription-renewal-notices`)
- subscription receipts
- Paystack fee receipts (posting/ledger stay independent of mail)
- application confirmation retry (same EmailMessage; no second create)

Use Inngest Cloud or `npm run inngest:dev` locally. Do not add a Coolify cron for email dispatch.

Inspect counts with `GET /api/platform/email/dispatch-health` (`platform.system.settings.read`). Residual leftover `EmailDispatchJob` rows can be mapped with:

```bash
npx tsx scripts/migrate-email-dispatch-jobs-to-background-engine.ts
```

Dry-run is the default. Do not run `--apply` against production from this prompt.
