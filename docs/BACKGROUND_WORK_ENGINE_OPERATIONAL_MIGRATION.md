# Background Work Engine — Operational Migration (Prompt 4)

Source-backed inventory of remaining durable operational work, then the architecture for the flows migrated in this prompt.

Scan date: 2026-10-05  
Branch: `feature/background-work-engine-v1`  
HEAD at scan: `71350cb`

Classification key:

- `MIGRATE_TO_INNGEST_NOW` — Prompt 4 worker
- `KEEP_SYNCHRONOUS` — short / interactive / already correct in-request
- `KEEP_PROVIDER_WEBHOOK` — provider callback must stay in the HTTP request
- `KEEP_REQUEST_SCOPED` — request-lifetime follow-up is acceptable
- `PROMPT_5_SCHEDULED` — time-based / Task Center / remaining crons
- `LEGACY` — retired runner
- `NEEDS_REVIEW` — leftover or unimplemented

---

## Architecture after Prompt 4

```
Authenticated action
  → persist domain record (LibraryImportJob | SchemeImportJob | ProvisioningJob | CommunicationOutboxJob | BulkImportJob)
  → enqueueBackgroundJob (IDs only)
  → HTTP 202
  → Inngest worker reloads Mongo / R2 by ID
  → idempotent domain steps
  → one terminal in-app notification (user-visible jobs only)
```

Invariants:

- BackgroundJob is orchestration. Domain models keep business state.
- Events remain `jobId`, `kind`, optional `schoolId`, `initiatedByUserId`, `correlationId`.
- No CSV / PDF / spreadsheet bytes in events or BackgroundJob.result.
- Library CSV stays on `LibraryImportJob.csvText` (2MB / 2000 rows). Scheme source stays on R2 `StoredAsset`.
- Paystack **fee posting** stays in the webhook. Payment **subaccount provisioning** is the only ProvisioningJob.

---

## Migrated in Prompt 4

| Flow | Domain | Kind | Before | After |
| --- | --- | --- | --- | --- |
| Library CSV import | `LibraryImportJob` | `LIBRARY_IMPORT` | Next.js `after()` | BackgroundJob + Inngest |
| Scheme parse (PDF/AI/spreadsheet) | `SchemeImportJob` | `SCHEME_IMPORT` | Request-bound parse | 202 + worker; confirm stays sync |
| Paystack subaccount provisioning | `ProvisioningJob` (`paystack_subaccount` only) | `SCHOOL_PROVISIONING` | Sync attempt + `/api/provisioning/run` | Sync attempt optional; retry via Inngest |
| Communication outbox | `CommunicationOutboxJob` | `COMMUNICATION_OUTBOX` | Inline process on send + secret runner | One job per delivery; email → `EMAIL_DISPATCH` |
| Student CSV / teacher spreadsheet | `BulkImportJob` | `BULK_IMPORT` | Request-bound create | 202 + worker |

### Library CSV stays in Mongo

`csvText` is already capped at 2,000,000 characters and 2,000 rows. Moving it to R2 would add a storage kind without changing durability once BackgroundJob owns execution. Prompt 4 keeps the bounded Mongo payload and does **not** put CSV in the Inngest event.

### Scheme confirm stays synchronous

Parse (download + AI/PDF/spreadsheet) is the long-running step. Confirm writes a reviewed `SchemeOfWork` + items in one request. Inventory keeps confirm request-bound.

### ProvisioningJob is not school/user/student provisioning

The model enum is only `paystack_subaccount`. School creation, invitations, and admissions remain request-bound. Do not invent a membership-provisioning worker.

### Bulk import file storage

Student imports are capped at 500 rows. Teacher CSV is the same class of bounded spreadsheet. Prompt 4 persists the uploaded file on `BulkImportJob` (max 5MB) the same way library keeps `csvText`, instead of adding a new R2 `bulk_import` kind in this pass.

---

## Domain vs BackgroundJob authority

| Domain | Domain owns | BackgroundJob owns |
| --- | --- | --- |
| LibraryImportJob | csvText, counters, row errors | queue / retry / progress / notify |
| SchemeImportJob | file refs, parsedRows, wizard status | parse execution |
| ProvisioningJob | schoolId, kind, lastError, billing mirror | retries (Inngest; not `nextRunAt` / stale claim) |
| CommunicationOutboxJob | deliveryId, channel, payload, delivery status | dispatch |
| BulkImportJob | file bytes, counters, bounded errors | execution |

---

## Remaining Next.js `after()`

| Location | Classification | Why |
| --- | --- | --- |
| `src/app/api/admin/library/imports/route.ts` | `MIGRATE_TO_INNGEST_NOW` | Removed in Prompt 4 |
| `tests/**` `after(` | n/a | node:test teardown |

After Prompt 4 there is **no** production `after()` in `src/` for business work.

---

## Remaining fire-and-forget (`void` / unawaited)

| Location | Work | Classification |
| --- | --- | --- |
| Admin/teacher delegations notify | in-app notify | `PROMPT_5_SCHEDULED` / best-effort |
| Lesson-note comment / approval notify | in-app notify | `PROMPT_5_SCHEDULED` |
| Exam invigilator / timetable / day-ops | notify + calendar + audit | `PROMPT_5_SCHEDULED` |
| Admissions decision analytics IIFE | analytics | `KEEP_REQUEST_SCOPED` |
| Lesson publish student email | `sendTrackedBrevoEmail({ async: true })` | already `EMAIL_DISPATCH` |
| Inbound proposal reply `.catch` | email follow-up | `PROMPT_5_SCHEDULED` |
| Metrics SSE `void task()` | stream | `KEEP_REQUEST_SCOPED` |
| Client React `void` | UI | `KEEP_SYNCHRONOUS` |
| `writeRetryableAuditEvent` setTimeout | audit retry | `PROMPT_5_SCHEDULED` |

---

## Webhooks

| Webhook | Classification | Notes |
| --- | --- | --- |
| Paystack | `KEEP_PROVIDER_WEBHOOK` | `postPaystackFeePayment` stays transactional in the handler. Receipt email already `EMAIL_DISPATCH`. |
| Clerk | `KEEP_PROVIDER_WEBHOOK` | Identity lifecycle in-request |
| Resend / Brevo inbound + events | `KEEP_PROVIDER_WEBHOOK` | Persist + suppressions in-request |

Do not add `WEBHOOK_FOLLOWUP`. Moving ledger posting behind Inngest would weaken Paystack retry/idempotency.

---

## Exports / reports

Most PDF/CSV downloads are bounded and stay `KEEP_SYNCHRONOUS`. `ReportExport` can be `queued` but generation is still a sync GET — `PROMPT_5_SCHEDULED` / `REPORT_GENERATION` metadata only. Admin insights `batch-generate` stays Prompt 5.

---

## Scheduled crons (Prompt 5)

`vercel.json`: IMAP recovery, subscription renewal notices, subscription plan changes.

Not in vercel.json (external/manual): finance reconciliation, library overdue/due-soon/reservation, delegations expiry, admissions weekly digest, demo maintenance, academic calendar reminders.

Email-dispatch cron is already HTTP 410.

Prompt 4 retires **execution** runners only: `/api/provisioning/run` and `/api/jobs/communications/process-outbox`.

---

## Bulk imports not migrated

| Flow | Classification |
| --- | --- |
| Admissions bulk status/reviewer | `KEEP_SYNCHRONOUS` (≤500 ids, no file) |
| Learn accounts bulk-create | `PROMPT_5_SCHEDULED` |
| Admin email bulk | enqueue already `EMAIL_DISPATCH` |
| Fees reconciliation ingest JSON | `KEEP_SYNCHRONOUS` |

---

## Progress / notify / cancel / concurrency

| Kind | Progress | Notify | Cancel | Concurrency |
| --- | --- | --- | --- | --- |
| LIBRARY_IMPORT | validating 5 → parsing 20 → importing 50–90 → finalizing 95 | “Library import complete.” `/admin/library/imports` | before finalize | global 4 + school 1 |
| SCHEME_IMPORT | loading_file 5 → parsing 20 → validating 45 → saving 90 | “Scheme import is ready for review.” | before persist-parsed | global 4 + school 1 |
| SCHOOL_PROVISIONING | stage-based | “School payment provisioning completed.” | never | global 2 + school 1 |
| COMMUNICATION_OUTBOX | claim → channel send | none | never | global 8 + school 2 |
| BULK_IMPORT | validating 5 → parsing 20 → importing 50–90 → finalizing 95 | “Bulk import complete.” | before first write | global 4 + school 1 |

Retry: IMPORT 3 (infra only; malformed file permanent). PROVISIONING 2 (skip Paystack if subaccount exists). OUTBOX uses EMAIL 5; already-delivered is success.

---

## Legacy reconciliation

`scripts/migrate-operational-jobs-to-background-engine.ts` (dry-run default): enqueue BackgroundJobs for unfinished library `pending`/`processing`, outbox `pending`, provisioning `pending`/`running`/`failed`, scheme `queued`/`parsing`. No provider calls. Do not run `--apply` on production in this pass.

Those leftover scans use existing `status` indexes on LibraryImportJob, SchemeImportJob, and CommunicationOutboxJob. ProvisioningJob leftover scan is `{ status, kind }` with only `schoolId` indexed; volume is one-ish row per school, so no new status/kind index was added. BulkImportJob is not scanned (new collection; enqueue already creates the BackgroundJob).

---

## Production indexes

Production MongoDB uses `autoIndex: false`. Prompt 4 added **no new unique indexes**. Domain `backgroundJobId` is stored, then loaded with `BackgroundJob.findById`; none of the Prompt 4 models query `{ backgroundJobId }`, so that field is intentionally unindexed. Existing BackgroundJob indexes already cover Prompt 4 kinds.

### Domain index inventory

| Model | Index | Prompt 4 | Production action |
| --- | --- | --- | --- |
| BulkImportJob | `schoolId` | **new** (new collection) | create via ensure script |
| BulkImportJob | `status` | **new** (new collection) | create via ensure script |
| BulkImportJob | `{ schoolId: 1, createdAt: -1 }` | **new** (new collection) | create via ensure script |
| LibraryImportJob | `schoolId`, `status`, `{ schoolId: 1, createdAt: -1 }` | already existed | none |
| SchemeImportJob | `schoolId`, `createdByUserId`, `sourceKind`, `status`, `{ schoolId: 1, createdAt: -1 }` | already existed (status enum grew; key unchanged) | none |
| ProvisioningJob | `schoolId` | already existed | none |
| CommunicationOutboxJob | `schoolId`, `communicationId`, unique `deliveryId`, `channel`, `status`, `priority`, `nextRunAt`, `{ status, priority, nextRunAt, createdAt }`, `{ communicationId, status }` | already existed (unique `deliveryId` is **pre-Prompt 4**) | none |

### Intentionally not indexed

- `backgroundJobId` on LibraryImportJob, SchemeImportJob, ProvisioningJob, CommunicationOutboxJob, BulkImportJob
- BulkImportJob `fileBytes` (bounded 5MB payload; never index file bytes)
- BulkImportJob `targetKind` (no query uses it; `index: true` removed)
- BulkImportJob `createdBy` / `originalFileName` / `fileName`
- ProvisioningJob `status` / `kind` / `updatedAt` (enqueue uses existing `schoolId`; few rows per school)
- New BackgroundJob indexes (Prompt 1 coverage is sufficient)

BulkImportJob has **no unique constraint**, so retries/regenerates are allowed.

### Production migration command (do not run `--apply` against production from this pass)

```bash
npx tsx scripts/ensure-operational-job-indexes.ts
npx tsx scripts/ensure-operational-job-indexes.ts --apply
```

Dry-run is the default. `--apply` creates only the missing BulkImportJob indexes above, never drops unrelated indexes, never mutates documents, and refuses on CONFLICT. There are no unique targets, so unique-duplicate BLOCKED cannot fire for the current specs.

---

## Remaining Prompt 5

- Task Center UI
- IMAP, subscription, finance reconciliation, library loan/reservation, delegations, admissions digest, calendar reminders
- `void` notify/audit hardening
- Report generation / large CSV exports
- `trackUsage` billing ledger (pre-existing no-op)
- Production `--apply` of operational + AI index scripts
- Inngest Cloud
