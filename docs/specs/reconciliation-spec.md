# EduSentrix - Reconciliation Spec

This spec documents the payment reconciliation system: deterministic matching, ingestion pipelines, alerts, cron jobs, and recommended updates. The system reconciles internal payment records against gateway settlements and bank statements.

**Scope:** Admin/Finance staff. **Out of scope:** Full accounting chart of accounts, multi-currency FX reconciliation.

---

## 1. Overview

### Goals

1. **Single source of truth** — Internal ledger (Payments), gateway events (Paystack), bank statements
2. **Deterministic matching** — Auto-match gateway/bank rows to payments by reference, amount, and date
3. **Full audit trail** — Every status change logged in PaymentAuditEvent
4. **Reconciliation-ready** — Statuses flow from `unmatched` → `gateway_verified` → `bank_matched` → `fully_reconciled`

### Reconciliation Sources

| Source      | Type   | Description                                              |
|------------|--------|----------------------------------------------------------|
| Gateway    | Paystack | Settlement exports, transaction lists, webhook events  |
| Bank       | CSV    | Bank statements (MoMo, bank transfers)                   |
| Manual     | UI     | Staff-entered evidence for cash/cheque                   |

---

## 2. Data Models

### 2.1 Payment (`src/models/Payment.ts`)

| Field                | Type           | Purpose                                          |
|----------------------|----------------|--------------------------------------------------|
| `schoolId`           | ObjectId       | School scope                                     |
| `studentId`          | ObjectId       | Payer (student)                                  |
| `invoiceId`          | ObjectId       | Invoice being paid                               |
| `amountMinor`        | number         | Amount in minor units (pesewas)                  |
| `paymentDate`        | Date           | When payment was received                        |
| `paymentMethod`      | enum           | cash, bank_transfer, mobile_money, paystack, cheque, other |
| `paystackReference`  | string (sparse)| **Critical for reconciliation** — Paystack ref   |
| `paystackTransactionId` | string     | Paystack transaction ID (backup)                 |
| `receiptNumber`      | string         | RCP-2024-001                                     |
| `externalReference`  | string         | Bank/MoMo reference                              |
| `reconciliationStatus` | enum         | unmatched \| gateway_verified \| bank_matched \| fully_reconciled \| needs_review |
| `gatewayVerifiedAt`  | Date           | When gateway evidence matched                    |
| `bankMatchedAt`      | Date           | When bank evidence matched                       |
| `status`             | enum           | pending \| completed \| failed \| refunded \| reversed |
| `idempotencyKey`     | string         | Prevents duplicate payments                      |

**Indexes (reconciliation-relevant):**

- `{ schoolId, paystackReference }` — sparse unique
- `{ schoolId, receiptNumber }` — sparse
- `{ schoolId, externalReference }` — sparse
- `{ reconciliationStatus }`

### 2.2 ReconciliationIngestion (`src/models/ReconciliationIngestion.ts`)

Represents a row from a gateway export or bank statement waiting to be matched.

| Field             | Type     | Purpose                                      |
|-------------------|----------|----------------------------------------------|
| `schoolId`        | ObjectId | School scope                                 |
| `sourceType`      | enum     | gateway \| bank \| manual                     |
| `externalTxnId`   | string   | **Primary match key** — e.g. Paystack ref    |
| `normalizedReference` | string | Uppercased, alphanumeric only                |
| `rawReference`    | string   | Original reference text                      |
| `amountMinor`     | number   | Transaction amount                           |
| `transactionDate` | Date     | When transaction occurred                    |
| `status`          | enum     | unmatched \| matched \| ambiguous \| ignored |
| `matchMethod`     | enum     | none \| exact_external_id \| exact_reference \| amount_date_single \| manual |
| `matchedPaymentId`| ObjectId | Linked payment when matched                  |
| `candidatePaymentIds` | [ObjectId] | Candidates when ambiguous               |

**Unique index:** `{ schoolId, sourceType, externalTxnId }` — prevents duplicate ingestion rows.

### 2.3 ReconciliationRun

Tracks each reconciliation job execution:

- `schoolId`, `mode` (manual \| scheduled), `status` (running \| completed \| failed)
- `startedAt`, `completedAt`, `triggeredBy`
- `summary`: inspectedIngestion, matched, ambiguous, paymentStatusUpdated, errors

### 2.4 ReconciliationAlert

Per-school alert snapshots (e.g. stale reconciliation queue, ambiguous matches) for dashboard display.

### 2.5 PaymentAuditEvent

Immutable log of reconciliation status changes:

- `eventType: "reconciliation_updated"`
- `previousStatus`, `nextStatus`
- `metadata`: ingestionId, matchMethod, sourceType, automated

---

## 3. Reconciliation Flow

### 3.1 Status Progression

```
unmatched
    │
    ├─ Paystack payment with reference → gateway_verified (auto or via ingestion)
    │
    ├─ Bank/MoMo evidence ingested → bank_matched
    │
    └─ 48h+ without match → needs_review
    │
gateway_verified + bank_matched (or manual) → fully_reconciled
```

### 3.2 Match Methods (Confidence)

| Method                | Confidence | Description                                              |
|-----------------------|------------|----------------------------------------------------------|
| `exact_external_id`   | 100        | Gateway: externalTxnId matches paystackReference        |
| `exact_reference`     | 96         | Reference token matches receipt/external/paystack ref    |
| `amount_date_single`  | 78         | Single payment with same amount within ±2 days           |
| `manual`              | 100        | Staff explicitly links ingestion to payment             |
| `none`                | 0          | No match or ambiguous                                   |

### 3.3 Deterministic Logic (`src/lib/fees/reconciliation/deterministic.ts`)

1. **Reference normalization** — `normalizeReconciliationReference()`: uppercase, alphanumeric only.
2. **Match order:**
   - Exact external ID (gateway only)
   - Exact reference token
   - Amount + date within 2 days (single candidate only)
3. **Status refresh** — Cron updates payments:
   - Paystack + reference → `gateway_verified`
   - Both gateway + bank evidence → `fully_reconciled`
   - 48h+ without full reconciliation → `needs_review`

---

## 4. APIs

### 4.1 Ingestion

| Method | Route                                | Purpose                              |
|--------|--------------------------------------|--------------------------------------|
| GET    | `/api/admin/fees/reconciliation/ingestions` | List ingestions (filter: sourceType, status) |
| POST   | `/api/admin/fees/reconciliation/ingestions` | Ingest gateway/bank rows             |

**POST body:**

```json
{
  "sourceType": "gateway" | "bank" | "manual",
  "entries": [
    {
      "externalTxnId": "PAYSTACK_REF_123",
      "amountMinor": 50000,
      "transactionDate": "2024-02-20T10:00:00Z",
      "reference": "Optional human ref",
      "payerName": "John Doe",
      "payerPhone": "0241234567"
    }
  ]
}
```

### 4.2 Reconciliation Run

- **Manual:** Triggered from UI (`/admin/finance/reconciliation`)  
- **Scheduled:** Cron hits `/api/cron/reconciliation` with `RECONCILIATION_CRON_SECRET`

### 4.3 Manual Match

- **Apply match:** `applyManualReconciliationMatch(schoolId, ingestionId, paymentId, note)`
- **Unmatch:** API to clear link and reset ingestion status

---

## 5. Cron Job

**Route:** `GET /api/cron/reconciliation`

**Auth:** `Authorization: Bearer <RECONCILIATION_CRON_SECRET>` or `x-cron-secret`

**Behavior:**

1. Fetch active schools (limit from query param, default 50)
2. For each school:
   - Run `runDeterministicReconciliation`
   - Sync reconciliation alerts
3. Return summary: `processedSchools`, `updatedPayments`, `matchedIngestion`, `ambiguousIngestion`, `runs[]`

---

## 6. Alerts (`src/lib/fees/reconciliation/alerts.ts`)

| Alert Key                 | Severity  | Description                                |
|---------------------------|-----------|--------------------------------------------|
| `stale_pending_approvals` | critical  | Pending approvals > 24h                    |
| `stale_reconciliation_queue` | warning | Completed payments not reconciled > 48h   |
| `ambiguous_ingestion_items` | warning | Ingestion rows with multiple candidates  |
| `unmatched_ingestion_aging` | info    | Unmatched rows > 48h                      |

---

## 7. Recommended Updates & Improvements

### 7.1 Reference Capture (High Priority)

- **Requirement:** Every payment must store a reconcilable reference.
- **Cash:** `receiptNumber` (e.g. RCP-2024-001).
- **Bank/MoMo:** `externalReference` from bank statement.
- **Paystack:** `paystackReference` from gateway (webhook or ingestion).
- **Validation:** Reject manual payment creation without at least one reference when `paymentMethod` is paystack, bank_transfer, or mobile_money.

### 7.2 Paystack Webhook for School Fees

- **Current:** Webhook handles only fundraising donations (`metadata.donationId`).
- **Enhancement:** Support `metadata.invoiceId` + `metadata.studentId` + `metadata.paymentIntentId` for fee payments.
- **On `charge.success`:** Create or update Payment with `paystackReference`, set `reconciliationStatus: "gateway_verified"`, link to PaymentIntent.

### 7.3 Bank CSV Import

- **Add:** Bulk CSV upload for bank statements.
- **Mapping:** Configurable columns → externalTxnId, amount, date, reference, payer name.
- **Preprocessing:** Normalize dates, strip currency symbols, parse amounts to minor units.
- **Validation:** Duplicate externalTxnId per sourceType → update existing ingestion row.

### 7.4 SLA Configuration

- **Current:** Hardcoded 48h for `needs_review`, 24h for pending approvals.
- **Enhancement:** School-level config (e.g. `reconciliationSlaHours`, `approvalSlaHours`) or environment defaults.

### 7.5 Date Match Window

- **Current:** ±2 days for amount_date matching.
- **Consideration:** Make configurable (e.g. 1–7 days) per school if bank processing varies.

### 7.6 Ingestion Deduplication

- **Current:** Unique on `(schoolId, sourceType, externalTxnId)`.
- **Enhancement:** On re-ingestion of same externalTxnId, update amount/date/reference and reset status to `unmatched` if previously ambiguous/ignored.

### 7.7 Gateway Export Auto-Ingestion

- **Future:** Scheduled job to fetch Paystack settlement/transaction exports and auto-ingest as `sourceType: gateway` rows.
- **Idempotency:** Use Paystack transaction ID as externalTxnId.

### 7.8 Reporting

- **Reconciliation dashboard:** Counts by status, aging buckets, link to queues.
- **Export:** Reconciliation report (payments + ingestions + match status) for audit.

---

## 8. Security & Compliance

- **Auth:** All admin reconciliation APIs require `requireFinanceStaff`.
- **Cron:** Protected by `RECONCILIATION_CRON_SECRET`.
- **Audit:** All reconciliation status changes logged in PaymentAuditEvent.
- **Idempotency:** Payment creation uses `idempotencyKey` to prevent duplicates.

---

## 9. File Reference

| File | Purpose |
|------|---------|
| `src/app/api/cron/reconciliation/route.ts` | Cron handler |
| `src/lib/fees/reconciliation/deterministic.ts` | Match + status logic |
| `src/lib/fees/reconciliation/alerts.ts` | Alert sync |
| `src/models/ReconciliationIngestion.ts` | Ingestion model |
| `src/models/ReconciliationRun.ts` | Run tracking |
| `src/models/ReconciliationAlert.ts` | Alert snapshots |
| `src/app/api/admin/fees/reconciliation/ingestions/route.ts` | Ingestion CRUD |
| `src/app/(app)/admin/finance/reconciliation/page.tsx` | Reconciliation UI |
