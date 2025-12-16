# Fees & Payments System Strategy

## Overview

A comprehensive, world-class fee management system where fees are assigned to students as invoices, with individual fees as line items. Parents can choose which line items to pay first, and each item can have installments if allowed. All transactions are tracked clearly with full reconciliation capabilities, audit trails, and financial-grade accuracy.

## Core Principles

### 1. Money as Integers (Minor Units)
- All amounts stored as **integers in minor units** (pesewas for GHS)
- Display formatting happens only in UI layer
- Eliminates rounding errors, especially critical for installments (e.g., 33.33% splits)
- TypeScript types remain `number`, but DB enforces integer storage

### 2. Reconciliation-First Architecture
- Three sources of truth: Internal Ledger, Gateway Events, Bank Statements
- Designed for 1-to-1 and 1-to-many matching
- Idempotent operations throughout
- Full audit trail for financial compliance

### 3. Append-Only Invoice Model
- Once issued, invoices become immutable
- Changes via adjustments (not mutations)
- Perfect auditability and prevents disputes

### 4. Transaction Safety
- All payment operations use MongoDB transactions
- Optimistic concurrency control
- Prevents race conditions and double-crediting

## Core Concepts

### 1. Invoice-Based System
- **One invoice per student per academic period** (unique constraint)
- Invoices contain multiple line items (individual fees)
- Line items are ordered by importance/priority
- Invoice represents the total amount due for a term

### 2. Flexible Payment Allocation
- Parents can pay any amount toward any line item
- Payments can be split across multiple line items
- System tracks which line items are paid/partially paid/outstanding
- Clear audit trail of payment allocations

### 3. Installment Support
- Each line item can optionally allow installments
- Installments are scheduled payments (e.g., 3 installments of 33.33% each)
- Parents can pay installments in any order
- System tracks installment status per line item

## Data Models

### 1. FeeStructure
**Purpose**: Template for fee types (e.g., Tuition, Library, Sports, etc.)

```typescript
{
  _id: ObjectId
  schoolId: ObjectId
  name: string // "Tuition Fee", "Library Fee", etc.
  code: string // "TUITION", "LIBRARY", etc.
  description?: string
  category: "tuition" | "library" | "sports" | "uniform" | "other"
  isActive: boolean
  defaultAmountMinor?: number // Optional default amount in minor units (pesewas)
  allowsInstallments: boolean // Whether this fee type allows installments
  maxInstallments?: number // Max number of installments allowed
  createdAt: Date
  updatedAt: Date
}
```

### 2. Invoice
**Purpose**: Represents fees assigned to a student for an academic period (append-only after issue)

```typescript
{
  _id: ObjectId
  schoolId: ObjectId
  studentId: ObjectId
  academicPeriodId: ObjectId // Links to AcademicPeriod
  invoiceNumber: string // Unique: "INV-2024-001" or "INV-{year}-{studentId}-{term}"
  status: "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled"

  // Totals (calculated, stored in minor units)
  totalAmountMinor: number // Sum of all line items (pesewas)
  totalPaidMinor: number // Sum of all payments allocated (pesewas)
  totalOutstandingMinor: number // totalAmountMinor - totalPaidMinor
  totalCreditAppliedMinor: number // Credit applied from overpayments (pesewas)

  // Versioning (for adjustments)
  version: number // Starts at 1, increments on adjustments
  previousVersionId?: ObjectId // Reference to previous version (if applicable)

  // Dates
  issueDate?: Date // When invoice was issued (null if draft)
  dueDate: Date // Payment due date
  paidDate?: Date // When fully paid

  // Metadata
  notes?: string // Internal notes
  terms?: string // Payment terms

  // Concurrency control
  __v: number // Mongoose version key for optimistic locking

  createdAt: Date
  updatedAt: Date

  // Indexes
  // - schoolId + studentId + academicPeriodId (unique)
  // - schoolId + status
  // - schoolId + dueDate
  // - invoiceNumber (unique)
}
```

### 3. InvoiceLineItem
**Purpose**: Individual fee within an invoice, ordered by importance

```typescript
{
  _id: ObjectId
  invoiceId: ObjectId // Parent invoice
  feeStructureId: ObjectId // Reference to FeeStructure

  // Fee details
  name: string // "Tuition Fee - Term 1"
  description?: string
  amountMinor: number // Fee amount in minor units (pesewas)

  // Ordering
  displayOrder: number // Order of importance (1 = most important)

  // Installment configuration
  allowsInstallments: boolean
  numberOfInstallments?: number // If installments allowed

  // Payment tracking (calculated, in minor units)
  amountPaidMinor: number // Total paid toward this line item (pesewas)
  amountOutstandingMinor: number // amountMinor - amountPaidMinor
  isFullyPaid: boolean // Computed field

  // Status
  status: "pending" | "partially_paid" | "paid" | "overdue"

  // Adjustment tracking
  isAdjustment: boolean // True if this is an adjustment line item
  adjustmentType?: "waiver" | "scholarship" | "correction" | "penalty" | "other"
  adjustmentReason?: string // Why this adjustment was made
  adjustedBy?: ObjectId // User who made the adjustment

  createdAt: Date
  updatedAt: Date

  // Indexes
  // - invoiceId + displayOrder
  // - invoiceId + status
  // - invoiceId + isAdjustment
}
```

### 4. PaymentIntent
**Purpose**: Represents a payment attempt/initiation (gateway-safe architecture)

```typescript
{
  _id: ObjectId
  schoolId: ObjectId
  studentId: ObjectId
  invoiceId: ObjectId // Which invoice this payment is for

  // Intent details
  amountMinor: number // Intended payment amount (pesewas)
  proposedAllocations?: Array<{
    invoiceLineItemId: ObjectId
    amountMinor: number
  }> // Proposed allocation (can be adjusted on completion)

  // Status tracking
  status: "initiated" | "awaiting_webhook" | "succeeded" | "failed" | "cancelled" | "expired"

  // Gateway integration
  paymentMethod: "cash" | "bank_transfer" | "mobile_money" | "paystack" | "cheque" | "other"
  paystackReference?: string // Paystack reference for this intent
  idempotencyKey: string // Unique key to prevent duplicate processing

  // Metadata
  initiatedBy?: ObjectId // User who initiated (parent/admin)
  initiatedAt: Date
  expiresAt?: Date // For gateway payments

  // Result
  paymentId?: ObjectId // Links to Payment when succeeded
  failureReason?: string

  createdAt: Date
  updatedAt: Date

  // Indexes
  // - schoolId + invoiceId
  // - idempotencyKey (unique)
  // - paystackReference (if exists)
  // - status + expiresAt (for cleanup)
}
```

### 5. Payment
**Purpose**: Records a completed payment transaction

```typescript
{
  _id: ObjectId
  schoolId: ObjectId
  studentId: ObjectId
  invoiceId: ObjectId // Which invoice this payment is for
  paymentIntentId?: ObjectId // Link to PaymentIntent if applicable

  // Payment details (minor units)
  amountMinor: number // Total payment amount (pesewas)
  paymentDate: Date
  paymentMethod: "cash" | "bank_transfer" | "mobile_money" | "paystack" | "cheque" | "other"

  // Payment gateway (if applicable)
  paystackReference?: string
  paystackTransactionId?: string
  gatewaySettlementId?: ObjectId // Link to GatewaySettlement
  gatewayResponse?: object // Full gateway response for audit

  // Payment allocation
  allocations: PaymentAllocation[] // How this payment is split across line items

  // Reconciliation status
  reconciliationStatus: "unmatched" | "gateway_verified" | "bank_matched" | "fully_reconciled" | "needs_review"
  gatewayVerifiedAt?: Date
  bankMatchedAt?: Date

  // Metadata
  receivedBy?: ObjectId // User who recorded the payment
  receiptNumber?: string // "RCP-2024-001"
  notes?: string
  attachments?: string[] // Receipt images/document URLs

  // Status
  status: "pending" | "completed" | "failed" | "refunded" | "reversed"

  // Concurrency control
  __v: number // Mongoose version key for optimistic locking

  createdAt: Date
  updatedAt: Date

  // Indexes
  // - schoolId + studentId
  // - schoolId + invoiceId
  // - schoolId + paymentDate
  // - paystackReference (unique if exists)
  // - reconciliationStatus
  // - gatewaySettlementId
}
```

### 6. PaymentAllocation
**Purpose**: Tracks how a payment is allocated across invoice line items

```typescript
{
  _id: ObjectId
  paymentId: ObjectId // Parent payment
  invoiceLineItemId: ObjectId // Which line item this allocation is for

  amountMinor: number // Amount allocated to this line item (pesewas)

  // Installment tracking (if applicable)
  installmentScheduleId?: ObjectId // Link to InstallmentSchedule
  installmentNumber?: number // Which installment this payment covers (1, 2, 3, etc.)

  // Metadata
  notes?: string

  createdAt: Date

  // Indexes
  // - paymentId
  // - invoiceLineItemId
  // - installmentScheduleId
}
```

### 7. InstallmentSchedule
**Purpose**: Explicit installment schedule for a line item (enables reminders & analytics)

```typescript
{
  _id: ObjectId
  invoiceLineItemId: ObjectId

  installmentNumber: number // 1, 2, 3, etc.
  dueDate: Date
  amountMinor: number // Amount for this installment (pesewas)
  amountPaidMinor: number // How much has been paid toward this installment (pesewas)
  amountOutstandingMinor: number // amountMinor - amountPaidMinor

  status: "pending" | "partially_paid" | "paid" | "overdue"

  // Reminder tracking
  reminderSentAt?: Date
  overdueNotifiedAt?: Date

  createdAt: Date
  updatedAt: Date

  // Indexes
  // - invoiceLineItemId + installmentNumber (unique)
  // - dueDate (for "due this week" queries)
  // - status + dueDate (for overdue queries)
}
```

### 8. StudentCreditBalance
**Purpose**: Tracks overpayments as student credit/wallet

```typescript
{
  _id: ObjectId
  schoolId: ObjectId
  studentId: ObjectId

  // Credit balance (minor units)
  balanceMinor: number // Current credit balance (pesewas)

  // Credit entries (ledger-style)
  entries: Array<{
    type: "credit" | "debit" | "application"
    amountMinor: number
    sourcePaymentId?: ObjectId // Payment that created credit
    appliedToInvoiceId?: ObjectId // Invoice where credit was applied
    appliedToLineItemId?: ObjectId // Line item where credit was applied
    reason: string
    createdAt: Date
  }>

  createdAt: Date
  updatedAt: Date

  // Indexes
  // - schoolId + studentId (unique)
}
```

### 9. InvoiceEvent
**Purpose**: Timeline/audit trail of all invoice events

```typescript
{
  _id: ObjectId
  invoiceId: ObjectId
  schoolId: ObjectId
  studentId: ObjectId

  eventType:
    | "created"
    | "issued"
    | "line_item_added"
    | "line_item_adjusted"
    | "payment_recorded"
    | "allocation_updated"
    | "overdue_marked"
    | "cancelled"
    | "refunded"
    | "credit_applied"
    | "adjustment_added"

  // Event details
  description: string // Human-readable description
  metadata?: object // Additional event-specific data

  // Actor
  performedBy?: ObjectId // User who performed the action

  // Related entities
  relatedPaymentId?: ObjectId
  relatedLineItemId?: ObjectId
  relatedAdjustmentId?: ObjectId

  createdAt: Date

  // Indexes
  // - invoiceId + createdAt
  // - schoolId + eventType
  // - studentId + createdAt
}
```

### 10. GatewayEvent
**Purpose**: Append-only log of all gateway webhooks/events (dedupe-safe)

```typescript
{
  _id: ObjectId
  schoolId: ObjectId

  // Gateway identification
  gateway: "paystack" | "other"
  eventId: string // Gateway's event ID (for deduplication)
  eventType: string // Gateway's event type

  // Transaction references
  paystackReference?: string
  paystackTransactionId?: string

  // Event data
  payload: object // Full webhook payload (never edited)

  // Processing status
  status: "received" | "processed" | "ignored_duplicate" | "failed_processing"
  processedAt?: Date
  errorMessage?: string

  // Related entities
  paymentIntentId?: ObjectId
  paymentId?: ObjectId

  createdAt: Date

  // Indexes
  // - gateway + eventId (unique for deduplication)
  // - paystackReference
  // - status + createdAt
}
```

### 11. GatewaySettlement
**Purpose**: Represents Paystack settlement/payout to bank account

```typescript
{
  _id: ObjectId
  schoolId: ObjectId

  // Settlement identification
  settlementId: string // Paystack settlement ID
  payoutDate: Date
  amountMinor: number // Settlement amount (pesewas)
  feesMinor: number // Paystack fees deducted (pesewas)

  // Bank details
  destinationBank?: string
  destinationAccount?: string

  // Related transactions
  transactionIds: string[] // Paystack transaction IDs included in this settlement
  paymentIds: ObjectId[] // Internal Payment IDs matched to this settlement

  // Reconciliation
  reconciliationStatus: "unmatched" | "matched" | "partial"
  bankStatementLineId?: ObjectId // Matched bank statement line

  createdAt: Date
  updatedAt: Date

  // Indexes
  // - schoolId + settlementId (unique)
  // - payoutDate
  // - reconciliationStatus
}
```

### 12. BankStatementImport
**Purpose**: Represents an imported bank statement file

```typescript
{
  _id: ObjectId
  schoolId: ObjectId

  // Import details
  fileName: string
  fileUrl?: string // Stored file location
  bankAccount: string // Which bank account this statement is for
  dateFrom: Date
  dateTo: Date

  // Processing status
  status: "uploaded" | "parsing" | "parsed" | "failed"
  parsedAt?: Date
  errorMessage?: string

  // Metadata
  uploadedBy: ObjectId
  totalLines?: number // Number of lines parsed

  createdAt: Date
  updatedAt: Date

  // Indexes
  // - schoolId + bankAccount + dateFrom + dateTo
}
```

### 13. BankStatementLine
**Purpose**: Individual line from bank statement

```typescript
{
  _id: ObjectId
  importId: ObjectId // Parent BankStatementImport

  // Transaction details
  transactionDate: Date
  amountMinor: number // Amount (pesewas, positive for credit, negative for debit)
  balanceMinor: number // Account balance after this transaction

  // Bank-provided data
  narration: string // Transaction description
  reference?: string // Bank reference number
  chequeNumber?: string

  // Fingerprint for matching
  hash: string // Hash of date + amount + narration (for duplicate detection)

  // Reconciliation
  reconciliationStatus: "unmatched" | "matched" | "partial" | "ignored"
  matchedSettlementId?: ObjectId // Matched GatewaySettlement
  matchedPaymentIds?: ObjectId[] // Matched Payment IDs

  createdAt: Date

  // Indexes
  // - importId + transactionDate
  // - hash (for duplicate detection)
  // - reconciliationStatus + transactionDate
}
```

### 14. ReconciliationSession
**Purpose**: Represents a reconciliation session/workflow

```typescript
{
  _id: ObjectId
  schoolId: ObjectId

  // Session scope
  bankAccount: string
  dateFrom: Date
  dateTo: Date

  // Status
  status: "open" | "in_review" | "closed"

  // Summary counts
  totalBankLines: number
  matchedBankLines: number
  unmatchedBankLines: number
  partialMatches: number

  totalPayments: number
  matchedPayments: number
  unmatchedPayments: number

  // Metadata
  createdBy: ObjectId
  closedBy?: ObjectId
  closedAt?: Date
  notes?: string

  createdAt: Date
  updatedAt: Date

  // Indexes
  // - schoolId + status
  // - schoolId + bankAccount + dateFrom + dateTo
}
```

### 15. ReconciliationMatch
**Purpose**: Represents a match between bank statement and payments

```typescript
{
  _id: ObjectId
  sessionId: ObjectId // Parent ReconciliationSession

  // Matched entities
  bankStatementLineId: ObjectId
  gatewaySettlementId?: ObjectId
  paymentIds: ObjectId[] // Can match multiple payments to one bank line

  // Match details
  matchType: "exact" | "grouped" | "partial" | "manual_override"
  confidenceScore: number // 0-100, for automated matches
  amountMatchedMinor: number // Amount matched (pesewas)

  // Matching logic
  matchedBy: "automatic" | "manual"
  matchedByUserId?: ObjectId // If manual
  matchReason?: string // Why/how this match was made

  createdAt: Date

  // Indexes
  // - sessionId
  // - bankStatementLineId
  // - gatewaySettlementId
}
```

### 16. ReconIssue
**Purpose**: Tracks reconciliation issues that need attention

```typescript
{
  _id: ObjectId
  sessionId?: ObjectId // Optional: linked to reconciliation session
  schoolId: ObjectId

  // Issue details
  issueType:
    | "unmatched_bank_credit"
    | "unmatched_gateway_tx"
    | "duplicate_reference"
    | "amount_mismatch"
    | "reversed"
    | "chargeback"
    | "stale_pending"
    | "suspicious"

  severity: "low" | "medium" | "high" | "critical"

  // Related entities
  bankStatementLineId?: ObjectId
  paymentId?: ObjectId
  gatewayEventId?: ObjectId

  // Issue details
  description: string
  amountMinor?: number // Amount involved (pesewas)

  // Resolution
  status: "open" | "in_progress" | "resolved" | "ignored"
  assignedTo?: ObjectId
  resolution?: string
  resolvedBy?: ObjectId
  resolvedAt?: Date

  createdAt: Date
  updatedAt: Date

  // Indexes
  // - schoolId + status
  // - schoolId + issueType
  // - assignedTo + status
}
```

## Business Logic & Rules

### Money Handling (Minor Units)
1. **All amounts stored as integers** in minor units (pesewas for GHS)
2. **Display formatting** happens only in UI layer (divide by 100)
3. **Calculations** always use minor units to avoid rounding errors
4. **Installment calculations**: Use integer division with remainder handling
   - Example: 1000 pesewas ÷ 3 installments = 333, 333, 334 (not 333.33)

### Invoice Creation
1. **One invoice per student per academic period** (enforced at DB level via unique index)
2. Line items are created in order of importance (displayOrder)
3. Invoice status starts as "draft" or "issued"
4. Invoice number format: `INV-{year}-{studentId}-{term}` or sequential `INV-{year}-{seq}`
5. **Ad-hoc charges**: Mid-term charges added via adjustment line items (not new invoice)

### Invoice Adjustments (Append-Only Model)
1. **Once issued, invoices become immutable** (no direct edits)
2. **Changes via adjustment line items**:
   - Positive adjustments: Additional charges, penalties
   - Negative adjustments: Waivers, scholarships, corrections
3. **Adjustment requirements**:
   - Must specify `adjustmentType` and `adjustmentReason`
   - Must record `adjustedBy` (user who made adjustment)
   - Creates `InvoiceEvent` entry
4. **Version tracking**: Invoice version increments on each adjustment
5. **Previous version reference**: Optional link to previous version for audit

### Payment Allocation
1. **Flexible allocation**: Parents can allocate payment to any line item(s)
2. **Partial payments**: Can pay any amount toward any line item
3. **Over-payment handling** (formalized):
   - **Over-payment automatically creates StudentCreditBalance**
   - Credit can be applied to next invoice or other line items
   - Credit application follows `displayOrder` priority
4. **Allocation validation**: Total allocations must equal payment amount (in minor units)
5. **Transaction safety**: All allocation updates happen in MongoDB transaction

### Payment Processing Flow
1. **PaymentIntent created** when payment initiated (gateway or manual)
2. **Idempotency**: Use `idempotencyKey` to prevent duplicate processing
3. **Gateway payments**:
   - Initialize → Await webhook → Verify → Create Payment
   - Store all webhook events in GatewayEvent (dedupe by eventId)
4. **Manual payments**: Direct Payment creation (no PaymentIntent needed)
5. **Status tracking**: PaymentIntent status → Payment status → Reconciliation status

### Installment Logic
1. **Installment configuration**: Set at line item creation
2. **Explicit InstallmentSchedule docs**: Created for each installment (not computed)
3. **Flexible payment**: Parents can pay installments in any order
4. **Partial installment payment**: Allowed (e.g., pay 50% of installment 1)
5. **Status calculation**:
   - `paid`: All installments fully paid
   - `partially_paid`: Some installments paid
   - `pending`: No payments yet
   - `overdue`: Past due date with unpaid amount
6. **Reminder system**: Track `reminderSentAt` and `overdueNotifiedAt` per installment

### Status Calculations (Minor Units)
1. **Line Item Status**:
   - `paid`: amountPaidMinor >= amountMinor
   - `partially_paid`: amountPaidMinor > 0 && amountPaidMinor < amountMinor
   - `pending`: amountPaidMinor === 0
   - `overdue`: amountOutstandingMinor > 0 && dueDate < today

2. **Invoice Status**:
   - `draft`: Not yet issued (can be edited)
   - `issued`: Issued but no payments
   - `partially_paid`: Some line items paid
   - `paid`: All line items fully paid
   - `overdue`: Has overdue line items
   - `cancelled`: Invoice cancelled

3. **Payment Status**:
   - `pending`: Payment recorded but not yet verified
   - `completed`: Payment verified and allocated
   - `failed`: Payment failed
   - `refunded`: Payment refunded
   - `reversed`: Payment reversed (chargeback)

4. **Reconciliation Status**:
   - `unmatched`: No gateway/bank match yet
   - `gateway_verified`: Verified by Paystack
   - `bank_matched`: Matched to bank statement
   - `fully_reconciled`: Both gateway and bank matched
   - `needs_review`: Discrepancy detected

### Student Credit System
1. **Credit creation**: Over-payment automatically creates credit entry
2. **Credit application**:
   - Can be applied to any invoice/line item
   - Follows displayOrder priority if auto-applied
   - Creates credit entry with `type: "application"`
3. **Credit ledger**: Full audit trail of credit creation and usage
4. **Credit balance**: Real-time balanceMinor calculation from entries

### Reconciliation Logic
1. **Three sources of truth**:
   - Internal Ledger (Payment + Allocations)
   - Gateway Events (Paystack webhooks)
   - Bank Statements (imported CSV/Excel)

2. **Matching rules** (in order of confidence):
   - **Deterministic**: Paystack reference ↔ Payment.paystackReference
   - **Settlement matching**: Bank line ↔ GatewaySettlement ↔ Payments
   - **Heuristic**: Amount + date window + narration fuzzy match
   - **Manual**: Admin override with reason

3. **Match types**:
   - `exact`: 1-to-1 match
   - `grouped`: Many payments → one bank line
   - `partial`: Partial amount match
   - `manual_override`: Admin-created match

4. **Issue detection**:
   - Unmatched bank credits
   - Unmatched gateway transactions
   - Duplicate references
   - Amount mismatches
   - Stale pending payments
   - Suspicious patterns

### Transaction Safety
1. **MongoDB transactions** for all payment operations:
   - Payment creation
   - Allocation updates
   - Line item status updates
   - Invoice totals updates
   - Credit balance updates

2. **Optimistic concurrency**:
   - Use `__v` (version key) for conflict detection
   - Retry logic for concurrent updates
   - Prevents double-crediting

3. **Idempotency**:
   - PaymentIntent uses idempotencyKey
   - GatewayEvent deduplication by eventId
   - Safe to replay webhooks

## Backend APIs

### Fee Structures
- `GET /api/admin/fees/structures` - List all fee structures
- `GET /api/admin/fees/structures/:id` - Get fee structure details
- `POST /api/admin/fees/structures` - Create fee structure
- `PATCH /api/admin/fees/structures/:id` - Update fee structure
- `DELETE /api/admin/fees/structures/:id` - Delete fee structure (soft delete)

### Invoices
- `GET /api/admin/fees/invoices` - List invoices (with filters)
  - Query params: `studentId`, `academicPeriodId`, `status`, `page`, `limit`
- `GET /api/admin/fees/invoices/:id` - Get invoice details with line items
- `POST /api/admin/fees/invoices` - Create invoice for student
- `PATCH /api/admin/fees/invoices/:id` - Update invoice (draft only)
- `POST /api/admin/fees/invoices/:id/issue` - Issue invoice (draft → issued)
- `POST /api/admin/fees/invoices/:id/cancel` - Cancel invoice
- `GET /api/admin/fees/invoices/student/:studentId` - Get all invoices for student
- `GET /api/admin/fees/invoices/period/:periodId` - Get all invoices for period

### Invoice Line Items
- `GET /api/admin/fees/invoices/:invoiceId/line-items` - Get line items for invoice
- `POST /api/admin/fees/invoices/:invoiceId/line-items` - Add line item to invoice (draft only)
- `PATCH /api/admin/fees/invoices/:invoiceId/line-items/:id` - Update line item (draft only)
- `DELETE /api/admin/fees/invoices/:invoiceId/line-items/:id` - Remove line item (if draft)
- `POST /api/admin/fees/invoices/:invoiceId/line-items/:id/reorder` - Reorder line items (draft only)

### Invoice Adjustments
- `POST /api/admin/fees/invoices/:invoiceId/adjustments` - Add adjustment line item
  - Body: `adjustmentType`, `amountMinor`, `reason`, `displayOrder`
- `GET /api/admin/fees/invoices/:invoiceId/adjustments` - Get all adjustments
- `GET /api/admin/fees/invoices/:invoiceId/events` - Get invoice event timeline

### Payment Intents
- `GET /api/admin/fees/payment-intents` - List payment intents (with filters)
- `GET /api/admin/fees/payment-intents/:id` - Get payment intent details
- `POST /api/admin/fees/payment-intents` - Create payment intent
- `PATCH /api/admin/fees/payment-intents/:id` - Update payment intent status
- `POST /api/admin/fees/payment-intents/:id/cancel` - Cancel payment intent

### Payments
- `GET /api/admin/fees/payments` - List payments (with filters)
  - Query params: `studentId`, `invoiceId`, `paymentMethod`, `dateFrom`, `dateTo`
- `GET /api/admin/fees/payments/:id` - Get payment details with allocations
- `POST /api/admin/fees/payments` - Record payment
  - Body: `invoiceId`, `amount`, `paymentMethod`, `allocations[]`, `paymentDate`
- `PATCH /api/admin/fees/payments/:id` - Update payment (if pending)
- `POST /api/admin/fees/payments/:id/allocate` - Reallocate payment
- `POST /api/admin/fees/payments/:id/refund` - Process refund
- `GET /api/admin/fees/payments/invoice/:invoiceId` - Get all payments for invoice

### Payment Processing (Paystack Integration)
- `POST /api/admin/fees/payments/paystack/initialize` - Initialize Paystack payment
- `POST /api/admin/fees/payments/paystack/verify` - Verify Paystack payment (webhook)
- `GET /api/admin/fees/payments/paystack/status/:reference` - Check payment status
- `POST /api/admin/fees/payments/paystack/webhook` - Paystack webhook endpoint (dedupe-safe)

### Gateway Events
- `GET /api/admin/fees/gateway-events` - List gateway events (with filters)
- `GET /api/admin/fees/gateway-events/:id` - Get gateway event details
- `POST /api/admin/fees/gateway-events/:id/reprocess` - Reprocess failed event

### Gateway Settlements
- `GET /api/admin/fees/settlements` - List Paystack settlements
- `GET /api/admin/fees/settlements/:id` - Get settlement details
- `POST /api/admin/fees/settlements/sync` - Sync settlements from Paystack
- `GET /api/admin/fees/settlements/:id/transactions` - Get transactions in settlement

### Student Credit
- `GET /api/admin/fees/credit/student/:studentId` - Get student credit balance
- `POST /api/admin/fees/credit/student/:studentId/apply` - Apply credit to invoice
- `GET /api/admin/fees/credit/student/:studentId/history` - Get credit ledger

### Bank Statement Import
- `POST /api/admin/fees/bank-statements/import` - Upload and parse bank statement
- `GET /api/admin/fees/bank-statements` - List imported statements
- `GET /api/admin/fees/bank-statements/:id` - Get statement details
- `GET /api/admin/fees/bank-statements/:id/lines` - Get statement lines
- `DELETE /api/admin/fees/bank-statements/:id` - Delete statement (if unmatched)

### Reconciliation
- `POST /api/admin/fees/reconciliation/sessions` - Create reconciliation session
- `GET /api/admin/fees/reconciliation/sessions` - List sessions
- `GET /api/admin/fees/reconciliation/sessions/:id` - Get session details
- `POST /api/admin/fees/reconciliation/sessions/:id/matches` - Create manual match
- `GET /api/admin/fees/reconciliation/sessions/:id/suggestions` - Get suggested matches
- `POST /api/admin/fees/reconciliation/sessions/:id/close` - Close session
- `GET /api/admin/fees/reconciliation/issues` - List reconciliation issues
- `POST /api/admin/fees/reconciliation/issues/:id/resolve` - Resolve issue

### Bulk Operations
- `POST /api/admin/fees/invoices/bulk-create` - Create invoices for multiple students
- `POST /api/admin/fees/invoices/bulk-issue` - Issue multiple invoices
- `POST /api/admin/fees/payments/bulk-record` - Record multiple payments

### Reports & Analytics
- `GET /api/admin/fees/reports/summary` - Fee summary (totals, collection rate, etc.)
- `GET /api/admin/fees/reports/outstanding` - Outstanding balances report
- `GET /api/admin/fees/reports/collection` - Collection report (by period, method, etc.)
- `GET /api/admin/fees/reports/student/:studentId` - Student fee statement

## Frontend Components

### Pages

#### 1. Fees & Payments Dashboard (`/admin/fees`)
**Components:**
- `FeesDashboard` - Main dashboard with stats
- `QuickStatsCards` - Revenue, collection rate, outstanding, recent payments
- `RecentPaymentsTable` - Recent payment transactions
- `FeeDefaultersList` - Students with outstanding balances
- `UpcomingDueDates` - Invoices due soon

#### 2. Fee Structures Management (`/admin/fees/structures`)
**Components:**
- `FeeStructuresList` - Table/list of all fee structures
- `FeeStructureCard` - Card view for fee structure
- `FeeStructureForm` - Create/edit fee structure modal/form
- `FeeStructureFilters` - Filter by category, active status

#### 3. Invoices Management (`/admin/fees/invoices`)
**Components:**
- `InvoicesList` - Table/list of all invoices
- `InvoiceCard` - Card view for invoice
- `InvoiceFilters` - Filter by student, period, status
- `InvoiceSearch` - Search by invoice number, student name
- `BulkInvoiceActions` - Bulk create, issue, export

#### 4. Invoice Detail (`/admin/fees/invoices/:id`)
**Components:**
- `InvoiceHeader` - Invoice number, student info, status, totals
- `InvoiceLineItemsList` - List of line items with payment status
- `InvoiceLineItemCard` - Individual line item with payment breakdown
- `AddLineItemModal` - Add new line item to invoice
- `EditLineItemModal` - Edit line item (if draft)
- `InvoicePaymentsList` - List of payments for this invoice
- `RecordPaymentModal` - Record new payment
- `InvoiceActions` - Issue, cancel, export PDF

#### 5. Payment Recording (`/admin/fees/payments/record`)
**Components:**
- `PaymentForm` - Main payment recording form
- `InvoiceSelector` - Select invoice(s) to pay
- `PaymentAllocationEditor` - Visual editor for allocating payment across line items
- `PaymentMethodSelector` - Select payment method
- `PaystackPaymentButton` - Initialize Paystack payment
- `PaymentReceipt` - Display receipt after payment

#### 6. Payments List (`/admin/fees/payments`)
**Components:**
- `PaymentsList` - Table/list of all payments
- `PaymentCard` - Card view for payment
- `PaymentFilters` - Filter by date, method, student, status
- `PaymentSearch` - Search by receipt number, student name
- `PaymentDetailModal` - View payment details with allocations

### Shared Components

#### Invoice Components
- `InvoiceStatusBadge` - Status badge (issued, paid, overdue, etc.)
- `InvoiceTotalsCard` - Display total, paid, outstanding (with minor unit formatting)
- `InvoiceTimeline` - Timeline of invoice events (from InvoiceEvent model)
- `InvoicePDFExport` - Generate PDF invoice
- `InvoiceAdjustmentForm` - Form for adding adjustments
- `AdjustmentLineItemCard` - Display adjustment line items differently

#### Payment Components
- `PaymentAllocationChart` - Visual chart showing payment allocation
- `PaymentMethodBadge` - Badge for payment method
- `PaymentReceiptView` - Receipt view/print
- `PaymentHistoryTimeline` - Timeline of payments
- `PaymentIntentStatus` - Show payment intent status (initiated, succeeded, etc.)
- `ReconciliationStatusIndicator` - Visual indicator for reconciliation status
- `GatewayVerificationBadge` - Badge showing gateway verification status

#### Line Item Components
- `LineItemCard` - Card showing line item with payment status
- `LineItemProgressBar` - Progress bar for payment status
- `InstallmentScheduleView` - Show installment schedule
- `InstallmentStatusBadge` - Status of individual installments

#### Form Components
- `FeeStructureForm` - Form for creating/editing fee structures
- `InvoiceForm` - Form for creating invoices
- `LineItemForm` - Form for adding/editing line items
- `PaymentForm` - Form for recording payments
- `AllocationEditor` - Visual editor for payment allocation

#### Utility Components
- `FeeAmountInput` - Currency input with validation
- `InstallmentCalculator` - Calculate installment amounts
- `DueDatePicker` - Date picker for due dates
- `PaymentMethodSelector` - Dropdown for payment methods

## React Query Hooks

### Fee Structures
- `useFeeStructures()` - List all fee structures
- `useFeeStructure(id)` - Get fee structure by ID
- `useCreateFeeStructure()` - Create fee structure mutation
- `useUpdateFeeStructure()` - Update fee structure mutation
- `useDeleteFeeStructure()` - Delete fee structure mutation

### Invoices
- `useInvoices(filters)` - List invoices with filters
- `useInvoice(id)` - Get invoice by ID
- `useStudentInvoices(studentId)` - Get all invoices for student
- `usePeriodInvoices(periodId)` - Get all invoices for period
- `useCreateInvoice()` - Create invoice mutation
- `useUpdateInvoice()` - Update invoice mutation
- `useIssueInvoice()` - Issue invoice mutation
- `useCancelInvoice()` - Cancel invoice mutation
- `useBulkCreateInvoices()` - Bulk create invoices mutation

### Invoice Line Items
- `useInvoiceLineItems(invoiceId)` - Get line items for invoice
- `useAddLineItem()` - Add line item mutation
- `useUpdateLineItem()` - Update line item mutation
- `useDeleteLineItem()` - Delete line item mutation
- `useReorderLineItems()` - Reorder line items mutation

### Payments
- `usePayments(filters)` - List payments with filters
- `usePayment(id)` - Get payment by ID
- `useInvoicePayments(invoiceId)` - Get payments for invoice
- `useRecordPayment()` - Record payment mutation
- `useUpdatePayment()` - Update payment mutation
- `useAllocatePayment()` - Allocate payment mutation
- `useRefundPayment()` - Refund payment mutation

### Payment Processing
- `useInitializePaystackPayment()` - Initialize Paystack payment
- `useVerifyPaystackPayment()` - Verify Paystack payment
- `usePaystackPaymentStatus()` - Check payment status

### Payment Intents
- `usePaymentIntents(filters)` - List payment intents
- `usePaymentIntent(id)` - Get payment intent by ID
- `useCreatePaymentIntent()` - Create payment intent mutation
- `useCancelPaymentIntent()` - Cancel payment intent mutation

### Invoice Adjustments
- `useInvoiceAdjustments(invoiceId)` - Get adjustments for invoice
- `useAddAdjustment()` - Add adjustment mutation
- `useInvoiceEvents(invoiceId)` - Get invoice event timeline

### Student Credit
- `useStudentCredit(studentId)` - Get student credit balance
- `useApplyCredit()` - Apply credit to invoice mutation
- `useCreditHistory(studentId)` - Get credit ledger

### Reconciliation
- `useReconciliationSessions(filters)` - List reconciliation sessions
- `useReconciliationSession(id)` - Get session details
- `useCreateReconciliationSession()` - Create session mutation
- `useSuggestedMatches(sessionId)` - Get suggested matches
- `useCreateMatch()` - Create manual match mutation
- `useReconciliationIssues(filters)` - List reconciliation issues
- `useResolveIssue()` - Resolve issue mutation

### Bank Statements
- `useBankStatements()` - List imported statements
- `useBankStatement(id)` - Get statement details
- `useBankStatementLines(importId)` - Get statement lines
- `useImportBankStatement()` - Import statement mutation

### Gateway
- `useGatewayEvents(filters)` - List gateway events
- `useGatewayEvent(id)` - Get event details
- `useGatewaySettlements(filters)` - List settlements
- `useGatewaySettlement(id)` - Get settlement details
- `useSyncSettlements()` - Sync settlements mutation

### Reports
- `useFeeSummary()` - Get fee summary stats
- `useOutstandingBalances()` - Get outstanding balances report
- `useCollectionReport()` - Get collection report
- `useStudentFeeStatement(studentId)` - Get student fee statement

## Key Features & UX Considerations

### 1. Payment Allocation UI
**Visual Allocation Editor:**
- Show all line items with amounts and outstanding balances
- Allow drag-and-drop or input fields to allocate payment
- Real-time calculation of remaining payment amount
- Visual indicators for fully paid, partially paid, outstanding
- Warn if over-allocating or under-allocating

### 2. Installment Visualization
- Show installment schedule as timeline or list
- Visual indicators for paid/partially paid/pending/overdue installments
- Allow parents to select which installment to pay
- Show progress toward completing all installments

### 3. Invoice Status Indicators
- Color-coded badges for invoice status
- Progress bars showing payment completion
- Visual hierarchy: Invoice → Line Items → Installments

### 4. Payment History
- Timeline view of all payments
- Filter by date range, payment method, invoice
- Show payment allocations visually
- Link to receipts

### 5. Outstanding Balances
- Clear view of what's owed
- Group by invoice or line item
- Sort by due date or amount
- Quick action to record payment

### 6. Bulk Operations
- Select multiple invoices for bulk actions
- Bulk create invoices for class/grade
- Bulk issue invoices
- Bulk export invoices/receipts

## Data Flow Examples

### Creating an Invoice
1. Admin selects student and academic period
2. System checks if invoice already exists (enforce uniqueness)
3. Admin adds line items (ordered by importance)
4. For each line item, optionally configure installments
5. System calculates totals
6. Invoice saved as "draft"
7. Admin can issue invoice (draft → issued)

### Recording a Payment
1. Admin selects invoice(s) to pay
2. System shows all line items with outstanding balances
3. Admin enters payment amount
4. Admin allocates payment across line items (flexible)
5. If line item has installments, admin can specify which installment(s)
6. System validates allocations sum to payment amount
7. Payment recorded, allocations created
8. System updates line item and invoice statuses
9. Receipt generated

### Payment Allocation Logic
```
Payment Amount: 500
Line Items:
  - Tuition (Outstanding: 300) → Allocate 300
  - Library (Outstanding: 200) → Allocate 200
  - Sports (Outstanding: 100) → Allocate 0 (parent choice)
Total Allocated: 500 ✓
```

## Edge Cases & Validations

### Validations
1. **Invoice Uniqueness**: One invoice per student per period
2. **Payment Allocation**: Sum of allocations must equal payment amount
3. **Over-payment**: Handle over-payment scenarios (credit or reject)
4. **Line Item Amount**: Cannot allocate more than outstanding amount
5. **Installment Amount**: Cannot pay more than installment amount
6. **Due Dates**: Validate installment due dates are in future
7. **Invoice Status**: Cannot modify issued invoice (only draft)

### Edge Cases
1. **Partial Installment Payment**: Pay 50% of installment 1
2. **Out-of-Order Installment Payment**: Pay installment 3 before 1 and 2
3. **Multiple Payments for Same Installment**: Multiple payments toward same installment
4. **Refunds**: Reverse allocations, update credit balance, create InvoiceEvent
5. **Invoice Amendments**: Use adjustment line items (append-only model)
6. **Deleted Fee Structures**: Keep line items but mark feeStructureId as null, preserve name
7. **Student Transfer**: Invoices remain with student, new invoices created for new class
8. **Over-payment**: Automatically creates StudentCreditBalance, can be applied later
9. **Duplicate Webhooks**: Dedupe by GatewayEvent.eventId
10. **Stale Payment Intents**: Auto-expire after timeout, cleanup job
11. **Bank Statement Duplicates**: Detect by hash fingerprint
12. **Partial Bank Matches**: Support grouped matches (many payments → one bank line)
13. **Chargebacks/Reversals**: Create ReconIssue, reverse payment, update invoice
14. **Mid-term Charges**: Add via adjustment line items (keeps one invoice per term rule)

## Security & Permissions

### Role-Based Access
- **School Admin**: Full access to all fee management
- **Bursar/Finance**: Full access to payments, limited invoice creation
- **Teacher**: View-only access
- **Parent**: View own student's invoices, make payments
- **Student**: View own invoices (read-only)

### Audit Trail
- Track who created/modified invoices
- Track who recorded payments
- Track payment allocation changes
- Log all status changes

## Performance Considerations

### Indexing Strategy
- Index on `schoolId + studentId + academicPeriodId` for invoice uniqueness
- Index on `schoolId + status` for filtering
- Index on `schoolId + dueDate` for overdue queries
- Index on `invoiceId` for line items
- Index on `paymentDate` for reports

### Caching
- Cache fee structures (rarely change)
- Cache invoice summaries
- Cache payment totals (recalculate on payment)

### Aggregation Pipelines
- Use MongoDB aggregation for reports
- Pre-calculate totals where possible
- Use computed fields for status

## Migration Strategy

### Phase 1: Core Models & Foundation
1. Create FeeStructure model (with minor units)
2. Create Invoice model (with versioning, minor units)
3. Create InvoiceLineItem model (with adjustment support, minor units)
4. Create PaymentIntent model (gateway-safe)
5. Create Payment model (with reconciliation fields, minor units)
6. Create PaymentAllocation model (minor units)
7. Create InstallmentSchedule model (explicit docs)
8. Create InvoiceEvent model (timeline/audit)
9. Create StudentCreditBalance model
10. Build basic CRUD APIs with minor unit handling

### Phase 2: Payment Logic & Transaction Safety
1. Implement payment allocation logic (MongoDB transactions)
2. Implement status calculation logic (minor units)
3. Build payment recording APIs with optimistic locking
4. Add validations (allocation sums, over-payment handling)
5. Implement credit creation and application logic

### Phase 3: Invoice Adjustments & Versioning
1. Implement append-only invoice model (no mutations after issue)
2. Build adjustment line item creation
3. Implement version tracking
4. Build invoice event timeline
5. Add adjustment APIs

### Phase 4: Installments & Reminders
1. Implement installment schedule creation
2. Build installment payment logic (flexible order)
3. Implement installment status tracking
4. Build reminder system foundation

### Phase 5: Payment Processing & Gateway
1. Build PaymentIntent flow
2. Implement Paystack initialization
3. Build webhook handler with deduplication
4. Create GatewayEvent logging
5. Implement payment verification

### Phase 6: Frontend - Basic Views
1. Fee Structures management page
2. Invoices list page (with filters)
3. Invoice detail page (with timeline)
4. Payment recording form (with allocation editor)
5. Payment intent status tracking

### Phase 7: Frontend - Advanced Features
1. Payment allocation editor (visual, real-time)
2. Installment visualization and schedule
3. Invoice adjustment UI
4. Student credit balance display
5. Reports and analytics
6. Bulk operations

### Phase 8: Reconciliation Foundation
1. Create GatewaySettlement model
2. Build settlement sync from Paystack
3. Create BankStatementImport model
4. Build bank statement parser (CSV/Excel)
5. Create BankStatementLine model
6. Build basic matching logic (deterministic)

### Phase 9: Reconciliation System
1. Create ReconciliationSession model
2. Create ReconciliationMatch model
3. Create ReconIssue model
4. Build heuristic matching engine
5. Build match suggestion algorithm
6. Build reconciliation APIs

### Phase 10: Reconciliation UI
1. Build reconciliation dashboard
2. Build match builder interface
3. Build suggested matches panel
4. Build issues queue
5. Build bank statement import UI

### Phase 11: Integration & Polish
1. Receipt generation (PDF)
2. Invoice PDF export
3. Email notifications
4. Payment reminders (installments)
5. Overdue notifications

### Phase 12: Student Detail Tab
1. Reuse components from main fees page
2. Build student-specific fee view
3. Integrate with student detail page
4. Add parent payment portal integration

## Success Metrics

- Clear payment tracking (no confusion)
- Flexible payment allocation (parent choice)
- Accurate installment tracking
- Fast invoice creation (bulk operations)
- Easy payment recording
- Clear outstanding balance visibility
- Comprehensive audit trail
- Financial-grade accuracy (no rounding errors)
- Full reconciliation capability (Internal ↔ Gateway ↔ Bank)
- Zero double-crediting (transaction safety)
- Perfect auditability (append-only model)

## Key Architectural Decisions

### Why Minor Units?
- Eliminates rounding errors (critical for installments like 33.33%)
- Financial-grade accuracy required for school operations
- Standard practice in payment systems (Stripe, Paystack use minor units)

### Why PaymentIntent?
- Separates "attempted" from "succeeded"
- Prevents ghost payments
- Gateway-safe architecture (handles webhook delays/failures)
- Idempotency support

### Why Append-Only Invoices?
- Perfect audit trail (no "who changed what?" disputes)
- Prevents accidental modifications
- Adjustments are explicit and traceable
- Industry best practice for financial records

### Why Explicit InstallmentSchedule?
- Enables fast queries ("due this week", "overdue")
- Supports reminder system
- Accurate overdue logic per installment
- Better analytics and reporting

### Why Reconciliation System?
- Finance teams need to reconcile (not optional)
- Handles real-world scenarios (duplicates, delays, partial matches)
- Builds trust with school finance departments
- Required for financial compliance

### Why Student Credit?
- Overpayments are common (parents pay extra)
- Avoids manual adjustments
- Can be applied automatically to next invoice
- Clear ledger of credit creation and usage

## Page Structure (Premium UX)

### `/admin/fees` - Dashboard
- Quick stats cards (revenue, collection rate, outstanding, recent)
- Recent payments table
- Fee defaulters list
- Upcoming due dates
- Command palette integration (`⌘K`)

### `/admin/fees/structures` - Fee Templates
- List of fee structures with categories
- Create/edit fee structure modal
- Filter by category, active status
- Bulk operations

### `/admin/fees/invoices` - Invoice Management
- Invoice list with filters (student, period, status)
- Search by invoice number, student name
- Bulk create, issue, export
- Saved views ("Overdue this term", "Paid today")

### `/admin/fees/invoices/[id]` - Invoice Detail
- Invoice header with student info, status, totals
- Line items list with payment breakdown
- Payment timeline
- Record payment button
- Add adjustment button (if issued)
- Export PDF

### `/admin/fees/payments` - Payments List
- Payments table with reconciliation status badges
- Filter by reconciliation status
- Payment detail modal
- Receipt view/print

### `/admin/fees/reconciliation` - Reconciliation Workspace
- Tabs: Bank Lines, Gateway Transactions, Payments, Issues
- Unmatched items shown first
- Match builder drawer
- Suggested matches panel (confidence-scored)
- Issues queue

### `/admin/fees/reports` - Reports & Analytics
- Fee summary dashboard
- Outstanding balances report
- Collection report (by period, method)
- Student fee statements

---

**Note**: This strategy document serves as the complete blueprint for building a world-class fees & payments system. All models, APIs, components, and business logic are specified with financial-grade accuracy and reconciliation in mind.

---

## 🚀 Future Enhancements: Advanced Analytics & Insights Dashboard

> **Status**: Planned for implementation once sufficient real-world data is available
> **Priority**: High-value features that will significantly enhance decision-making capabilities
> **Prerequisites**: Minimum 2-3 months of transaction data for meaningful insights

This section outlines comprehensive analytics and insights features to transform the fees dashboard into a powerful financial intelligence center. These features will enable data-driven decision-making, proactive collection management, and strategic financial planning.

### Revenue Analytics & Trends

#### 1. Revenue Trend Chart
- **Visualization**: Interactive line/area chart showing revenue over time
- **Time Periods**: Daily, weekly, monthly views with customizable date ranges
- **Comparisons**:
  - Current period vs previous period (MoM, YoY)
  - Highlight revenue peaks and identify trends
  - Filter by academic period for term-to-term analysis
- **Features**:
  - Hover tooltips showing exact values and percentage changes
  - Export chart data as CSV/PDF
  - Drill-down capability to view underlying transactions

#### 2. Collection Velocity Metrics
- **Key Metrics**:
  - Average days from invoice issue to payment completion
  - Payment timeline distribution (paid within 7/14/30/60+ days)
  - Identify bottlenecks in the collection process
- **Visualization**: Histogram showing payment distribution by days-to-pay
- **Actionable Insights**: Identify which invoice types or student segments pay fastest/slowest

#### 3. Revenue Forecasting
- **Projections**:
  - Projected revenue for current/next academic period based on historical trends
  - Confidence intervals showing prediction ranges
  - Scenario planning (best case, worst case, most likely)
- **Use Cases**: Budget planning, resource allocation, financial planning
- **Methodology**: Time-series forecasting using historical patterns

### Payment Analytics

#### 4. Payment Method Breakdown
- **Visualization**: Pie chart and bar chart showing payment distribution
- **Metrics**:
  - Revenue by payment method (Cash, Mobile Money, Bank Transfer, Card, etc.)
  - Transaction count by method
  - Average transaction size by method
- **Trends**: Track payment method preferences over time
- **Insights**: Identify which methods are growing/declining, optimize payment channels

#### 5. Payment Timing Patterns
- **Visualization**: Heatmap showing payment patterns
  - Day of week analysis (which days see most payments)
  - Time of day analysis (peak payment hours)
  - Monthly patterns (seasonal trends)
- **Use Cases**:
  - Optimize payment reminder timing
  - Schedule payment collection activities
  - Understand student/parent payment behavior

#### 6. Installment Performance Analysis
- **Metrics**:
  - Percentage of invoices using installments
  - Installment completion rate
  - Average number of installments per invoice
  - Default rate comparison: installments vs full payment
- **Visualization**: Comparison charts showing installment vs full payment performance
- **Insights**: Determine if installments help or hurt collection rates

### Collection Health & Risk Analysis

#### 7. Aging Analysis Dashboard
- **Outstanding Invoice Breakdown by Age**:
  - **Current** (0-30 days): Green indicator
  - **31-60 days**: Yellow indicator
  - **61-90 days**: Orange indicator
  - **90+ days**: Red indicator (critical)
- **Visualization**: Stacked bar chart showing amounts in each bucket
- **Features**:
  - Click to drill down into specific age bucket
  - Export aging report
  - Identify accounts requiring immediate attention

#### 8. Collection Efficiency Score
- **Composite Health Score** (0-100 scale):
  - Factors: Collection rate, aging analysis, default rate, payment velocity
  - Weighted algorithm combining multiple metrics
- **Visualization**:
  - Large score display with color coding (green/yellow/red)
  - Trend line showing score over time
  - Breakdown showing contribution of each factor
- **Benchmarking**: Compare against school's historical performance

#### 9. Risk Stratification
- **Student/Invoice Categorization**:
  - **Low Risk**: Green - Good payment history, small outstanding
  - **Medium Risk**: Yellow - Some delays, moderate outstanding
  - **High Risk**: Red - Poor history, large outstanding, multiple overdue
- **Risk Factors**:
  - Outstanding amount
  - Days overdue
  - Payment history (on-time payment rate)
  - Number of overdue invoices
- **Actionable Lists**:
  - High-risk students requiring immediate attention
  - Recommended actions per risk level
  - Automated reminder suggestions

### Performance by Segment

#### 10. Grade/Class Performance Dashboard
- **Metrics per Grade/Class**:
  - Collection rate by grade/class group
  - Total outstanding amounts by grade
  - Average payment time by grade
  - Number of defaulters by grade
- **Visualization**:
  - Bar chart comparing grades side-by-side
  - Heatmap showing performance across all classes
- **Insights**:
  - Identify top and bottom performing grades
  - Enable targeted interventions
  - Share best practices from high-performing classes

#### 11. Fee Structure Analytics
- **Metrics**:
  - Revenue generated by each fee structure
  - Default rate by fee structure
  - Most/least popular fee structures
  - Average payment time by fee type
- **Visualization**:
  - Revenue waterfall chart
  - Comparison tables
- **Use Cases**:
  - Optimize fee structure offerings
  - Identify problematic fee types
  - Price optimization insights

#### 12. Academic Period Comparison
- **Comparison Views**:
  - Current period vs previous period (side-by-side)
  - Year-over-year trends
  - Multi-period trend analysis
- **Metrics Compared**:
  - Total revenue
  - Collection rate
  - Outstanding amounts
  - Average payment time
  - Number of invoices issued
- **Visualization**: Comparison cards and trend lines

### Advanced Insights

#### 13. Student Credit Analysis
- **Metrics**:
  - Total credit balances across all students
  - Credit utilization trends over time
  - Students with significant credit balances
  - Credit application patterns
- **Visualization**:
  - Credit balance distribution chart
  - Top credit holders list
  - Credit usage timeline
- **Use Cases**:
  - Manage overpayments effectively
  - Identify students with unused credit
  - Track credit application trends

#### 14. Adjustment Analytics
- **Metrics**:
  - Total adjustments by type (waivers, scholarships, penalties, corrections)
  - Adjustment trends over time
  - Impact on revenue (total amount adjusted)
  - Most common adjustment reasons
- **Visualization**:
  - Stacked area chart showing adjustment types over time
  - Pie chart showing adjustment type distribution
- **Insights**:
  - Identify patterns in adjustments
  - Track policy effectiveness
  - Budget impact analysis

#### 15. Payment Predictions (ML-Enhanced)
- **Predictive Features**:
  - Likelihood of payment for outstanding invoices
  - Expected payment dates based on historical patterns
  - Risk scores for outstanding invoices
- **Methodology**:
  - Machine learning models trained on historical payment data
  - Factors: Student history, invoice amount, days overdue, payment method preferences
- **Use Cases**:
  - Prioritize collection efforts
  - Optimize reminder timing
  - Forecast cash flow

### Actionable Insights Panel

#### 16. Smart Recommendations Engine
- **AI-Generated Insights**:
  - "Collection rate dropped 5% this month - consider sending payment reminders"
  - "Grade 7 has 40% outstanding - schedule parent meeting"
  - "Mobile money payments increased 30% - promote this payment method"
  - "3 invoices approaching 90-day mark - escalate to management"
- **Features**:
  - Contextual recommendations based on current data
  - Action buttons for each recommendation
  - Dismiss/archive functionality
  - Priority scoring

#### 17. Real-Time Alert System
- **Alert Types**:
  - **Critical**: Large outstanding amounts, invoices approaching critical age
  - **Warning**: Sudden drops in collection rate, unusual payment patterns
  - **Info**: Milestones reached, positive trends
- **Delivery**:
  - In-app notifications
  - Email alerts (configurable)
  - Dashboard badges
- **Customization**:
  - User-configurable thresholds
  - Alert frequency settings
  - Alert grouping and filtering

### Visual Enhancements

#### 18. Interactive Dashboards
- **Features**:
  - Date range filters (custom, preset ranges)
  - Drill-down capability from summary to detailed views
  - Exportable reports (PDF, CSV, Excel)
  - Customizable views (save favorite configurations)
  - Real-time data updates via SSE
- **Dashboard Types**:
  - Executive summary dashboard
  - Operations dashboard
  - Collections dashboard
  - Financial planning dashboard

#### 19. Comparative Views
- **Comparison Types**:
  - Side-by-side period comparison
  - Benchmark against school averages
  - Target vs actual performance
  - Peer comparison (if multi-school system)
- **Visualization**:
  - Split-screen comparisons
  - Variance indicators (better/worse)
  - Percentage change displays

### Implementation Priority

#### Phase 1: Foundation Analytics (High Priority)
1. **Revenue Trend Chart** - Essential for understanding performance over time
2. **Aging Analysis Dashboard** - Critical for identifying collection issues
3. **Payment Method Breakdown** - Helps optimize payment channels
4. **Grade/Class Performance** - Enables targeted interventions
5. **Collection Efficiency Score** - Quick health indicator

#### Phase 2: Advanced Analytics (Medium Priority)
6. **Collection Velocity Metrics** - Understand payment patterns
7. **Payment Timing Patterns** - Optimize operations
8. **Risk Stratification** - Prioritize collection efforts
9. **Fee Structure Analytics** - Optimize offerings
10. **Academic Period Comparison** - Track progress

#### Phase 3: Predictive & AI Features (Lower Priority)
11. **Payment Predictions** - ML-enhanced forecasting
12. **Smart Recommendations Engine** - AI-powered insights
13. **Revenue Forecasting** - Strategic planning
14. **Student Credit Analysis** - Advanced credit management
15. **Adjustment Analytics** - Policy insights

### Technical Considerations

#### Data Requirements
- **Minimum Data**: 2-3 months of transaction history for meaningful trends
- **Ideal Data**: 6+ months for accurate forecasting and ML models
- **Data Quality**: Clean, consistent data is essential for reliable insights

#### Performance Optimization
- **Caching Strategy**:
  - Pre-aggregate common queries
  - Cache dashboard data with appropriate TTL
  - Use MongoDB aggregation pipelines for efficient queries
- **Real-Time Updates**:
  - SSE for live data updates
  - Incremental updates rather than full refreshes
- **Chart Rendering**:
  - Use efficient charting libraries (Recharts, Chart.js)
  - Lazy load heavy visualizations
  - Virtual scrolling for large datasets

#### API Endpoints Needed
- `/api/admin/fees/analytics/revenue-trends`
- `/api/admin/fees/analytics/payment-methods`
- `/api/admin/fees/analytics/aging-analysis`
- `/api/admin/fees/analytics/grade-performance`
- `/api/admin/fees/analytics/collection-score`
- `/api/admin/fees/analytics/payment-predictions`
- `/api/admin/fees/analytics/recommendations`

#### Frontend Components
- `RevenueTrendChart.tsx` - Line/area chart component
- `AgingAnalysisCard.tsx` - Aging breakdown visualization
- `PaymentMethodBreakdown.tsx` - Pie/bar chart component
- `GradePerformanceTable.tsx` - Comparative table
- `CollectionScoreCard.tsx` - Score display with breakdown
- `RecommendationsPanel.tsx` - AI insights display
- `AlertCenter.tsx` - Real-time alerts component
- `AnalyticsDashboard.tsx` - Main analytics container

### Success Metrics

- **Adoption Rate**: % of admin users accessing analytics dashboard
- **Action Rate**: % of recommendations acted upon
- **Collection Improvement**: Increase in collection rate after implementing insights
- **Time Savings**: Reduction in time spent on manual analysis
- **Decision Quality**: Improvement in financial decisions based on data

---

**Next Steps**: Once sufficient real-world data is available (2-3 months minimum), begin implementation with Phase 1 features, starting with Revenue Trend Chart and Aging Analysis Dashboard.
