# EduSentrix Background Work Engine

MongoDB is the canonical application-side record of every durable job. Inngest is the orchestration/execution engine. Worker code stays in EduSentrix.

See also [BACKGROUND_WORK_ENGINE_INVENTORY.md](./BACKGROUND_WORK_ENGINE_INVENTORY.md).

## Architecture

```
Authenticated API / service
        |
        v
enqueueBackgroundJob()
        |
        +--> persist BackgroundJob (queued)
        |
        +--> inngest.send({ id: jobId, name, small routing payload })
        |
        v
Inngest Cloud (production) or Inngest local dev server
        |
        v
POST /api/inngest   (SDK signature verification)
        |
        v
runTrackedBackgroundJob()
        |
        +--> Mongo progress / status
        +--> bounded result or sanitized failure
        +--> optional in-app Notification
```

Invariants:

- Jobs do not depend on process memory, local disk, an open tab, or the original HTTP request.
- Inngest events contain only `jobId`, `kind`, optional `schoolId`, `initiatedByUserId`, and `correlationId`.
- Secrets, tickets, file bytes, presigned URLs, and giant prompts/results never go in events or `BackgroundJob.input` / `result`. Use Mongo/R2 references. Payload cap: 16KB.
- Workers can later move to a dedicated server by importing the same function registry and serving the same Inngest app id.

## Inngest app ID

Canonical app id: `edusentrix` (`INNGEST_APP_ID` in `src/lib/background/inngest.ts`).

Package: `inngest@^4.21.1` (installed 4.21.1).

## Production vs local

**Production:** Inngest Cloud invokes `https://<app>/api/inngest`. The official SDK verifies `x-inngest-signature` using `INNGEST_SIGNING_KEY`. Application routes enqueue jobs; users cannot execute workers by calling `/api/inngest` with an unsigned request.

**Local:** run the Next.js app and:

```bash
npm run inngest:dev
```

That starts the official Inngest CLI against the local app (`npx inngest-cli@latest dev`). The CLI talks to `/api/inngest`.

Optional: set `INNGEST_DEV=1` or `INNGEST_DEV=http://127.0.0.1:8288` so the SDK treats the environment as the local dev server. The installed SDK reads `INNGEST_DEV` as a URL when provided.

Do not hardcode cloud URLs in application code.

## `/api/inngest`

Implemented with `serve` from `inngest/next` (v4 exports `GET`, `POST`, `PUT`).

Clerk middleware allowlists `/api/inngest(.*)` the same way as `/api/cron` and webhooks. There is no custom bypass header. Demo host also allowlists `/api/inngest`.

Prompt 1 registers `SYSTEM_BACKGROUND_SMOKE` only when `NODE_ENV !== "production"` or `INNGEST_ALLOW_SMOKE=true`. Prompt 2 always registers `EMAIL_DISPATCH`. Prompt 3 always registers `AI_LESSON_GENERATION`, `EXPLORE_GENERATION`, and `AI_LESSON_ILLUSTRATION`.

## Environment variables

From the installed SDK (`inngest@4.21.1`):

| Name | Required | Purpose |
| --- | --- | --- |
| `INNGEST_EVENT_KEY` | Production send | Send events to Inngest |
| `INNGEST_SIGNING_KEY` | Production serve | Verify Cloud → `/api/inngest` |
| `INNGEST_SIGNING_KEY_FALLBACK` | Optional | Key rotation |
| `INNGEST_DEV` | Optional local | `1` or a local dev-server URL |
| `INNGEST_ALLOW_SMOKE` | Optional | Force-register the smoke function |

Never use `NEXT_PUBLIC_*` for these values. Missing keys must not throw during unrelated build-time imports; send/serve fail at runtime if keys are absent.

## Job lifecycle

Statuses (lowercase, repo convention):

`queued` → `running` → `succeeded` | `failed` | `cancel_requested`  
`queued` → `dispatch_failed` → `queued` (redispatch)  
`running` → `waiting` → `running` (reserved for future `step.sleep`)  
`cancel_requested` → `cancelled` | `succeeded` | `failed`

Terminal states never return to `running`. Create a new job to retry as a new unit of work.

`dispatch_failed` means Mongo wrote the job but `inngest.send()` failed. The job is not lost. Call `redispatchBackgroundJob(jobId)`. Do not loop inside the HTTP request.

## Event contract

Name: `edusentrix/background-job.requested`

```ts
{
  id: jobId,
  name: "edusentrix/background-job.requested",
  data: { jobId, kind, schoolId?, initiatedByUserId?, correlationId? }
}
```

The event `id` is the Mongo job id so Inngest treats re-sends as the same event.

## Tenancy

- `schoolId` is required when the kind is `schoolScoped`.
- `tenantKey` is `school:<id>` or `platform` and is used only for the partial unique idempotency index.
- Cross-school access is impossible: list/get/cancel authorize on school + initiator/target/admin, or platform permission for platform-scope jobs.
- Same school is not enough to see another user's private job.
- Workers reject an event `schoolId` that does not match the `BackgroundJob`.

## Idempotency

Same `tenantKey` + `kind` + `idempotencyKey` reuses the existing job. Partial unique index `unique_background_job_idempotency` (only when `idempotencyKey` is a string). Production `autoIndex: false` — create indexes with:

```bash
npx tsx scripts/ensure-background-job-indexes.ts          # dry run
npx tsx scripts/ensure-background-job-indexes.ts --apply  # create missing only
```

Dry-run default. Never drops indexes or documents. Do not run `--apply` against production in Prompt 1.

## Retries

Inngest retries (not `setTimeout` loops). Workload defaults in `src/lib/background/retry-policies.ts`:

- EMAIL: 5 attempts
- AI: 3, transient only
- IMPORT: 3, infra only
- PROVISIONING: 2, cautious
- STORAGE: 4
- SYSTEM: 3

`onFailure` (SDK-supported) marks the job `failed` after retries are exhausted. Intermediate handler throws stay non-terminal so Inngest can retry. Permanent errors throw `NonRetriableError`.

## Cancellation

`POST /api/background-jobs/[jobId]/cancel` sets `cancel_requested` only if the kind is cancellable and the actor is authorized. Workers expose `isCancellationRequested()` / `throwIfCancellationRequested()`. This is cooperative cancellation, not a hard Inngest abort.

## Progress and APIs

Persisted on the job: `progressPercent`, `progressStage`, `progressMessage`, `progressUpdatedAt`.

- `GET /api/background-jobs` — current user's jobs in the active school
- `GET /api/background-jobs/[jobId]` — safe DTO only (no raw input/result)
- `POST /api/background-jobs/[jobId]/cancel`
- `GET /api/platform/background-work/health` — counts only; `platform.system.settings.read`

## Notifications

Reuse `Notification` (`type: "system"`). Adapter: `notifyBackgroundJobCompleted` / `notifyBackgroundJobFailed`. Dedupe key `background-job:<jobId>:<succeeded|failed>`. In-app only; no email by default. Platform jobs without `schoolId` skip in-app notifications because `Notification.schoolId` is required.

## Realtime / polling

Do not add websockets or Mongo change streams in Prompt 1. Existing SSE is admin-metrics only. Task Center (Prompt 5) should poll `GET /api/background-jobs` and `GET /api/background-jobs/[jobId]`.

Stale-job helpers exist (`queryStaleBackgroundJobs`) but do **not** auto-fail or auto-repair.

## Future dedicated worker server

Keep functions in `src/lib/background/functions/` and serve them with the same `edusentrix` client. A later worker process can import `getRegisteredInngestFunctions()` without rewriting domain workflows.

## Prompt 2 email dispatch

Outbound delivery and invitation retries use `BackgroundJob` kind `EMAIL_DISPATCH`.

- `EmailMessage` remains the delivery record.
- Job input is `{ emailMessageId }` only. Inngest events stay routing IDs.
- Idempotency key: `email-dispatch:<emailMessageId>` (explicit helper may use `:retry` after a terminal failed job).
- Critical invitations still send immediately via `issueInvitation` (`enqueueOnFailure: true`).
- `GET /api/cron/email-dispatch` is retired (HTTP 410). IMAP and subscription crons stay.
- `EmailDispatchJob` is LEGACY_READ_ONLY. Migrate leftover rows with `scripts/migrate-email-dispatch-jobs-to-background-engine.ts` (dry-run default).
- Health: `GET /api/platform/email/dispatch-health` (`platform.system.settings.read`). Counts only; no PII.

See [BACKGROUND_WORK_ENGINE_EMAIL_MIGRATION.md](./BACKGROUND_WORK_ENGINE_EMAIL_MIGRATION.md).

## Prompt 3 AI generation

Long-running lesson content, Explore adventures, and lesson illustrations enqueue `BackgroundJob` and return HTTP 202. Conversational Leo stays request-bound.

- Domain requests: `LessonAiGenerationRequest`, `ExploreGenerationJob` (domain state), `LessonIllustrationRequest`.
- Workers persist drafts only. No auto-publish.
- Inngest AI concurrency: global 6 + per-school 2.
- Explore student/system jobs do not notify. Teacher/admin jobs do.
- Dry-run leftover Explore jobs: `scripts/migrate-explore-generation-jobs-to-background-engine.ts`.
- Production unique indexes: `scripts/ensure-ai-generation-indexes.ts` (dry-run default).

See [BACKGROUND_WORK_ENGINE_AI_MIGRATION.md](./BACKGROUND_WORK_ENGINE_AI_MIGRATION.md).

## Prompt 1 vs later

Implemented: client, route, model, kinds, events, enqueue, idempotency, dispatch-failure recovery, state machine, worker wrapper, smoke (non-prod), EMAIL_DISPATCH worker, AI lesson/Explore/illustration workers, GET/LIST/cancel, notifications, health, index script, email + Explore migration scripts, tests.

Not migrated: ProvisioningJob, CommunicationOutboxJob, LibraryImportJob, SchemeImportJob, IMAP recovery cron, R2 purge, backups, Task Center UI.
