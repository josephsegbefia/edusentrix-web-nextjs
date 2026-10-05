# Background Work Engine — Repository Inventory

Prompt 1 foundation scan. **No production flow in this document was migrated.**

Scan date: 2026-10-05  
Branch: `feature/background-work-engine-v1`  
HEAD at scan: `61a05f0`

## Summary

There is **no Inngest client, dependency, or `/api/inngest` route** in the repository today. Background work is implemented as:

- Mongo-backed job / outbox documents
- HTTP cron routes (`src/app/api/cron/**`)
- Internal secret runners (`/api/provisioning/run`, `/api/jobs/communications/process-outbox`)
- Next.js `after()` post-response workers (library import, Explore feed kickoff)
- Request-bound AI / parse / webhook handlers

`vercel.json` schedules **4** crons. **7** additional cron routes exist and require an external scheduler.

Classification key:

- `MIGRATE_TO_INNGEST` — durable async work that should later use the Background Work Engine
- `KEEP_SYNCHRONOUS` — interactive / short request-bound work
- `KEEP_PROVIDER_WEBHOOK` — provider callback must stay in the HTTP request
- `KEEP_R2_DIRECT` — authorize → presign → PUT → complete
- `NEEDS_REVIEW` — missing wiring, mixed, or not yet productized

---

## 1. Email dispatch

| Field | Value |
| --- | --- |
| Name | Email dispatch queue |
| Domain | Email |
| Initiating route/function | `sendTrackedBrevoEmail({ async: true })` / `enqueueEmailMessageForRetry` → `enqueueBackgroundJob({ kind: "EMAIL_DISPATCH" })` |
| Current execution | Mongo `BackgroundJob` + Inngest `email-dispatch` worker (`src/lib/background/functions/email-dispatch.ts`). Legacy `EmailDispatchJob` is read-only. |
| Persistence | `BackgroundJob`, `EmailMessage`, `EmailBatch` |
| Retry | Inngest EMAIL policy (5 attempts). Permanent provider errors are NonRetriable. |
| Idempotency | Job key `email-dispatch:<emailMessageId>`; Resend `Idempotency-Key: email-<messageId>` |
| Progress | Batch counters; message status |
| Notification | Email delivery + communication delivery sync |
| Request-bound | No |
| Restart-safe | Yes (Mongo queue) |
| Appropriate for Inngest | Yes |
| Priority | P0 |
| Classification | `MIGRATE_TO_INNGEST` |

Invitation sends remain **immediate Resend**, with `EMAIL_DISPATCH` used only as failure fallback. Migrated in Prompt 2.

---

## 2. IMAP mailbox recovery

| Field | Value |
| --- | --- |
| Name | IMAP mailbox recovery |
| Domain | Email inbound |
| Initiating route/function | `src/app/api/cron/imap-recovery/route.ts`; manual `src/app/api/platform/email/sync/route.ts` |
| Current execution | Cron `*/10 * * * *` → `runImapMailboxSync` |
| Persistence | `EmailMessage` UID cursor; inbound via `processInboundEmail` |
| Retry | Per-message errors logged; no full-sync job row |
| Idempotency | Duplicate inbound detection |
| Progress | Cron JSON summary |
| Notification | In-app proposal replies via dispatch |
| Request-bound | Cron: no. Manual sync: yes |
| Restart-safe | Partial (UID cursor) |
| Appropriate for Inngest | Yes |
| Priority | P1 |
| Classification | `MIGRATE_TO_INNGEST` |

---

## 3. Communication outbox

| Field | Value |
| --- | --- |
| Name | Communication outbox |
| Domain | Communications |
| Initiating route/function | Admin/teacher send routes; `src/app/api/jobs/communications/process-outbox/route.ts` |
| Current execution | `BackgroundJob` `COMMUNICATION_OUTBOX` + Inngest. Email channel enqueues `EMAIL_DISPATCH`. |
| Persistence | `CommunicationOutboxJob`, `CommunicationDelivery` |
| Retry | Inngest EMAIL policy. Already-delivered is a no-op. |
| Idempotency | Unique `deliveryId`; job key `comm-outbox:{deliveryId}` |
| Progress | Communication stats |
| Notification | Recipient channels only; no operator BackgroundJob notify |
| Request-bound | No (enqueue then 200) |
| Restart-safe | Yes |
| Appropriate for Inngest | Yes |
| Priority | P0 |
| Classification | Migrated in Prompt 4 |

---

## 4. School payment provisioning

| Field | Value |
| --- | --- |
| Name | Paystack subaccount provisioning |
| Domain | Billing / provisioning |
| Initiating route/function | `src/app/api/admin/settings/payment-setup/provision/route.ts`; platform payment-setup-review; `enqueueSchoolPaymentProvisioning` |
| Current execution | Optional sync Paystack attempt; retry via `BackgroundJob` `SCHOOL_PROVISIONING`. `/api/provisioning/run` is HTTP 410. |
| Persistence | `ProvisioningJob` (legacy collection `provisioningjpbs`) |
| Retry | Inngest PROVISIONING policy (2). Skip Paystack if subaccount already exists. |
| Idempotency | Skip if subaccount exists; key `provisioning:{schoolId}:paystack_subaccount` |
| Progress | Stage-based + payment-setup UI |
| Notification | Operator in-app on terminal outcome |
| Request-bound | Sync attempt only when Paystack succeeds immediately |
| Restart-safe | Yes |
| Appropriate for Inngest | Yes (cautious side effects) |
| Priority | P0 |
| Classification | Migrated in Prompt 4 |

---

## 5. Explore generation

| Field | Value |
| --- | --- |
| Name | Explore adventure generation |
| Domain | Learn / AI |
| Initiating route/function | `GET src/app/api/learn/mobile/explore/adventures/route.ts` (`after()`); on-demand generate routes; teacher session explore; admin regenerate |
| Current execution | `BackgroundJob` `EXPLORE_GENERATION` + Inngest. Domain `ExploreGenerationJob` remains. |
| Persistence | `ExploreGenerationJob` (`generationKey` unique) |
| Retry | Stale lock ~2m, `maxAttempts` 2 |
| Idempotency | Unique `generationKey` |
| Progress | Mobile poll `generation-status` |
| Notification | Mobile UI only |
| Request-bound | No (HTTP 202 / generating) |
| Restart-safe | Yes |
| Appropriate for Inngest | Yes |
| Priority | P0 |
| Classification | Migrated in Prompt 3 |

`scheduleExploreGenerationForDeliveredSession` has no callers — `NEEDS_REVIEW`, P2.

---

## 6. Library CSV import

| Field | Value |
| --- | --- |
| Name | Library CSV import |
| Domain | Library |
| Initiating route/function | `POST src/app/api/admin/library/imports/route.ts` |
| Current execution | `BackgroundJob` `LIBRARY_IMPORT` + Inngest. Bounded `csvText` stays on the domain job. |
| Persistence | `LibraryImportJob` (`csvText` while pending/processing) |
| Retry | Inngest IMPORT policy. Malformed CSV is permanent. |
| Idempotency | `library-import:{schoolId}:{jobId}` |
| Progress | BackgroundJob stages + `GET .../imports/[jobId]` |
| Notification | “Library import complete.” |
| Request-bound | No |
| Restart-safe | Yes |
| Appropriate for Inngest | Yes |
| Priority | P0 |
| Classification | Migrated in Prompt 4 |

---

## 7. Scheme import

| Field | Value |
| --- | --- |
| Name | Scheme of learning import |
| Domain | Academics |
| Initiating route/function | Admin/teacher `scheme-imports` POST → `createSchemeImportJobFromUpload` |
| Current execution | Parse via `BackgroundJob` `SCHEME_IMPORT`. Confirm stays request-bound. |
| Persistence | `SchemeImportJob` (`queued`/`parsing`/`parsed`/… + `parsedRows`) |
| Retry | Inngest IMPORT / AI transient. Malformed file permanent. |
| Idempotency | `scheme-import:{schoolId}:{jobId}` |
| Progress | Stage-based + poll job routes |
| Notification | “Scheme import is ready for review.” |
| Request-bound | Confirm / validate only |
| Restart-safe | Yes for parse |
| Appropriate for Inngest | Yes |
| Priority | P0 |
| Classification | Parse migrated in Prompt 4. Confirm `KEEP_SYNCHRONOUS`. |

---

## 8. Scheduled crons in `vercel.json`

| Name | Path | Schedule | Classification | Priority |
| --- | --- | --- | --- | --- |
| Email dispatch | `/api/cron/email-dispatch` | retired (HTTP 410) | Migrated in Prompt 2 — Inngest `EMAIL_DISPATCH` | P0 |
| IMAP recovery | `/api/cron/imap-recovery` | `*/10 * * * *` | `MIGRATE_TO_INNGEST` | P1 |
| Subscription renewal notices | `/api/cron/subscription-renewal-notices` | `0 8 * * *` | `MIGRATE_TO_INNGEST` (email leg) | P1 |
| Subscription plan changes | `/api/cron/subscription-plan-changes` | `15 0 * * *` | `NEEDS_REVIEW` / keep cron | P2 |

---

## 9. Cron routes not in `vercel.json`

| Name | Path | Persistence | Classification | Priority |
| --- | --- | --- | --- | --- |
| Finance reconciliation | `/api/cron/reconciliation` | `ReconciliationSession` | `MIGRATE_TO_INNGEST` | P0 |
| Library overdue | `/api/cron/library-loans-overdue` | `LibraryLoan` | Keep scheduled / later Inngest | P2 |
| Library due-soon | `/api/cron/library-loans-due-soon` | Loans + email queue | `MIGRATE_TO_INNGEST` (email) | P1 |
| Library reservation expiry | `/api/cron/library-reservation-expiry` | Reservations | Keep scheduled | P2 |
| Delegations expiry | `/api/cron/delegations-expiry` | `Delegation` | Keep scheduled | P2 |
| Admissions weekly digest | `/api/cron/admissions-weekly-digest` | Direct email send | `MIGRATE_TO_INNGEST` | P1 |
| Demo maintenance | `/api/cron/demo-maintenance` | `DemoSandbox` | Keep cron (demo) | P2 |

---

## 10. Webhooks

| Name | Path | Follow-up | Classification | Priority |
| --- | --- | --- | --- | --- |
| Paystack | `src/app/api/webhooks/paystack/route.ts` | Ledger + receipt `async: true` | `KEEP_PROVIDER_WEBHOOK` (+ later email/process enqueue) | P0 |
| Resend inbound | `src/app/api/webhooks/resend/route.ts` | Persist + optional inbound_route job | `KEEP_PROVIDER_WEBHOOK` | P0 |
| Brevo events | `src/app/api/webhooks/brevo/route.ts` | Suppressions / `EmailEvent` | `KEEP_PROVIDER_WEBHOOK` | P1 |
| Clerk | `src/app/api/webhooks/clerk/route.ts` | Identity lifecycle | `KEEP_PROVIDER_WEBHOOK` | P1 |

---

## 11. Storage / R2

| Field | Value |
| --- | --- |
| Name | Stored asset upload / soft-delete |
| Domain | Storage |
| Initiating route/function | `src/lib/storage/service.ts`; public/private asset APIs |
| Current execution | Authorize → presign → client PUT → complete |
| Persistence | `StoredAsset` (`purgeAfter` on soft delete) |
| Retry | N/A |
| Idempotency | Unique `storageKey` |
| Progress | N/A |
| Notification | None |
| Request-bound | Yes (upload handshake) |
| Restart-safe | Yes for metadata |
| Appropriate for Inngest | Upload: no. Delayed purge / backup / reconcile: yes |
| Priority | Upload keep. Purge P2 |
| Classification | `KEEP_R2_DIRECT` for uploads. `NEEDS_REVIEW` for purge (no worker exists) |

There is no automated R2 purge cron or backup replication worker in `src/`.

---

## 12. Interactive AI (Leo / lesson helpers)

Short Leo chat, hints, lesson-note wizard actions, exam drafts, and insights stay **request-bound**. See [BACKGROUND_WORK_ENGINE_AI_MIGRATION.md](./BACKGROUND_WORK_ENGINE_AI_MIGRATION.md).

Migrated in Prompt 3:

- Session / week lesson content → `AI_LESSON_GENERATION`
- Explore generation → `EXPLORE_GENERATION`
- Lesson illustration drafts → `AI_LESSON_ILLUSTRATION`

Still later:

- Admin insights `batch-generate`
- Period / report generation (`src/app/api/admin/reports/generate/route.ts`)
- Scheme PDF AI (Prompt 4 import)

---

## 13. Other in-process async

| Name | Path | Classification | Priority |
| --- | --- | --- | --- |
| Audit write retry (`setTimeout`) | `src/lib/audit/writeRetryableAuditEvent.ts` | `MIGRATE_TO_INNGEST` | P1 |
| Provider cost sync (no HTTP route) | `src/lib/jobs/providerCostSync.ts` | `NEEDS_REVIEW` | P1 |
| Teacher leave automation | `src/app/api/admin/teachers/leave/run/route.ts` + opportunistic on teachers list | Keep scheduled | P2 |
| Academic calendar reminders | `src/app/api/academic-calendars/reminders/run/route.ts` | `MIGRATE_TO_INNGEST` | P1 |
| Subscription lifecycle advance | platform API + `scripts/subscription-lifecycle-advance.ts` | Keep operator / later schedule | P2 |

---

## 14. Prompt 1 mapping (kinds only — no workers)

These future `BackgroundJob` kinds are registered as metadata. **Workers stay on existing models.**

| Kind | Inventory item |
| --- | --- |
| `EMAIL_DISPATCH` | §1 |
| `IMAP_RECOVERY` | §2 |
| `COMMUNICATION_OUTBOX` | §3 — Prompt 4 worker |
| `SCHOOL_PROVISIONING` | §4 — Prompt 4 worker |
| `EXPLORE_GENERATION` | §5 — Prompt 3 worker |
| `LIBRARY_IMPORT` | §6 — Prompt 4 worker |
| `SCHEME_IMPORT` | §7 — Prompt 4 parse worker |
| `BULK_IMPORT` | Prompt 4 student/teacher CSV |
| `FINANCE_RECONCILIATION` | §9 reconciliation |
| `SUBSCRIPTION_MAINTENANCE` | renewal / plan-change crons |
| `AI_LESSON_GENERATION` | Prompt 3 worker |
| `AI_LESSON_ILLUSTRATION` | Prompt 3 worker |
| `AI_CONTENT_GENERATION` | course/module/content placeholder |
| `AI_DOCUMENT_ANALYSIS` | document AI placeholder |
| `REPORT_GENERATION` | long reports |
| `STORAGE_PURGE` | delayed R2 purge |
| `STORAGE_BACKUP` | backup replication |
| `STORAGE_RECONCILIATION` | occupancy/orphan checks |
| `SYSTEM_BACKGROUND_SMOKE` | Prompt 1 foundation only |

---

## 15. Intentionally not migrated in Prompt 1

All flows above remain on their current mechanism. Prompt 1 adds the canonical `BackgroundJob` + Inngest foundation only.
