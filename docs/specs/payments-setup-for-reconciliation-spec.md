# EduSentrix - Payments Setup for Reconciliation Spec

This spec describes how to set up payment flows so that reconciliation is easy, intuitive, and industry-standard. The design ensures every payment has reconcilable references, gateway events flow into the ledger, and bank evidence can be matched deterministically.

---

## 1. Approach & Philosophy

### 1.1 Core Principle: Reference-First Payments

> Every payment must carry at least one **reconcilable reference** that can be matched against external evidence (gateway, bank, MoMo).

| Payment Method | Internal Reference | External Reference |
|----------------|-------------------|--------------------|
| Cash | `RCP-YY-NNNNNN` (auto) | `receiptNumber` (optional) |
| Bank Transfer | `BNK-YY-NNNNNN` (auto) | `externalReference` (bank ref) |
| Mobile Money | `MOM-YY-NNNNNN` (auto) | `externalReference` (MoMo ref) |
| Paystack | `PSK-YY-NNNNNN` (auto) | `paystackReference` (gateway) |
| Cheque | `CHQ-YY-NNNNNN` (auto) | `receiptNumber` + `externalReference` |
| Other | `PAY-YY-NNNNNN` (auto) | Optional |

Every payment gets an **internal reference** (`internalReference`) auto-generated at creation. Format: `{PREFIX}-{YY}-{SEQ}` where PREFIX is by payment method, YY is short year, SEQ is 6-digit sequence per school per year.

### 1.2 Industry Standards Applied

1. **Idempotency** — Every payment creation accepts `idempotencyKey`; duplicate requests return existing payment
2. **Webhook-first** — Gateway confirmations (Paystack) drive payment state; manual recording is fallback
3. **Immutable audit trail** — No silent edits; use reversals, adjustments, and audit events
4. **Three-way reconciliation** — Internal ledger ↔ Gateway settlements ↔ Bank statements
5. **Reference propagation** — Reference flows: Paystack ref → Payment → always stored

---

## 2. Payment Flows (Reconciliation-Optimized)

### 2.1 Online Payment (Paystack) — Webhook-Driven

This is the **primary path** for online fee payments. Reconciliation is automatic.

```
Parent initiates payment
    → Create PaymentIntent (invoiceId, studentId, amount, idempotencyKey)
    → Redirect to Paystack with reference = paymentIntentId or custom ref
    → Paystack charge.success webhook
    → Webhook: Look up PaymentIntent by reference
    → Create Payment with paystackReference, link to PaymentIntent
    → Auto-set reconciliationStatus = gateway_verified
    → Allocate to invoice line items
```

**Critical: Paystack reference**

- Use a deterministic reference: e.g. `FEE-{schoolId}-{invoiceId}-{timestamp}` or `{paymentIntentId}`
- Store this in PaymentIntent before redirect
- Webhook receives same reference → 1:1 match

**Webhook handler extension (recommended):**

```ts
// In handleChargeSuccess
if (metadata?.invoiceId && metadata?.studentId) {
  // School fee payment - create/update Payment
  await handleFeePaymentSuccess(data, metadata);
  return;
}
if (metadata?.donationId) {
  // Existing fundraising flow
  await handleDonationSuccess(...);
  return;
}
```

### 2.2 Manual Payment (Cash, Bank, MoMo, Cheque)

Staff records payment in UI. **Always require a reference** when available.

| Method | Required | Validation |
|-------|----------|------------|
| Cash | `receiptNumber` | Format: RCP-YYYY-NNN or similar |
| Bank Transfer | `externalReference` | From bank credit slip |
| Mobile Money | `externalReference` | MoMo transaction ID / reference |
| Paystack (manual entry) | `paystackReference` | From Paystack dashboard |
| Cheque | `receiptNumber` + optional `externalReference` | Cheque number |

**Duplicate detection:** Before creating, check for existing payment with same `paystackReference`, `receiptNumber`, or `externalReference` within school. Return 409 with `duplicates[]` if found (existing behavior).

### 2.3 Parent-Initiated Paystack (PaymentIntent Flow)

1. **Create PaymentIntent** (API)
   - `invoiceId`, `studentId`, `amountMinor`, `idempotencyKey`
   - Status: `initiated`
   - Generate `paystackReference` = `FEE-{schoolId}-{shortId}-{timestamp}` (shortId = first 8 of invoiceId or similar)

2. **Initialize Paystack**
   - Use Paystack SDK/API with `reference` = PaymentIntent’s stored reference
   - Metadata: `{ invoiceId, studentId, schoolId, paymentIntentId }`

3. **Webhook on charge.success**
   - Find PaymentIntent by `reference` (or metadata.paymentIntentId)
   - Create Payment with:
     - `paystackReference` = data.reference
     - `paystackTransactionId` = data.id (if provided)
     - `paymentMethod` = "paystack"
     - `reconciliationStatus` = "gateway_verified"
     - `paymentIntentId` → Payment
   - Update PaymentIntent → `succeeded`, link `paymentId`
   - Allocate payment to invoice

4. **Idempotency**
   - Webhook may retry; check Payment by `paystackReference` before creating
   - Return success without duplicate create

---

## 3. Reference Schema & Validation

### 3.1 Payment Creation Schema (Zod)

```ts
const PaymentCreateSchema = z.object({
  studentId: z.string().min(1),
  invoiceId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  paymentDate: z.string().datetime(),
  paymentMethod: z.enum([
    "cash", "bank_transfer", "mobile_money", "paystack", "cheque", "other"
  ]),
  receiptNumber: z.string().optional(),
  externalReference: z.string().optional(),
  paystackReference: z.string().optional(),
  idempotencyKey: z.string().optional(),
  // ... allocations, etc.
}).refine(
  (data) => {
    const hasRef =
      data.receiptNumber?.trim() ||
      data.externalReference?.trim() ||
      data.paystackReference?.trim();
    if (["paystack", "bank_transfer", "mobile_money"].includes(data.paymentMethod)) {
      return !!hasRef;
    }
    return true;
  },
  { message: "paystack, bank_transfer, and mobile_money require a reference" }
);
```

### 3.2 Normalization

- **Reference normalization:** Uppercase, alphanumeric only (used in reconciliation matching)
- **Receipt numbers:** Enforce format (e.g. RCP-2024-001) for consistency

---

## 4. Ingestion Pipelines

### 4.1 Gateway Ingestion (Paystack)

**Source:** Paystack dashboard export or Transactions API.

**Fields to map:**
- `externalTxnId` = Paystack `reference` or `id`
- `amountMinor` = amount (Paystack uses pesewas)
- `transactionDate` = `created_at` / `paid_at`
- `reference` = same as externalTxnId (for normalized match)
- `channel` = card, bank, ussd, etc.

**Flow:**
1. Export/API fetch → JSON/CSV
2. Map to ingestion schema
3. POST to `/api/admin/fees/reconciliation/ingestions` with `sourceType: "gateway"`
4. Run reconciliation → matches by `exact_external_id` to Payment.paystackReference

### 4.2 Bank Statement Ingestion (CSV)

**Source:** Bank or MoMo CSV export.

**Configurable column mapping (e.g. in school settings):**

| Logical Field | Example CSV Columns |
|---------------|----------------------|
| externalTxnId | Transaction ID, Ref, Payment Ref |
| amountMinor | Amount (parse to int), Credit |
| transactionDate | Date, Value Date |
| reference | Narration, Description, Remarks |
| payerName | Beneficiary, Sender, Payer |
| payerPhone | Sender Mobile |

**Preprocessing:**
- Parse dates (support multiple formats)
- Strip currency symbols (GHS, etc.)
- Convert amount to minor units
- Normalize reference for matching

**Flow:**
1. Upload CSV in Reconciliation UI
2. Preview + column mapping
3. Validate (duplicates, format errors)
4. POST to ingestions with `sourceType: "bank"`
5. Run reconciliation → matches by `exact_reference` or `amount_date_single`

### 4.3 Manual Ingestion

For cash/cheque where no electronic export exists — staff enters evidence manually. `sourceType: "manual"` → typically matches by `receiptNumber` or `amount_date` if needed.

---

## 5. Webhook Implementation (Paystack → School Fees)

### 5.1 Event: charge.success

**Handler logic:**

```
1. Verify signature
2. Parse event
3. If metadata.invoiceId + metadata.studentId:
   a. Find PaymentIntent by reference or metadata.paymentIntentId
   b. If Payment already exists (by paystackReference) → return (idempotent)
   c. Create Payment:
      - schoolId, studentId, invoiceId from metadata/PaymentIntent
      - amountMinor from data.amount
      - paystackReference = data.reference
      - paystackTransactionId = data.id
      - paymentMethod = "paystack"
      - reconciliationStatus = "gateway_verified"
      - gatewayVerifiedAt = now
      - status = "completed"
   d. Update PaymentIntent: status=succeeded, paymentId=...
   e. Allocate payment to invoice (use proposedAllocations or auto)
   f. Record in ledger
4. Else if metadata.donationId:
   → Existing fundraising flow
5. Else: log and skip
```

### 5.2 Metadata for Fee Payments

When initializing Paystack for school fees:

```ts
metadata: {
  invoiceId: string,
  studentId: string,
  schoolId: string,
  paymentIntentId: string,
  type: "school_fee"
}
```

---

## 6. Reconciliation UX Improvements

### 6.1 Recording Payment Modal

- **Paystack selected:** Show "Paystack reference (required)" — from Paystack transaction
- **Bank/MoMo selected:** Show "Bank/MoMo reference (required)"
- **Cash:** Show "Receipt number (required)" with format hint
- **Validation:** Disable submit until required reference present
- **Duplicate warning:** If reference exists, show "Possible duplicate" with link to existing payment

### 6.2 Reconciliation Dashboard

- **Queues:** Pending approvals | Needs reconciliation | Ambiguous matches | Unmatched ingestion
- **Filters:** By sourceType, status, date range
- **Bulk actions:** "Run reconciliation" for selected school
- **CSV import:** Upload bank statement → map columns → ingest

### 6.3 Payment Detail View

- **Reconciliation badge:** Show status (e.g. Fully reconciled, Gateway verified, Needs review)
- **Evidence:** Link to matched ingestion rows
- **Timeline:** gatewayVerifiedAt, bankMatchedAt in audit trail

---

## 7. File Changes Checklist

### 7.1 Paystack Webhook

- [ ] Extend `handleChargeSuccess` to handle `metadata.invoiceId` + `metadata.studentId`
- [ ] Add `handleFeePaymentSuccess` (create Payment, allocate, ledger)
- [ ] Idempotency: check Payment by paystackReference before create
- [ ] Link PaymentIntent ↔ Payment

### 7.2 Payment APIs

- [ ] Validate reference required for paystack, bank_transfer, mobile_money
- [ ] Ensure paystackReference from webhook is always stored
- [ ] Duplicate check returns 409 with duplicates[] (existing)

### 7.3 PaymentIntent API

- [ ] Generate deterministic Paystack reference
- [ ] Store reference in PaymentIntent before redirect
- [ ] Include full metadata (invoiceId, studentId, schoolId, paymentIntentId) for webhook

### 7.4 Reconciliation UI

- [ ] CSV upload for bank statements
- [ ] Column mapping config
- [ ] Validation and preview before ingest

### 7.5 School Settings (Optional)

- [ ] reconciliationSlaHours (default 48)
- [ ] approvalSlaHours (default 24)
- [ ] Bank CSV column mapping preset

---

## 8. Environment Variables

| Variable | Purpose |
|----------|---------|
| `PAYSTACK_SECRET_KEY` | Webhook verification, API calls |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Client-side init |
| `RECONCILIATION_CRON_SECRET` | Cron auth |

---

## 9. Testing Scenarios

1. **Webhook idempotency** — Same charge.success twice → single Payment
2. **Reference matching** — Ingest Paystack export → all Paystack payments matched
3. **Bank CSV** — Upload statement → amount+date match for single candidate
4. **Ambiguous** — Two payments same amount/date → ingestion stays ambiguous, manual match
5. **Manual reference** — Record bank payment without reference → validation error
6. **Duplicate reference** — Record payment with existing receiptNumber → 409 with duplicates

---

## 10. Summary

| Principle | Implementation |
|-----------|----------------|
| Reference-first | Require reference for gateway/bank/MoMo; validate on create |
| Webhook-driven | Paystack charge.success creates Payment with paystackReference |
| Idempotency | idempotencyKey + paystackReference check in webhook |
| Deterministic matching | exact_external_id, exact_reference, amount_date_single |
| Full audit | PaymentAuditEvent for every status change |
| Ingestion pipelines | Gateway export + Bank CSV + Manual entry |

By following this spec, payments are created with reconcilable references, gateway events automatically create and verify payments, and bank evidence can be ingested and matched—making reconciliation easy and intuitive.
