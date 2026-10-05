# Background Work Engine — Email Migration (Prompt 2)

Inventory of email-producing flows before and after moving outbound delivery onto `BackgroundJob` + Inngest.

## Old architecture

```
EmailMessage + EmailDispatchJob + GET /api/cron/email-dispatch + runEmailDispatchJob()
```

Self-hosted Coolify never ran `vercel.json` crons, so queued mail sat until an external scheduler hit the cron route.

## New architecture

```
EmailMessage (delivery record)
  + BackgroundJob kind=EMAIL_DISPATCH (orchestration)
  + Inngest
  + tracked email worker → Resend
```

Critical invitations still attempt Resend immediately. Provider failure enqueues one `EMAIL_DISPATCH` job against the **same** EmailMessage.

Inngest events contain only routing IDs (`jobId`, `kind`, optional `schoolId`). Worker loads EmailMessage from Mongo.

## Classification key

- `IMMEDIATE_WITH_INNGEST_RETRY` — send now; on failure enqueue EMAIL_DISPATCH
- `INNGEST_ASYNC` — persist EmailMessage, enqueue EMAIL_DISPATCH, do not wait for Resend
- `KEEP_SYNCHRONOUS` — request-bound send (optional enqueueOnFailure)
- `KEEP_PROVIDER_WEBHOOK` — authenticate, persist, return promptly
- `NEEDS_REVIEW` — residual / later prompt

---

## Inventory

| Source | Immediate / async | Template | EmailMessage | Invitation | Retry | User-facing | School-scoped | Target user | Migration |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `issueInvitation` (school admin, teacher, parent, bursar, billing, delegate, resend) | Immediate | Role template | Yes | Yes | enqueueOnFailure | Yes | Yes | Invited person | `IMMEDIATE_WITH_INNGEST_RETRY` |
| Platform school create contact | Immediate | `SCHOOL_CREATED_CONTACT` | Yes | No | enqueueOnFailure | Yes | Yes | School contact | `IMMEDIATE_WITH_INNGEST_RETRY` |
| Platform staff / bootstrap | Immediate | raw | No / staff profile | No canonical Invitation | No | Operator | No | Staff | `KEEP_SYNCHRONOUS` (intentional) |
| Lesson published | Async | `LESSON_PUBLISHED_STUDENT` | Yes | No | Worker | Yes | Yes | Student user | `INNGEST_ASYNC` |
| Library notices | Async | LIBRARY_* | Yes | No | Worker | Yes | Yes | Borrower user | `INNGEST_ASYNC` |
| Subscription renewal notices | Cron schedules, async send | renewal template | Yes | No | Worker | Yes | Yes | Billing recipient | `INNGEST_ASYNC` (delivery only) |
| Subscription receipts | Async | `PAYMENT_RECEIPT` | Yes | No | Worker | Yes | Yes | Billing recipient | `INNGEST_ASYNC` |
| Paystack fee receipts | After ledger commit, async | `PAYMENT_RECEIPT` | Yes | No | Worker | Yes | Yes | Parent | `INNGEST_ASYNC` |
| Application confirmation | Immediate + was second async create | `APPLICATION_RECEIVED` | Yes | No | enqueueOnFailure (same message) | Yes | No | Applicant | `IMMEDIATE_WITH_INNGEST_RETRY` |
| Admin/platform compose | Immediate | compose templates | Yes | No | No | Yes | Varies | Picked recipient | `KEEP_SYNCHRONOUS` |
| Proposal send | Immediate + PDF | proposal | Yes | No | No | Yes | No | Prospect | `KEEP_SYNCHRONOUS` |
| Admissions decision / tracker / applicant emails | Immediate | admissions templates | Yes | No | No | Yes | Yes | Applicant/parent | `KEEP_SYNCHRONOUS` |
| Public contact | Immediate | contact | Yes | No | No | Yes | No | Support inbox | `KEEP_SYNCHRONOUS` |
| Fee reminders | Immediate | reminder | Yes | No | No | Yes | Yes | Parent | `KEEP_SYNCHRONOUS` |
| Payment-setup notices | Immediate | payment setup | Yes | No | No | Yes | Yes | School admin | `KEEP_SYNCHRONOUS` |
| Delegation emails | Immediate | delegation | Yes | No | No | Yes | Yes | Delegate | `KEEP_SYNCHRONOUS` |
| Parent student notification emails | Immediate | parent | Yes | No | No | Yes | Yes | Parent | `KEEP_SYNCHRONOUS` |
| Admissions weekly digest | Cron + immediate send | digest | Yes | No | Per-recipient try | Yes | Yes | Admissions staff | `KEEP_SYNCHRONOUS` (scheduling later) |
| Communication outbox email channel | Request-bound `async: false` | `SCHOOL_MANUAL_EMAIL` | Yes | No | Outbox job | Yes | Yes | Recipient | `KEEP_SYNCHRONOUS` — do not migrate CommunicationOutboxJob |
| Admin bulk email | Per-recipient queued | bulk template | Yes | No | Worker | Yes | Yes | Recipients | `INNGEST_ASYNC` (one job per EmailMessage) |
| Resend inbound webhook | Provider callback | n/a | Inbound row | No | Was inbound_route job | n/a | Varies | n/a | `KEEP_PROVIDER_WEBHOOK` + in-process unrouted attach |
| Brevo events webhook | Provider callback | n/a | Status update | No | n/a | n/a | n/a | n/a | `KEEP_PROVIDER_WEBHOOK` |
| Paystack webhook | Provider callback | receipt after posting | Yes if receipt | No | Worker | Yes | Yes | Parent | `KEEP_PROVIDER_WEBHOOK` + `INNGEST_ASYNC` receipt |
| IMAP recovery cron | Scheduled | inbound | Inbound | No | Own cron | n/a | n/a | n/a | `NEEDS_REVIEW` / later — keep `/api/cron/imap-recovery` |

## EmailMessage vs BackgroundJob

- **EmailMessage:** recipient, subject/body, template, provider message id, delivery status, suppressions, webhook reconciliation.
- **BackgroundJob:** queued/running/failed orchestration, Inngest correlation, retries, progress. Input is `{ emailMessageId }` only.

## Provider idempotency

Resend HTTP API supports `Idempotency-Key`. Worker sends `email-<EmailMessageId>`. Residual: a *different* EmailMessage id would still send twice. Callers must reuse one EmailMessage.

## Attachment strategy

EmailMessage stores metadata (`storageKey`), not bytes. Worker reconstructs:

- `Payment` → regenerate fee receipt PDF
- `SubscriptionInvoice` → regenerate subscription receipt PDF
- `storageKey` → server storage fetch
- Immediate compose/proposal stays request-bound with `contentBase64`

## Legacy EmailDispatchJob

LEGACY_READ_ONLY after this prompt. Historical rows remain. Operator script can enqueue BackgroundJobs for retryable outbound/batch rows. Do not require Coolify cron.

## Residual

- Unrouted inbound attach is best-effort in-process; leftover unrouted inbound is not a cron dependency.
- IMAP mailbox sync remains on its own cron.
- Communication outbox remains request-bound.
- Renewal *scheduling* remains cron; only delivery uses Inngest.
