# Financial Background Findings Verification

Verification date: 2026-10-04. Scope: two financial findings raised during the background-work audit. No application code was changed, nothing was fixed, no production data was touched, and no real payment-provider calls were made.

Runtime evidence comes from `tests/verification/financial-findings.verify.ts`. It runs against an in-memory MongoDB 8.2 replica set (`mongodb-memory-server`) and is excluded from `npm test`. Run it with:

```bash
node --test --conditions=react-server --import tsx tests/verification/financial-findings.verify.ts
```

Result of the final run: **12 tests, 12 passed, 0 failed.**

## Executive Result

| Claim | Result | Severity | Runtime Test |
|---|---|---|---|
| 1. Invoice number collision | CONFIRMED | HIGH | Yes: 7 tests on the real `Invoice` model and `generateInvoiceNumber`, using the routes' exact count-then-create logic. The cross-school collision happens with no concurrency at all. |
| 2. Payment intent stuck in `processing` | CONFIRMED | CRITICAL | Yes: 5 tests, including the **real** `POST /api/webhooks/paystack` handler with an injected failure, redelivery, and the invoice-not-found case. |

---

## 1. Invoice Number Collision

### Original Claim

The original claim was that concurrent invoice creation can generate duplicate invoice numbers. The audit also said numbers collide across schools because the sequence is per school while uniqueness is global.

### Actual Implementation

**The number generator.** There is one, in `src/lib/fees/invoice-utils.ts`:

```ts
export function generateInvoiceNumber(year: number, sequence: number): string {
  return `INV-${year}-${sequence.toString().padStart(4, "0")}`;
}
```

The format contains no school, tenant or random component.

**Every code path that creates a fee invoice.** Subscription billing uses a separate model, `SubscriptionInvoice`, and is out of scope.

| Path | File / function | How the sequence is computed | Transaction |
|---|---|---|---|
| Single create | `src/app/api/admin/fees/invoices/route.ts` `POST` | `Invoice.countDocuments({ schoolId }) + 1` | `session.withTransaction`, which retries on transient errors |
| Bulk create | `src/app/api/admin/fees/invoices/bulk/route.ts` `POST` | One `countDocuments({ schoolId })`, then `count + i + 1` per student | Manual `startTransaction`, no retry |
| Library fine/replacement | `src/lib/library/library-fee-persistence.ts` `persistStudentLibraryReturnFees`, called from `library-loan.service.ts` | `countDocuments({ schoolId }) + 1` | Uses the caller's session |

The generator does not use an atomic counter, `findOneAndUpdate` + `$inc`, `Date.now`, or any random value. The repo already has an atomic counter pattern, `PaymentReferenceCounter`, but it is used only for payment references.

**Other code that changes the count.** `DELETE src/app/api/admin/fees/invoices/[id]/route.ts` hard-deletes cancelled invoices. That lowers `countDocuments`, so a later invoice can be given a number that is still in use.

### Database Guarantees

**The schema.** `src/models/Invoice.ts` declares:

```ts
invoiceNumber: { type: String, required: true, unique: true, trim: true }
invoiceSchema.index({ schoolId: 1, studentId: 1, academicPeriodId: 1 }, { unique: true });
```

**The indexes MongoDB actually built from that schema** (captured in test `1.index`): `invoiceNumber_1 { invoiceNumber: 1 } unique: true`. The unique key is **global**; it is not scoped by `schoolId`.

**Production may not have this index at all.** `src/db/connectToDatabase.ts` connects with `autoIndex: process.env.NODE_ENV !== "production"`.

- Mongoose therefore never builds the index in production.
- No script syncs `Invoice` indexes either (`rg syncIndexes scripts` finds only library and flashcard-deck scripts).
- The index exists in production only if something else created it, for example a non-production process connected to the same database.

**What happens when a duplicate is attempted:**

| Index state | Same number attempted | Result |
|---|---|---|
| Unique index present | Inside a transaction, while the other insert is not yet committed | `WriteConflict` (code 112, `TransientTransactionError`). `withTransaction` retries it; the manual bulk transaction does not. |
| Unique index present | After the other insert has committed | `E11000` duplicate key. This is not transient, so it is never retried and the request returns 500. |
| Unique index absent | Any | The duplicate is saved silently. |

No code retries after an E11000 by generating a new number.

### Concurrency Analysis

**Path A: across schools, no concurrency needed.**

1. School A creates its first invoice and gets `INV-2026-0001`.
2. School B's count is 0, so its first invoice is also `INV-2026-0001`.
3. With the index, School B gets E11000. Every new invoice from School B fails until its count passes School A's range, and School A keeps growing, so the overlap never clears.

**Path B: same school, concurrent requests.**

1. Two transactions both read `count = N` and both generate `N+1`.
2. With the index, the second insert hits a write conflict. Single create retries, re-counts and succeeds. Bulk create fails.

**Path C: same school, after a delete.**

1. The school has `0001` to `0003`.
2. Cancelling and deleting `0001` drops the count to 2.
3. The next invoice is generated as `0003`, which already exists, so the insert fails with E11000.

### Verification Test

All tests use the real `Invoice` model and the real `generateInvoiceNumber`. They replay the routes' exact statement order (count, generate, `Invoice.create` in the same session). The route handlers themselves weren't called, because they require Clerk authentication. A barrier makes both concurrent transactions read the count before either one inserts.

| Test | Scenario | Observed result |
|---|---|---|
| `1.index` | `syncIndexes` | `invoiceNumber_1` is unique and global |
| `(a)` | School A, then School B, sequentially, with the index | B single create: **E11000 on `INV-2026-0001`**. B bulk (2 students): **E11000, transaction aborted, 0 invoices created** |
| `(b1)` | Same school, 2 concurrent single creates, with the index | Both generated `INV-2026-0001`. The second hit a write conflict, `withTransaction` retried (attempts = 2), re-counted and got `INV-2026-0002`. **No duplicate saved.** |
| `(b2)` | Same school, 2 concurrent bulk creates, with the index | One succeeded. The other failed with **`WriteConflict` (112, `TransientTransactionError`), returning 500 to the user.** No duplicate saved. |
| `(b3)` | Same school, 5 concurrent single creates, no barrier | All 5 succeeded after retries (attempts = 1, 2, 3, 4, 1). Numbers `0001` to `0005`, no duplicate. |
| `(c)` | **No unique index**, as in production with `autoIndex:false` | Schools A and B both saved `INV-2026-0001`. Two concurrent creates in School C both saved `INV-2026-0001`. **4 invoices with the same number were saved, including 2 inside one school.** |
| `(d)` | 3 invoices, then cancel and delete `0001`, then create | Generated `INV-2026-0003`, which already existed: **E11000** |

### Result

The number generator produces colliding numbers in every multi-school deployment, with no concurrency needed. What the business experiences depends on whether the global unique index exists in the production database:

- **If the index exists:** every school except the first that reaches a given sequence number cannot create invoices, through single, bulk or library-fine paths. Bulk creation rolls back entirely. Deleting a cancelled invoice also blocks creation within one school.
- **If the index does not exist:** invoice numbers are silently reused across schools and within a school, both under concurrency and after deletes. Receipts, statements, exports and the ledger (`writeLedgerEntry` stores `invoiceNumber`) then carry ambiguous document numbers.

Concurrent creation within one school is partly protected: single create recovers through the `withTransaction` retry, but bulk create fails. The failure across schools is certain, not a race.

Not verified: whether `invoiceNumber_1` exists in the production database. That needs a read-only `db.invoices.getIndexes()` against production, which this verification was not allowed to do.

### Severity

**HIGH.** The defect is a certainty in a multi-tenant product. It either blocks fee billing for later schools or corrupts the uniqueness of legal and financial document numbers. It is not CRITICAL because it does not move or lose money, and the failure is loud (a 500) when the index exists.

### Recommended Fix

Not implemented.

1. Generate numbers from an atomic per-school counter: `findOneAndUpdate({ schoolId, year }, { $inc: { seq: 1 } }, { upsert: true, new: true })` inside the same session. `PaymentReferenceCounter` is a precedent. Never derive a number from `countDocuments`.
2. Scope uniqueness to the school: replace the global `invoiceNumber` unique index with `{ schoolId: 1, invoiceNumber: 1 }` unique. Optionally add a school prefix to the number.
3. Before changing indexes, run a read-only audit for existing duplicate numbers per school and across schools. Decide how to renumber, then migrate.
4. Sync indexes explicitly in production. With `autoIndex:false`, add a reviewed index-sync step for financial models and stop relying on chance.
5. Do not let deletion affect numbering. The counter fixes this automatically.
6. Optionally, on E11000 for `invoiceNumber`, retry with the next counter value.

### Inngest Relevance

**None.** Invoice creation is interactive and must commit atomically in the request. Inngest would not prevent the collision. The fix is a data-model and index change.

VERDICT: CONFIRMED

---

## 2. Payment Intent Stuck in Processing

### Original Claim

`handleFeePaymentSuccess` moves a PaymentIntent to `processing`. If anything throws afterwards, the intent stays in `processing`: Paystack retries and the fallback routes both skip it, so the Payment is never created.

### Actual State Machine

**Model:** `PaymentIntent` (`src/models/PaymentIntent.ts`, collection `paymentintents`). It covers school fee payments only. Learn, subscription, admissions and store payments use other models and other handlers.

**Schema enum:** `initiated | awaiting_webhook | succeeded | failed | cancelled | expired`. **`processing` is not in the enum.**

- The webhook writes it through `findOneAndUpdate` without `runValidators`, so Mongoose saves it anyway (test `2a`).
- Any later `doc.save()` or `validate()` on that intent fails with ``status: `processing` is not a valid enum value`` (test `2a`).
- No code sets `cancelled` or `expired` on a fee `PaymentIntent`. The `{ status: 1, expiresAt: 1 }` index is commented "For cleanup", but no cleanup job exists.

| FROM | EVENT | TO | FILE / FUNCTION | RECOVERY IF INTERRUPTED |
|---|---|---|---|---|
| (none) | Parent starts checkout | `initiated` | `parent/payments/checkout/route.ts` `POST` (`PaymentIntent.create`, `idempotencyKey: randomUUID()`) | n/a |
| `initiated` | `initializeTransaction` succeeds | `awaiting_webhook` (+ `paystackReference`, `expiresAt` +1h) | same | If the process dies between create and update, the intent stays `initiated` without a reference. `reconcile-pending` requires a reference, so it ignores it. |
| `initiated` | `initializeTransaction` throws | `failed` | same (inner and outer `catch`) | — |
| `initiated` / `awaiting_webhook` | `charge.success` webhook takes the lock | **`processing`** | `webhooks/paystack/route.ts` `handleFeePaymentSuccess` (~L610) | **None** (see gap analysis) |
| `processing` | A Payment already exists for the reference | `succeeded` | same (~L680), write errors swallowed by `.catch(() => undefined)` | Only reached if the Payment exists |
| `processing` | `Payment.create` succeeds | `succeeded` | same (~L869), write errors swallowed by `.catch(() => undefined)` | If this write fails, the intent stays `processing`, but the Payment exists, so the parent's status lookup still finds it |
| `awaiting_webhook` / `initiated` | Parent polls; Paystack verify returns `failed`/`abandoned` | `failed` | `parent/payments/checkout-status/route.ts` `GET` | Only while the parent polls this reference |
| `awaiting_webhook` / `initiated` | Parent opens `/parent/fees`; verify returns `failed`/`abandoned` | `failed` | `parent/payments/reconcile-pending/route.ts` `GET` | Only the initiating parent, only within 48h, at most 10 intents |
| `awaiting_webhook` / `initiated` | Either route; verify returns `success` | Re-posts a signed `charge.success` to the webhook over HTTP | both routes | Same limits as above |
| any | Fee `charge.failed` webhook | **no transition** | the webhook handles `charge.failed` only for admissions and Learn | none |

### Processing Entry Points

There is exactly one:

- `handleFeePaymentSuccess` in `src/app/api/webhooks/paystack/route.ts`, at ~L610.
- It runs `PaymentIntent.findOneAndUpdate({ _id, status: { $in: ["initiated","awaiting_webhook"] } }, { $set: { status: "processing" } })`.
- It is reached in three ways: a Paystack delivery, the self-POST from `checkout-status`, or the self-POST from `reconcile-pending`.
- No external API call happens before this write. It is the first write in the handler.

Search evidence: `rg '"processing"' src --glob '!*.tsx' | rg -i 'intent|paystack|payment'` returns only `webhooks/paystack/route.ts:617`.

### Processing Exit Points

There are exactly two, both in `handleFeePaymentSuccess`:

1. **~L680:** a `Payment` with the same `paystackReference` already exists. The intent moves to `succeeded`, and the write error is swallowed.
2. **~L869:** after `Payment.create` succeeds. The intent moves to `succeeded`, and the write error is swallowed.

No other file in `src` reads or writes fee `PaymentIntent` status, apart from the checkout, checkout-status, reconcile-pending and webhook routes. `provider-sync.ts` only counts documents per school. The `PaymentIntent` references in the admin Learn and finance receipt routes are to `LearnPaymentIntent`, a different model.

### Recovery Mechanisms

| Mechanism | Handles `processing`? | Evidence |
|---|---|---|
| Paystack webhook retry | **No.** The lock filter requires `initiated`/`awaiting_webhook`. With no Payment, the handler logs "already being processed" and returns 200. | test `2b`: redeliveries return 200 and the intent stays `processing` |
| `checkout-status` fallback | **No.** It only retries when the status is `awaiting_webhook`/`initiated`, and reports `processing` as `"pending"`. | code at L217-220 and L271-278; test `2b` `checkoutStatusWouldRetry: false`, `parentSees: "pending"` |
| `reconcile-pending` | **No.** Its query is `status: { $in: ["awaiting_webhook","initiated"] }`. | code at L196; test `2b` `reconcilePendingQueryMatches: 0` |
| Cron jobs (11 `/api/cron/*` routes) | **No.** None reference `PaymentIntent`. | `rg -l PaymentIntent src/app/api/cron src/lib/jobs src/lib/fees` finds nothing |
| Deterministic reconciliation (`src/lib/fees/reconciliation/*`) | **No.** It works on `Payment` and ingestions only. | same search |
| Stale or expiry cleanup | **No.** No code writes `expired`, and the `{status, expiresAt}` index is unused. | search for `"expired"` writes |
| Admin finance tooling | **No.** There is no route to list or repair fee intents. | search across admin routes |

### Failure Gap Analysis

The questions you asked, answered in order:

1. **Can the record be set to `processing` before an external call that might fail?** It is set before many database writes. The handler makes no external API calls before `Payment.create`. The failure window is roughly 8 database operations: invoice lookup, line-item read, line-item `bulkWrite`, credit `$inc`, two `InvoiceEvent.create` calls, `generatePaymentInternalReference`, and `Payment.create`.
2. **If a step throws, is the status repaired?** No. Nothing in the handler catches the error. The outer `POST` catch returns 500 without touching the intent.
3. **If the HTTP request dies after `processing`, what repairs it?** Nothing. A process kill or a deploy restart on the long-running Coolify container behaves the same as an exception.
4. **If Paystack succeeds but the webhook is delayed or lost, what repairs it?** `checkout-status` (while the parent polls) or `reconcile-pending` (when the initiating parent revisits `/parent/fees` within 48h) re-post the event. Nothing runs on a schedule. If the parent never returns, the intent stays `awaiting_webhook` forever and the payment is never recorded.
5. **If the webhook arrives twice?** It is safe on the happy path. In test `control`, two concurrent deliveries gave both 200, one Payment, and an intent of `succeeded`. After a failure, every duplicate is acknowledged and dropped (test `2b`).
6. **If the provider reports failure, is the transition correct?** Not by webhook: fee `charge.failed` is ignored. The status moves to `failed` only through the parent-driven verify routes.
7. **Is there a timeout or expiry for stale processing intents?** No.
8. **Is there a scheduled reconciliation?** Not for intents. Deterministic reconciliation exists for payments, but it doesn't look at intents, and its cron route isn't scheduled anywhere in the repo.
9. **Does any job recover stale `processing` records?** No.
10. **Can a user retry payment while the old intent is `processing`?** Yes, with nothing to stop it. Checkout always creates a new intent with a random idempotency key and charges the invoice's `totalOutstandingMinor`, which still shows the full amount (test `2b`: invoice header `issued`, outstanding 50,000). The parent can be charged twice.
11. **Is `processing` accidentally terminal?** **Yes.** No code ever moves an intent out of `processing` unless a Payment already exists.
12. **Do queries deliberately exclude old `processing` records?** Yes. Both fallback queries whitelist only `initiated`/`awaiting_webhook`, which excludes `processing` by construction.

**Partial writes left behind** (test `2b`, the most serious result):
- After the injected failure at the first `InvoiceEvent.create` (~L803), the invoice line item had already been saved as **`amountPaidMinor: 50000`, status `paid`**.
- No `Payment`, no `InvoiceEvent`, and no ledger entry exist.
- The invoice header still says `issued`, `totalPaidMinor: 0`, `totalOutstandingMinor: 50000`.
- The fee records are now inconsistent: the line items say paid, the header says unpaid, and no Payment backs either.
- Paystack has collected the money and settled it to the school's subaccount. EduSentrix has no record of it.
- If an overpayment were involved, the `StudentCreditBalance` `$inc` would also have run before the failure.

**Invoice-not-found path** (test `2c`). This needs no exception at all:
- After the lock, `Invoice.findOne` returns null (for example, the invoice was cancelled and deleted after checkout started).
- The handler logs an error and **returns 200**, leaving the intent in `processing` permanently.

### Verification Test

**Harness:**
- The **real** `POST` from `src/app/api/webhooks/paystack/route.ts`, imported under `--conditions=react-server` so `server-only` resolves.
- Signed with a test-only HMAC secret and pointed at the in-memory replica set through `MONGODB_URI`/`MONGO_DB_NAME`.
- `globalThis.fetch` was replaced to block and record every outbound call. **0 outbound calls were attempted** (test `d`).

| Test | What happened | Observed |
|---|---|---|
| `2a` | `findOneAndUpdate` sets `status: "processing"` | Saved as `processing`. `validate()` on the document fails: ``status: `processing` is not a valid enum value`` |
| `control` | Real handler, happy path, 2 concurrent deliveries | Both 200, 1 Payment, intent `succeeded` (the harness can exercise the real flow) |
| `2b` | Real handler, `InvoiceEvent.create` made to throw once after the lock, then 2 redeliveries | First delivery **500**. Intent **`processing`**, 0 Payments, line item **paid 50,000**. Redeliveries **200, 200** ("already being processed"). Intent **still `processing`**, **0 Payments**, invoice header outstanding 50,000. `reconcile-pending` query matches **0**. `checkout-status` would retry: **false**. Parent sees **"pending"**. |
| `2c` | Real handler, invoice missing | 200, 200. Intent **`processing`** permanently |

Fault-injection point: the first `InvoiceEvent.create` stands in for any failure between the lock and `Payment.create`, such as a database error, a validation error, or a process kill. A process kill was not simulated, but its persisted state would be the same as the exception case.

### Result

Confirmed with the real handler:

- A fee `PaymentIntent` can enter `processing` and never leave it.
- Two paths lead there: any failure between the lock and `Payment.create`, and the invoice-not-found branch with no exception at all.
- Provider retries, both parent-driven fallbacks, every cron and reconciliation job, and admin tooling all leave it untouched.
- The failure path also leaves partial financial writes: line items marked paid with no Payment, while the invoice still shows the balance owed.
- The parent can pay again.

### Severity

**CRITICAL.**
- **Money is collected but not recorded.** Paystack has the money; EduSentrix doesn't.
- **Financial records become internally inconsistent.** Line items say paid while the header and the ledger say unpaid.
- **There is no automatic or manual recovery path in the product.**
- **Parents can be charged twice.**

The trigger needs a failure inside a narrow window (or a missing invoice), so frequency should be low, but each occurrence corrupts financial records and needs manual repair at the database level.

### Recommended Fix

Not implemented.

1. **Make posting atomic and idempotent.** Run the line-item updates, credit, `InvoiceEvent`s, `Payment`, allocations and intent transition in **one MongoDB transaction**, keyed on the unique `Payment.paystackReference`. A failure must then leave no partial writes, and a retry can simply run the whole thing again.
2. **Model the lock properly:**
   - Add `processing` to the enum.
   - Add `processingStartedAt`/`lockExpiresAt` and let the lock filter reclaim `processing` intents whose lease has expired.
   - On caught failures, release the intent back to `awaiting_webhook`, recording `failureReason`, so a Paystack retry can proceed.
3. **Handle the invoice-not-found branch explicitly:** mark the intent `failed` with a reason, or leave it for review, and alert finance. Do not return 200 and leave it locked.
4. **Replace the HTTP self-POST** in `checkout-status`/`reconcile-pending` with a direct call to a shared posting service.
5. **Block or warn on a new checkout** while a recent intent for the same invoice is `processing` or `awaiting_webhook`.
6. **Handle fee `charge.failed`**, and add a sweeper that verifies stale intents with Paystack (see the next section).
7. **One-time read-only audit:** look for existing fee intents with `status: "processing"` and `paymentId: null`, and for line items whose `amountPaidMinor` isn't covered by `PaymentAllocation`s. Then plan a manual repair.

### Inngest Relevance

**Inngest supports the fix but cannot replace it.** Moving the current handler into Inngest would carry the partial-write bug into the new engine. Fixes 1 to 3 must come first.

Once posting is atomic and idempotent, Inngest fits well for:
- **Acknowledge the webhook, then process it.** Verify the signature, save a receipt keyed on `event` + `data.id`, emit `paystack/charge.succeeded` with that id as the Inngest event id, and return 200. Posting then runs with retries and a concurrency key on `reference`.
- **A recovery sweeper.** An Inngest cron finds `awaiting_webhook`/`processing` intents older than N minutes, calls Paystack `verifyTransaction`, and runs the same idempotent posting function, or marks them `failed`/`expired`. This replaces the current dependence on the parent coming back.
- **Splitting off follow-ups.** Receipt PDF, email, notification and ledger become separate retryable steps, so they never block or corrupt posting.

VERDICT: CONFIRMED

---

## Final Conclusions

**Claim 1: invoice number collision.**
- Invoice numbers come from a per-school `countDocuments`, but uniqueness is global.
- The collision across schools happens with no concurrency at all.
- With the unique index present, later schools cannot create invoices (E11000), and deleting a cancelled invoice blocks creation within one school.
- Without the index, which is possible because production runs with `autoIndex:false`, duplicates are saved silently.
- Concurrent creation within one school only recovers in the single-create path.
- Severity: HIGH. Inngest is not relevant.

VERDICT: CONFIRMED

**Claim 2: payment intent stuck in processing.**
- `processing` is an out-of-enum state that only two success branches ever leave.
- Proved with the real webhook handler: a failure after the lock, or a missing invoice, leaves the intent in `processing` permanently.
- Line items stay marked paid while no Payment exists.
- Every retry and fallback path skips the intent, and the parent can pay again.
- Severity: CRITICAL. The primary fix is atomic, idempotent posting with a lease-based lock; Inngest is appropriate for acknowledge-then-process ingestion and stale-intent recovery once that is in place.

VERDICT: CONFIRMED

### Assumptions not verified

- **Production index state:** whether `invoiceNumber_1` exists in the production database. This is the difference between invoice creation failing and duplicates being saved silently.
- **Existing stuck intents:** whether any fee `PaymentIntent` documents are already stuck in `processing`, or line items are already marked paid without a Payment.
- **Process kill:** a process kill was not simulated; it was inferred to persist the same state as the injected exception.
- **Route handlers for invoice creation were not called directly** because they require Clerk authentication. The tests replay the routes' exact statement order using the real model and number generator.
