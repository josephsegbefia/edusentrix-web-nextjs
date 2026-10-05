# Background Work Engine — Repository Inventory

Prompt 5 final scan. Classifications describe the **Prompt 5 end state**.

Scan date: 2026-10-05  
Branch: `feature/background-work-engine-v1`  
HEAD at scan: `e8a7958`

Classification key:

- `MIGRATED_INNGEST_EVENT` — durable work runs as a BackgroundJob event worker
- `MIGRATED_INNGEST_SCHEDULE` — recurring discovery runs as an Inngest cron
- `KEEP_SYNCHRONOUS` — interactive / short request-bound work
- `KEEP_PROVIDER_WEBHOOK` — provider callback stays in the HTTP request
- `BEST_EFFORT_ALLOWED` — loss is acceptable (telemetry, in-app notify)
- `LEGACY_READ_ONLY` — leftover model/route kept for ops or old callers
- `DEFERRED_WITH_REASON` — exists or is reserved, not productized in V1
- `REMOVE` — unused execution helper deleted in Prompt 5
- `LEGACY_410` — HTTP runner retired; leftover schedulers fail closed

---

## Event workers (BackgroundJob + Inngest)

| Kind | Domain | Classification |
| --- | --- | --- |
| `EMAIL_DISPATCH` | Outbound Resend via `EmailMessage` | `MIGRATED_INNGEST_EVENT` |
| `COMMUNICATION_OUTBOX` | One job per delivery; email → `EMAIL_DISPATCH` | `MIGRATED_INNGEST_EVENT` |
| `SCHOOL_PROVISIONING` | Paystack subaccount only | `MIGRATED_INNGEST_EVENT` |
| `EXPLORE_GENERATION` | Explore adventure draft | `MIGRATED_INNGEST_EVENT` |
| `AI_LESSON_GENERATION` | Lesson content draft | `MIGRATED_INNGEST_EVENT` |
| `AI_LESSON_ILLUSTRATION` | Illustration draft | `MIGRATED_INNGEST_EVENT` |
| `LIBRARY_IMPORT` | Library CSV (bounded `csvText`) | `MIGRATED_INNGEST_EVENT` |
| `SCHEME_IMPORT` | Scheme parse only; confirm stays sync | `MIGRATED_INNGEST_EVENT` |
| `BULK_IMPORT` | Student/teacher CSV (bounded `fileBytes`) | `MIGRATED_INNGEST_EVENT` |
| `SYSTEM_BACKGROUND_SMOKE` | Non-prod only | `MIGRATED_INNGEST_EVENT` |

Reserved kinds **without** event workers (schedules do not enqueue these as user jobs):

| Kind | Classification | Reason |
| --- | --- | --- |
| `FINANCE_RECONCILIATION` | `DEFERRED_WITH_REASON` | Schedule calls existing deterministic recon directly |
| `IMAP_RECOVERY` | `DEFERRED_WITH_REASON` | Schedule calls `runImapMailboxSync` directly |
| `SUBSCRIPTION_MAINTENANCE` | `DEFERRED_WITH_REASON` | Schedule calls existing notice/plan-change functions |
| `STORAGE_PURGE` | `DEFERRED_WITH_REASON` | Soft-delete exists; scheduled hard purge is incomplete |
| `STORAGE_BACKUP` | `DEFERRED_WITH_REASON` | No independent backup target. Primary R2 is not the backup. |
| `STORAGE_RECONCILIATION` | `DEFERRED_WITH_REASON` | Conservative report only; no auto-delete |
| `REPORT_GENERATION` | `DEFERRED_WITH_REASON` | Reports stay request-bound |
| `AI_CONTENT_GENERATION` / `AI_DOCUMENT_ANALYSIS` | `DEFERRED_WITH_REASON` | Placeholders; no workers |

---

## Inngest schedules (Prompt 5)

| Schedule | Cron (UTC) | Calls | Classification |
| --- | --- | --- | --- |
| `background-job-reconciliation` | `*/5 * * * *` | stale / orphan / `dispatch_failed` recovery | `MIGRATED_INNGEST_SCHEDULE` |
| `imap-recovery` | `*/10 * * * *` | `runImapMailboxSync` | `MIGRATED_INNGEST_SCHEDULE` |
| `subscription-renewal-notices` | `0 8 * * *` | `sendSubscriptionRenewalNotices` | `MIGRATED_INNGEST_SCHEDULE` |
| `subscription-plan-changes` | `15 0 * * *` | `applyDuePendingPlanChanges` | `MIGRATED_INNGEST_SCHEDULE` |
| `finance-reconciliation` | `0 */6 * * *` | `runDeterministicReconciliation` (≤50 schools) | `MIGRATED_INNGEST_SCHEDULE` |
| `library-loans-overdue` | `0 2 * * *` | `markOpenLoansOverdueGlobally` | `MIGRATED_INNGEST_SCHEDULE` |
| `library-loans-due-soon` | `0 9 * * *` | `enqueueDueSoonLibraryLoanRemindersGlobally` | `MIGRATED_INNGEST_SCHEDULE` |
| `library-reservation-expiry` | `0 3 * * *` | `expireStaleLibraryReservationsGlobally` | `MIGRATED_INNGEST_SCHEDULE` |
| `delegations-expiry` | `30 6 * * *` | expire + reminders | `MIGRATED_INNGEST_SCHEDULE` |
| `admissions-weekly-digest` | `0 7 * * 1` | weekly digest + `EMAIL_DISPATCH` | `MIGRATED_INNGEST_SCHEDULE` |

`vercel.json` has no required crons after Prompt 5.

---

## HTTP cron routes

| Path | Disposition |
| --- | --- |
| `/api/cron/email-dispatch` | `LEGACY_410` (Prompt 2) |
| `/api/cron/imap-recovery` | `LEGACY_410` (Prompt 5) |
| `/api/cron/subscription-renewal-notices` | `LEGACY_410` |
| `/api/cron/subscription-plan-changes` | `LEGACY_410` |
| `/api/cron/reconciliation` | `LEGACY_410` |
| `/api/cron/library-loans-overdue` | `LEGACY_410` |
| `/api/cron/library-loans-due-soon` | `LEGACY_410` |
| `/api/cron/library-reservation-expiry` | `LEGACY_410` |
| `/api/cron/delegations-expiry` | `LEGACY_410` |
| `/api/cron/admissions-weekly-digest` | `LEGACY_410` |
| `/api/cron/demo-maintenance` | `DEFERRED_WITH_REASON` — demo-only HTTP; keep when `isDemoMode()` |

Other secret runners:

| Path | Classification | Reason |
| --- | --- | --- |
| `/api/academic-calendars/reminders/run` | `DEFERRED_WITH_REASON` | Internal secret; not in V1 schedule set |
| `/api/admin/teachers/leave/run` | `DEFERRED_WITH_REASON` | Internal secret; opportunistic list path remains |
| `/api/provisioning/run` | `LEGACY_410` | Prompt 4 |
| `/api/jobs/communications/process-outbox` | `LEGACY_410` | Prompt 4 |

---

## Webhooks

| Path | Classification |
| --- | --- |
| `/api/webhooks/paystack` | `KEEP_PROVIDER_WEBHOOK` — ledger posting stays in-request; receipt uses `EMAIL_DISPATCH` |
| `/api/webhooks/resend` | `KEEP_PROVIDER_WEBHOOK` — primary inbound |
| `/api/webhooks/brevo` | `KEEP_PROVIDER_WEBHOOK` — `LEGACY_INBOUND_COMPATIBILITY` for old events |
| `/api/webhooks/brevo-inbound` | `KEEP_PROVIDER_WEBHOOK` — optional backup |
| `/api/webhooks/clerk` | `KEEP_PROVIDER_WEBHOOK` |

---

## Storage / R2

| Work | Classification |
| --- | --- |
| Upload handshake | `KEEP_SYNCHRONOUS` (authorize → presign → PUT → complete) |
| Soft-delete + `purgeAfter` | `KEEP_SYNCHRONOUS` / operator |
| Scheduled hard purge | `DEFERRED_WITH_REASON` — do not invent destructive delete |
| Backup | `DEFERRED_WITH_REASON` — no independent target. Primary R2 is not the backup. |
| Orphan object delete | `DEFERRED_WITH_REASON` — never auto-delete |

---

## Interactive / request-bound

| Work | Classification |
| --- | --- |
| Leo chat / hints / wizard | `KEEP_SYNCHRONOUS` |
| Scheme confirm | `KEEP_SYNCHRONOUS` |
| Parent Paystack reconcile poll | `KEEP_SYNCHRONOUS` |
| Admin insights `batch-generate` | `DEFERRED_WITH_REASON` |
| Report generate / compile | `KEEP_SYNCHRONOUS` / `DEFERRED_WITH_REASON` |
| Manual platform email IMAP sync | `KEEP_SYNCHRONOUS` |
| Subscription lifecycle script | `DEFERRED_WITH_REASON` — operator CLI |

---

## Remaining fire-and-forget (`BEST_EFFORT_ALLOWED`)

Loss is acceptable. Not unexplained business-critical persistence.

| Location | Work |
| --- | --- |
| Delegation / lesson-note / exam notify | in-app notify |
| Admissions analytics IIFE | analytics |
| `writeRetryableAuditEvent` in-process retry | audit (tier 1) |
| Proposal inbound reply `.catch` | follow-up |
| Metrics SSE `void task()` | stream |
| Client `void fetch` view tracking | UX |
| Subscription guard `recordSubscriptionEvent().catch` | entitlement audit |

No production `after()` remains in `src/` for business work.

---

## Deleted / unused helpers (Prompt 5)

| Symbol | Classification |
| --- | --- |
| `processCommunicationOutbox` | `REMOVE` |
| `triggerProvisioningRunnerBestEffort` | `REMOVE` |
| `runEmailDispatchJob` | `REMOVE` if still unused |

`EmailDispatchJob` model remains `LEGACY_READ_ONLY`.

---

## Task Center / operator

| Surface | Classification |
| --- | --- |
| `/admin/background-tasks`, `/teacher/background-tasks` | Prompt 5 user Task Center |
| `/platform/background-work` | Prompt 5 operator console |
| `GET /api/background-jobs` | user list (mine / school-admin scope) |
| `POST /api/background-jobs/[id]/retry` | user retry (safe kinds) |
| `POST /api/platform/background-work/jobs/[id]/redispatch` | operator redispatch |
| `POST /api/platform/background-work/jobs/[id]/retry` | operator retry |

---

## Email provider

Resend is the active outbound provider. `sendTrackedEmail` is the canonical helper; `sendTrackedBrevoEmail` is a deprecated alias. Brevo webhooks stay for old events only.
