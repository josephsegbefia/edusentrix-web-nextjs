# Email dispatch on self-hosted Coolify

`vercel.json` schedules `GET /api/cron/email-dispatch` every 5 minutes. That schedule runs **only when Vercel Cron is actually executing the project**.

Self-hosted Coolify deployments do **not** run `vercel.json` crons. Background `EmailDispatchJob` rows stay pending until an external scheduler calls the same endpoint with `EMAIL_DISPATCH_CRON_SECRET` or `CRON_SECRET`.

Invitation, authentication, and onboarding emails now send immediately through Resend. They enqueue a retry job only if the immediate provider call fails.

These flows still depend on the dispatch worker until a later Inngest migration:

- lesson published notifications
- library notifications
- subscription renewal notices
- subscription receipts
- Paystack webhook receipts
- application-confirmation retry fallback

Do not treat Inngest as configured in this pass. Use `GET /api/platform/email/dispatch-health` (requires `platform.system.settings.read`) to inspect pending, failed, and dead-letter counts.
