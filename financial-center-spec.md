# EduSentrix - Financial Center Spec (Ledger + Transaction Intelligence)

This spec defines a centralized Financial Center: a single source of truth for all money movement across the school (fees, store, fundraising, expenses, refunds, adjustments). It includes a premium finance dashboard, a unified transactions ledger, statuses, exports, and reconciliation hooks.

Scope: Admin/Staff portal (Admin + Bursar + Accountant + Cashier).
Out of scope (v1): full accounting chart of accounts, tax/VAT filings, payroll, multi-currency.

---

## 1. Sidebar Name and Placement

Sidebar label: **Financial Center**
(Alt: Finance Hub)

Place near the top of the Admin sidebar, after Dashboard.

Icon suggestion: Landmark (bank icon) or Wallet

---

## 2. Product Goals

### Core Outcomes (v1):
- One ledger for all transactions (inflow/outflow).
- Instant visibility: earnings and spend by day/week/month/term/custom range.
- Track lifecycle: pending → processing → success → failed → refunded/reversed.
- Category breakdown: fees, store/books, fundraising, other income, expenses.
- Detect issues fast: failed payments, pending transactions, unmatched settlements.

### World-Class Outcomes (v1.5+):
- Audit-safe ledger (no silent edits; use adjustments/reversals/voids).
- Reconciliation-ready (gateway + bank settlement matching).
- Cashbook mode (cash collections, shift handover, variance).
- Evidence vault (receipts and proofs attached).
- Approval workflows for manual entries and adjustments.
- Financial alerts and anomaly detection.
- Role-based access with audit logging.

---

## 3. Canonical Model: FinancialTransaction (LedgerEntry)

File: `src/models/FinancialTransaction.ts`

### 3.1 Enumerations

**direction:**
- `inflow` | `outflow`

**status:**
- `pending` - Initiated, awaiting confirmation
- `processing` - In progress (async webhook pending)
- `success` - Completed successfully
- `failed` - Payment failed
- `refunded` - Money returned to payer
- `reversed` - Entry reversed/corrected
- `voided` - Cancelled before money moved
- `disputed` - Chargeback initiated, pending resolution
- `held` - Frozen pending investigation

**category:**
- `fees` - Tuition and school fees
- `store` - Bookshop/uniform sales
- `fundraising` - Campaign donations
- `expenses` - School expenditures
- `other_income` - Miscellaneous income
- `refund` - Money returned
- `adjustment` - Ledger corrections
- `gateway_fee` - Payment processor fees (if tracked separately)
- `bank_charge` - Bank fees
- `penalty` - Late fee income
- `discount` - Fee waivers (tracked as outflow or negative adjustment)

**sourceModule:**
- `fees` | `store` | `community` | `fundraising` | `expenses` | `manual`

**method:**
- `cash` | `mobile_money` | `bank_transfer` | `card` | `cheque` | `other`

**channel (optional):**
- `in_app` | `web` | `mobile` | `pos` | `offline`

### 3.2 Fields

**Required:**
- `schoolId` - ObjectId
- `direction` - inflow | outflow
- `status` - (see enum above)
- `grossAmountMinor` - Integer (total amount before fees)
- `feeAmountMinor` - Integer (gateway/processing fees, default 0)
- `netAmountMinor` - Integer (grossAmountMinor - feeAmountMinor for inflows)
- `currency` - String (default "GHS")
- `occurredAt` - Date (when transaction happened)
- `category` - (see enum above)
- `sourceModule` - (see enum above)
- `sourceId` - ObjectId/String (reference to originating record)
- `method` - (see enum above)

**Optional:**
- `channel` - (see enum above)
- `description` - String
- `tags[]` - String array for custom categorization
- `reference` - String (invoice/receipt/order number for display)
- `meta` - Object: gateway refs, invoice number, order number, etc.
- `attachments[]` - Array of { url, type: "image"|"pdf", name?, uploadedAt, uploadedBy }
- `notes` - String (internal notes)
- `batchId` - ObjectId (for bulk imports/operations)

**Party Fields:**
```
party: {
  type: "student" | "guardian" | "vendor" | "staff" | "donor" | "other",
  id?: ObjectId,          // Links to User/Student/Vendor if applicable
  name: String,           // Denormalized for display
  contact?: {
    phone?: String,
    email?: String
  }
}
```

**Academic Linkage:**
- `academicPeriodId` - ObjectId (optional, required for fees)
- `dayKey` - String (derived: "YYYY-MM-DD")
- `monthKey` - String (derived: "YYYY-MM")

**Balance Tracking:**
- `balanceAfterMinor` - Integer (running balance after this entry, optional v1.5)

**Correction Links:**
- `originalTransactionId` - ObjectId (for refunds/reversals: which transaction is this correcting?)
- `correctedById` - ObjectId (if this transaction was later refunded/reversed, link to correction)

**Reconciliation:**
```
reconciliation: {
  status: "unmatched" | "matched" | "disputed" | "ignored",
  provider: "paystack" | "hubtel" | "mtn_momo" | "bank" | "manual",
  providerReference?: String,
  settlementBatchId?: String,
  matchedAt?: Date,
  matchedBy?: ObjectId
}
```

**Approval (for manual entries):**
```
approval: {
  required: Boolean,
  status: "pending" | "approved" | "rejected",
  requestedBy?: ObjectId,
  requestedAt?: Date,
  decidedBy?: ObjectId,
  decidedAt?: Date,
  reason?: String
}
```

**Void Info:**
- `voidedAt` - Date
- `voidedBy` - ObjectId
- `voidReason` - String

**Audit Integrity:**
- `createdBy` - ObjectId
- `createdAt` - Date (auto)
- `updatedAt` - Date (auto)
- `finalizedAt` - Date (set after success/refund/reversal - immutable after this)
- `finalizedReason` - String

### 3.3 Indexes

```
- (schoolId, occurredAt: -1)
- (schoolId, status, occurredAt: -1)
- (schoolId, category, occurredAt: -1)
- (schoolId, sourceModule, sourceId) unique sparse
- (schoolId, reconciliation.status, occurredAt: -1)
- (schoolId, dayKey)
- (schoolId, monthKey)
- (schoolId, party.id) sparse
- (schoolId, batchId) sparse
- (schoolId, approval.status) sparse
```

### 3.4 Immutability Rules

**CRITICAL: Do not edit money history.**

For corrections, create new entries:
1. **Refund** - Money returned to payer (inflow was received, now returning it)
2. **Reversal** - Undo an incorrect entry (e.g., duplicate posting)
3. **Void** - Cancel a pending transaction before money moves
4. **Adjustment** - Correct ledger discrepancies (requires approval)

All correction entries must:
- Reference `originalTransactionId`
- Update original's `correctedById`
- Require approval for manual adjustments
- Include `notes` explaining the correction

---

## 4. Write Paths (How Modules Feed the Ledger)

### 4.1 Fees Module
- Payment success → create inflow, category: `fees`, sourceModule: `fees`, sourceId: FeePayment._id
- Payment failure → status: `failed`
- Refund/chargeback → new entry with category: `refund`, originalTransactionId set

### 4.2 Store Module
- Order paid → inflow, category: `store`, sourceId: StoreOrder._id

### 4.3 Fundraising Module
- Donation success → inflow, category: `fundraising`, sourceId: FundraisingDonation._id

### 4.4 Expenses Module
- Expense marked paid → outflow, category: `expenses`, sourceId: Expense._id

### 4.5 Manual Entries
Allow admin/bursar to create:
- `other_income` (inflow) - with evidence attachment required
- `adjustment` (inflow or outflow) - requires approval workflow
- `bank_charge` (outflow) - for bank fees not captured elsewhere

Manual entry requirements:
- Strict permission check (bursar/admin only)
- Evidence/attachment recommended
- Notes/description required
- Approval workflow for adjustments

---

## 5. Financial Center UI

### Pages:
- `/admin/finance` - Overview dashboard
- `/admin/finance/transactions` - Ledger table
- `/admin/finance/transactions/[id]` - Transaction detail (or drawer)
- `/admin/finance/reconciliation` - Reconciliation center (phase 2)
- `/admin/finance/cashbook` - Cash management (phase 3)
- `/admin/finance/reports` - Report generation
- `/admin/finance/settings` - Configuration (approval rules, thresholds)

### 5.1 Overview Dashboard (v1)

**Range Selector:**
- Today, This Week, This Month, This Term, Custom Range
- Compare with previous period toggle

**KPI Cards:**
| Card | Value | Subtext |
|------|-------|---------|
| Total Inflow | Sum of successful inflows | +X% vs previous |
| Total Outflow | Sum of successful outflows | +X% vs previous |
| Net Position | Inflow - Outflow | Color: green if positive |
| Pending | Count + Amount | Requires attention |
| Failed | Count + Amount | Requires action |

**Breakdowns:**
- Inflow by category (fees/store/fundraising/other_income) - Donut chart
- Outflow by category (expenses by type) - Bar chart
- Daily trend (line chart for selected range)

**Widgets:**
- Recent transactions (last 10)
- Pending approvals (if any manual adjustments awaiting)
- Alerts panel:
  - Failed payments requiring action
  - Unreconciled transactions > 7 days
  - Large transactions (> threshold)
  - Pending transactions > 24 hours

### 5.2 Transactions Table (v1)

**Columns:**
| Column | Description |
|--------|-------------|
| Date/Time | occurredAt formatted |
| Direction | Inflow ↑ / Outflow ↓ with color |
| Gross Amount | grossAmountMinor formatted |
| Net Amount | netAmountMinor (if different from gross) |
| Category | Badge with category label |
| Source | sourceModule with link to source record |
| Status | Color-coded chip |
| Method | Payment method icon + label |
| Party | Name (linked if party.id exists) |
| Reference | Invoice/order/receipt number |
| Actions | View, Download receipt, More... |

**Filters:**
- Status (multi-select)
- Category (multi-select)
- Source Module (multi-select)
- Method (multi-select)
- Date range (from/to)
- Amount range (min/max)
- Search (reference, party name, description)
- Academic Period
- Reconciliation status (unmatched, matched, etc.)
- Has attachments (yes/no)

**Saved Views (Premium):**
- All Transactions
- Pending Today
- Failed This Week
- Unreconciled
- Cash Collections Today
- Large Transactions (> threshold)
- Missing Evidence

**Bulk Actions:**
- Export selected
- Export all (current filter)

### 5.3 Transaction Detail (Drawer or Page)

**Header:**
- Direction + Amount (large)
- Status badge
- Reference number
- Date/time

**Sections:**

1. **Basic Info**
   - Category, Source Module, Method, Channel
   - Link to source record (e.g., "View Fee Payment")

2. **Party Info**
   - Type, Name, Contact
   - Link to profile if applicable

3. **Amount Breakdown**
   - Gross amount
   - Gateway/processing fee
   - Net amount

4. **Reconciliation** (if applicable)
   - Status
   - Provider reference
   - Settlement batch
   - Match details

5. **Attachments**
   - Gallery view
   - Upload new attachment button

6. **Notes/Comments**
   - Internal notes
   - Add note button

7. **Timeline**
   - Created at + by
   - Status changes
   - Finalized at
   - Corrections (if any)

8. **Related Transactions**
   - Original (if this is a refund/reversal)
   - Corrections (if this was refunded/reversed)

**Actions (role-guarded):**
- Add attachment
- Add note
- Create refund (if eligible)
- Create reversal (admin only)
- Void (if pending)
- Mark reconciliation ignored (later)

---

## 6. API Routes (Admin)

### Overview:
```
GET /api/admin/finance/overview
  Query: range, dateFrom, dateTo, academicPeriodId, compareWithPrevious
  Returns: KPIs, breakdowns, alerts summary
```

### Transactions:
```
GET /api/admin/finance/transactions
  Query: status[], category[], module[], method[], dateFrom, dateTo, 
         academicPeriodId, amountMin, amountMax, q, reconciliationStatus,
         hasAttachments, page, limit, sort
  Returns: paginated transactions list

GET /api/admin/finance/transactions/:id
  Returns: full transaction detail with related records

POST /api/admin/finance/transactions/manual
  Body: { direction, grossAmountMinor, category, method, party, 
          description, notes, attachments[], academicPeriodId }
  Permissions: bursar, admin
  Note: Creates with approval.required=true for adjustments

PATCH /api/admin/finance/transactions/:id/attach
  Body: { attachments[] }
  Note: Add attachments to existing transaction

PATCH /api/admin/finance/transactions/:id/note
  Body: { note }
  Note: Add internal note

POST /api/admin/finance/transactions/:id/void
  Body: { reason }
  Permissions: admin
  Note: Only for pending transactions

POST /api/admin/finance/transactions/:id/refund
  Body: { amountMinor, reason, attachments[] }
  Permissions: bursar, admin
  Note: Creates new refund transaction linked to original
```

### Approvals:
```
GET /api/admin/finance/approvals/pending
  Returns: list of transactions awaiting approval

POST /api/admin/finance/transactions/:id/approve
  Body: { notes? }
  Permissions: admin

POST /api/admin/finance/transactions/:id/reject
  Body: { reason }
  Permissions: admin
```

### Summaries:
```
GET /api/admin/finance/summary/daily
  Query: date
  Returns: totals by category for a single day

GET /api/admin/finance/summary/monthly
  Query: month (YYYY-MM)
  Returns: daily breakdown for month

GET /api/admin/finance/summary/by-category
  Query: range, dateFrom, dateTo
  Returns: totals grouped by category
```

### Export:
```
POST /api/admin/finance/transactions/export
  Body: { filters, format: "csv" | "excel" | "pdf" }
  Returns: ReportExport job reference
```

### Reconciliation (Phase 2):
```
GET /api/admin/finance/reconciliation/unmatched
  Query: provider, dateFrom, dateTo

POST /api/admin/finance/reconciliation/match
  Body: { transactionId, providerReference, settlementBatchId }

POST /api/admin/finance/reconciliation/import-bank-csv
  Body: FormData with CSV file

POST /api/admin/finance/reconciliation/ignore
  Body: { transactionId, reason }
```

### Audit Log:
```
GET /api/admin/finance/audit-log
  Query: transactionId?, userId?, action?, dateFrom, dateTo
  Returns: paginated audit entries
```

---

## 7. Role-Based Access Control

### Roles & Permissions:

| Role | View | Create Manual | Approve | Refund/Void | Export | Settings |
|------|------|---------------|---------|-------------|--------|----------|
| school_admin | ✅ All | ✅ | ✅ | ✅ | ✅ | ✅ |
| bursar | ✅ All | ✅ | ❌ (requests) | ✅ Refund | ✅ | ❌ |
| accountant | ✅ All | ❌ | ❌ | ❌ | ✅ | ❌ |
| cashier | ✅ Own shift | ✅ Cash only | ❌ | ❌ | ❌ | ❌ |
| auditor | ✅ All + locked | ❌ | ❌ | ❌ | ✅ | ❌ |

### Approval Requirements:
- Manual `adjustment` entries → requires admin approval
- Manual entries > threshold amount → requires approval
- Voiding transactions → requires reason + admin approval
- Bulk imports → requires review before commit

### Audit Logging:
Every financial action logged with:
- userId
- action type
- timestamp
- IP address
- before/after values (for status changes)
- reason (for voids, rejections)

Audit logs are immutable and exportable.

---

## 8. Financial Alerts System (v1.5)

### Real-Time Alerts:
- Large payment received (> configurable threshold)
- Payment failed after 3+ retries
- Multiple refunds in short period (potential abuse)
- Unusual transaction pattern

### Dashboard Alerts:
- Pending transactions > 24 hours old
- Failed payments requiring action
- Unreconciled transactions > 7 days old
- Pending approvals count
- Cash not closed for today (if cashbook enabled)

### Notification Delivery:
- In-app notification bell
- Email to bursar for critical alerts
- Optional SMS for large transactions

---

## 9. Financial Reports (v1.5)

### Standard Reports:
| Report | Description | Frequency |
|--------|-------------|-----------|
| Daily Cash Report | Cash collections by method, totals | Daily |
| Collections Summary | Inflows by category and source | Weekly/Monthly |
| Outstanding Receivables | Overdue invoices 30/60/90 days | On demand |
| Income vs Expense | Simple P&L by period | Monthly/Termly |
| Category Breakdown | Detailed by category | On demand |
| Reconciliation Status | Matched vs unmatched | Weekly |
| Gateway Fee Summary | Fees paid to payment providers | Monthly |

### Export Formats:
- CSV (raw data)
- Excel (formatted with headers and totals)
- PDF (branded, printable)

### Scheduled Reports:
- Daily summary email to bursar (configurable)
- Weekly reconciliation status email
- Term-end financial summary (auto-generated)

---

## 10. Day Close / Cashbook Mode (v1.5 Premium)

### Features:
- Record cash collected by cashier/bursar per shift
- Shift handover log with signature
- Expected vs actual variance tracking
- Denomination breakdown (optional)

### Close Day Workflow:
1. Cashier/bursar initiates day close
2. System calculates expected totals (from transactions)
3. User enters actual counts (cash, MoMo, bank)
4. System flags variances
5. User provides explanation for variances
6. Supervisor approves day close
7. Day is locked for edits

### Close Day Report:
- Cash total (expected vs actual)
- Mobile money total
- Bank deposits expected
- Variances with explanations
- Who closed and when
- Printable PDF summary

---

## 11. Reconciliation Center (Phase 2)

### 3-Way Match:
1. **Invoice/Fee** - What was billed
2. **Payment Transaction** - What was recorded
3. **Gateway Settlement** - What was received from provider

### Features:
- Webhook ingestion from Paystack, Hubtel, MTN MoMo
- Bank settlement CSV import
- Auto-match by reference number
- Manual match for edge cases
- Dispute flagging and resolution
- Unmatched item task list

### Settlement Tracking:
- Expected settlement date/amount
- Actual settlement received
- Variance flagging
- Settlement batch management

---

## 12. Multi-Currency Support (Phase 4 / v2)

### Additional Fields:
- `originalCurrency` - Currency of original transaction
- `originalAmountMinor` - Amount in original currency
- `exchangeRate` - Rate used for conversion
- `baseCurrency` - School's primary currency (e.g., "GHS")
- `baseAmountMinor` - Converted amount

### Use Cases:
- International schools with USD/GBP fees
- Donations from abroad
- Foreign vendor payments

---

## 13. Build Plan

### Phase 1 (v1) - Foundation:
- [ ] Implement FinancialTransaction model with all v1 fields
- [ ] Implement overview API (KPIs + breakdowns + recent)
- [ ] Implement transactions API (list + detail + filters + pagination)
- [ ] Add ledger write hooks from:
  - [ ] Fees module (success/failure/refund)
  - [ ] Expenses module (paid)
  - [ ] Fundraising module (donation success)
  - [ ] Store module (order paid) - if available
- [ ] Build UI:
  - [ ] /admin/finance overview dashboard
  - [ ] /admin/finance/transactions table
  - [ ] Transaction detail drawer
- [ ] Add manual entry creation (other_income)
- [ ] Add exports via ReportExport
- [ ] Basic audit logging

### Phase 2 (v1.5) - Enterprise Features:
- [ ] Approval workflows for manual adjustments
- [ ] Void functionality for pending transactions
- [ ] Refund creation from UI
- [ ] Financial alerts system
- [ ] Reconciliation basics (unmatched view + manual match)
- [ ] Bank CSV import
- [ ] Standard reports
- [ ] Scheduled email reports

### Phase 3 - Cashbook:
- [ ] Cashbook / day close feature
- [ ] Shift management
- [ ] Variance tracking
- [ ] Day close approval workflow

### Phase 4 - Advanced:
- [ ] Period locking (prevent edits to past terms)
- [ ] Full reversal workflows
- [ ] Auditor role with restricted access
- [ ] Running balance calculation
- [ ] Multi-currency support
- [ ] AI-powered insights and forecasting (premium)

---

## 14. Acceptance Criteria (v1)

### Must Have:
- [ ] Ledger displays transactions from fees + expenses (and store/fundraising if integrated)
- [ ] Overview computes totals accurately for each range
- [ ] Transactions table filters correctly by all criteria
- [ ] Transaction detail shows attachments and links to source records
- [ ] Export works via ReportExport pattern
- [ ] No silent edits: corrections are new entries (refund/reversal/adjustment)
- [ ] Manual entry creation for other_income with proper permissions
- [ ] Basic audit trail for all actions

### Should Have:
- [ ] Pending/failed alerts on dashboard
- [ ] Running totals update in near-real-time
- [ ] Gateway fee tracking (netAmountMinor accurate)
- [ ] Academic period filtering

### Nice to Have (v1):
- [ ] Saved filter views
- [ ] Comparison with previous period
- [ ] Pending approval indicator

---

## 15. Technical Notes

### Idempotency:
- Use (schoolId, sourceModule, sourceId) as unique key
- Prevent duplicate ledger entries from webhook retries

### Performance:
- Use aggregation pipelines for overview calculations
- Consider materialized views for daily/monthly summaries
- Index strategy optimized for common queries

### Data Integrity:
- Validate all writes through service layer
- Never update finalized transactions
- All corrections create new entries

### Webhook Safety:
- Idempotency key on all incoming webhooks
- Status progression validation (can't go from success back to pending)
- Reconciliation status separate from transaction status

---

## Appendix A: Status Transition Diagram

```
                    ┌─────────┐
                    │ pending │
                    └────┬────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         ┌────────┐ ┌─────────┐ ┌────────┐
         │ voided │ │processing│ │ failed │
         └────────┘ └────┬────┘ └────────┘
                         │
                         ▼
                    ┌─────────┐
                    │ success │
                    └────┬────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         ┌──────────┐ ┌────────┐ ┌────────┐
         │ refunded │ │reversed│ │disputed│
         └──────────┘ └────────┘ └───┬────┘
                                     │
                              ┌──────┴──────┐
                              ▼             ▼
                         ┌────────┐   ┌──────────┐
                         │ held   │   │ resolved │
                         └────────┘   └──────────┘
```

---

## Appendix B: Sample Transaction Objects

### Fee Payment (Inflow):
```json
{
  "schoolId": "...",
  "direction": "inflow",
  "status": "success",
  "grossAmountMinor": 100000,
  "feeAmountMinor": 1950,
  "netAmountMinor": 98050,
  "currency": "GHS",
  "occurredAt": "2026-01-27T10:30:00Z",
  "category": "fees",
  "sourceModule": "fees",
  "sourceId": "feePayment123",
  "method": "mobile_money",
  "channel": "in_app",
  "reference": "INV-2026-0042",
  "party": {
    "type": "guardian",
    "id": "guardian456",
    "name": "Kwame Mensah",
    "contact": { "phone": "+233244123456" }
  },
  "academicPeriodId": "term2-2026",
  "reconciliation": {
    "status": "matched",
    "provider": "paystack",
    "providerReference": "PSK_abc123"
  },
  "finalizedAt": "2026-01-27T10:30:05Z"
}
```

### Expense (Outflow):
```json
{
  "schoolId": "...",
  "direction": "outflow",
  "status": "success",
  "grossAmountMinor": 50000,
  "feeAmountMinor": 0,
  "netAmountMinor": 50000,
  "currency": "GHS",
  "occurredAt": "2026-01-25T14:00:00Z",
  "category": "expenses",
  "sourceModule": "expenses",
  "sourceId": "expense789",
  "method": "bank_transfer",
  "reference": "EXP-2026-0015",
  "description": "Electricity bill - January",
  "party": {
    "type": "vendor",
    "name": "ECG Ghana",
    "contact": { "phone": "+233302123456" }
  },
  "attachments": [
    { "url": "...", "type": "pdf", "name": "ecg-invoice.pdf" }
  ],
  "finalizedAt": "2026-01-25T14:00:00Z"
}
```

### Manual Adjustment (Requires Approval):
```json
{
  "schoolId": "...",
  "direction": "inflow",
  "status": "pending",
  "grossAmountMinor": 5000,
  "feeAmountMinor": 0,
  "netAmountMinor": 5000,
  "currency": "GHS",
  "occurredAt": "2026-01-27T09:00:00Z",
  "category": "adjustment",
  "sourceModule": "manual",
  "method": "cash",
  "description": "Cash found in drawer - reconciliation",
  "notes": "Discovered during day close on 2026-01-26",
  "approval": {
    "required": true,
    "status": "pending",
    "requestedBy": "bursar123",
    "requestedAt": "2026-01-27T09:00:00Z"
  },
  "createdBy": "bursar123"
}
```
