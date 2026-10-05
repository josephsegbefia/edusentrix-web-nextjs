# Background Work Engine — Production runbook

Do **not** run `--apply` scripts against production from this Prompt 5 pass. Do **not** configure Inngest Cloud from this pass. This document is the later operations sequence.

Production URL: `https://tryedusentrix.app/api/inngest`

## Environment (no real values)

Required:

- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`

Optional:

- `INNGEST_SIGNING_KEY_FALLBACK`
- `INNGEST_DEV` (local only)
- `INNGEST_ALLOW_SMOKE` (do not enable in production unless smoke is intended)

Never use `NEXT_PUBLIC_*` for Inngest keys.

Outbound email is Resend (`RESEND_API_KEY`, from-address vars). Brevo webhook secrets remain only for historical events.

Legacy HTTP cron secrets may stay until leftover schedulers stop calling 410 routes. `CRON_SECRET` is still used by demo maintenance.

## Index scripts

Dry-run default. `--apply` creates missing indexes only. Never drops indexes or documents.

### BackgroundJob

```bash
npx tsx scripts/ensure-background-job-indexes.ts
npx tsx scripts/ensure-background-job-indexes.ts --apply
```

Inspect PRESENT / MISSING / CONFLICT / BLOCKED. After apply, re-run dry-run and confirm PRESENT.

### AI generation unique indexes

```bash
npx tsx scripts/ensure-ai-generation-indexes.ts
npx tsx scripts/ensure-ai-generation-indexes.ts --apply
```

`--apply` refuses if duplicate idempotency keys exist (counts/ids only).

### BulkImportJob

```bash
npx tsx scripts/ensure-operational-job-indexes.ts
npx tsx scripts/ensure-operational-job-indexes.ts --apply
```

No unique targets.

Rollback: leave extra indexes in place; do not drop blindly. Application documents are never mutated.

## Legacy job migration scripts

Dry-run first. Inspect counts only. Do not print CSV, emails, file bytes, or secrets.

```bash
npx tsx scripts/migrate-email-dispatch-jobs-to-background-engine.ts
npx tsx scripts/migrate-explore-generation-jobs-to-background-engine.ts
npx tsx scripts/migrate-operational-jobs-to-background-engine.ts
```

Apply only after reviewing dry-run output:

```bash
npx tsx scripts/migrate-email-dispatch-jobs-to-background-engine.ts --apply
npx tsx scripts/migrate-explore-generation-jobs-to-background-engine.ts --apply
npx tsx scripts/migrate-operational-jobs-to-background-engine.ts --apply
```

Validation: leftover pending domain rows should have a BackgroundJob; health counts should drop.

## Inngest Cloud (later)

1. Create/connect an Inngest Cloud app with id `edusentrix`.
2. Set Coolify runtime env: `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`.
3. Register `https://tryedusentrix.app/api/inngest`.
4. Confirm signing verification and function sync (event workers + UTC schedules).
5. Smoke: enqueue one non-prod-safe visible job in staging first; then one email retry, one AI generation, one import.
6. Check `GET /api/platform/background-work/health`.
7. Confirm Task Center and operator console.

## Deployment sequence

1. Merge code.
2. Apply required Mongo indexes (dry-run, then `--apply`).
3. Configure Inngest runtime secrets in Coolify.
4. Deploy the application.
5. Verify `/api/inngest` registration/signing.
6. Run leftover migration dry-runs; apply only after review.
7. Smoke-test BackgroundJob, email retry, one AI generation, one import.
8. Verify Task Center and scheduled functions.
9. Monitor health.
10. Only then retire leftover cron secrets / external HTTP schedulers.

## Rollback

Domain records persist independently of Inngest.

- Do not delete domain jobs.
- `dispatch_failed` remains recoverable via operator redispatch after connectivity is fixed.
- Do not re-enable retired HTTP 410 runners without an explicit incident decision.
- Rolling back the app binary is safer than reintroducing cron execution engines.

## Storage

Scheduled hard purge is **not** implemented. Soft-delete + `purgeAfter` exist. Primary R2 is not the backup. Do not copy objects into the same bucket and call it backup.
