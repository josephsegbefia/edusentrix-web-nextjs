# EduSentrix - Expenses Module Spec (Admin)

This spec defines a premium Expenses module for the EduSentrix Admin/Staff portal. It integrates with the Financial Center (central ledger) so the school can track outflows, approvals, budgets, receipts, and reporting with audit-grade integrity.

Scope: Admin/Staff portal (Admin + Bursar + optional Approver roles).
Out of scope (v1): payroll, procurement purchase orders, full accounting chart of accounts, tax/VAT filings.

---

## 1. Sidebar name and placement

Sidebar label: Expenses
(Alt: Operational Expenses)

Recommended finance cluster:
- Financial Center
- Fees & Invoices
- Store (optional)
- Expenses
- Fundraising (optional)
- Reports

---

## 2. Product goals

Must-win outcomes:
- Record expenses quickly with receipts and payment method.
- Enforce approvals (spend control).
- Budget vs actual per term/month.
- Exportable evidence (CSV/PDF) for accountant/audit.
- Every paid expense writes a corresponding FinancialTransaction ledger record.

World-class qualities:
- Audit safe (no silent edits after approval/paid).
- Clear approval chain and status timeline.
- Budget burn-rate visibility + alerts.
- Vendor analytics and cost-center tracking.

---

## 3. Roles and permissions (capabilities)

Core capabilities:
- expenses.read
- expenses.create
- expenses.edit_draft
- expenses.submit
- expenses.approve
- expenses.reject
- expenses.mark_paid
- expenses.export
- expenses.manage_categories
- expenses.manage_budgets

Suggested access:
- Admin: all
- Bursar: read/create/submit/mark_paid/export (approve optional per policy)
- Approver (Headmaster): approve/reject/read/export
- Staff (optional): create + submit only (restricted)

Security rule:
- Hiding UI is not security. APIs must enforce capabilities.

---

## 4. Data model (Mongoose)

All entities include:
- schoolId (indexed)
- createdAt/updatedAt timestamps

### 4.1 ExpenseCategory
File: src/models/ExpenseCategory.ts

Fields:
- schoolId
- name (unique per school)
- code (optional)
- parentId (optional for subcategory)
- isActive
- createdBy

Indexes:
- (schoolId, name) unique
- (schoolId, isActive)

Default categories (seed):
- Utilities
- Repairs & Maintenance
- Fuel & Transport
- Stationery/Printing
- ICT/Internet
- Events
- Staff Welfare
- Cleaning
- Security
- Misc

### 4.2 Vendor
File: src/models/Vendor.ts

Fields:
- schoolId
- name (unique per school)
- phone (optional)
- email (optional)
- notes (optional)
- isActive

Indexes:
- (schoolId, name) unique

### 4.3 SchoolExpense (main)
File: src/models/SchoolExpense.ts

Statuses:
- draft -> submitted -> approved/rejected -> paid
- optional: cancelled

Fields:
- schoolId
- expenseNumber (EXP-YYYY-00001)
- status
- title
- description (optional)
- categoryId
- vendorId (optional)
- amountMinor (integer)
- currency (default GHS)
- expenseDate (date the expense occurred)

Payment fields:
- method: cash | mobile_money | bank_transfer | cheque | card | other
- reference (optional)
- paidAt (optional)
- paidBy (optional userId)

Receipts:
- receipts[]: { url, type: image|pdf (optional), uploadedAt, uploadedBy }

Costing:
- costCenter (optional): admin | academics | maintenance | transport | ict | events | other
- academicPeriodId (optional)

Approvals:
- submittedAt, submittedBy
- approvedAt, approvedBy, approvalNote (optional)
- rejectedAt, rejectedBy, rejectionReason (optional)

Audit locking:
- lockedAt (set when approved or paid)
- lockReason: approved | paid

Ledger linkage:
- financialTransactionId (optional)

Indexes:
- (schoolId, expenseNumber) unique
- (schoolId, status, expenseDate desc)
- (schoolId, categoryId, expenseDate desc)
- (schoolId, vendorId, expenseDate desc)

Immutability (world-class):
- After approved or paid, the record is locked.
- Corrections happen via:
  - cancel+replace (policy) OR
  - an Adjustment expense (recommended in v2) rather than editing history.

### 4.4 ExpenseBudget (v1.5 optional, but recommended)
File: src/models/ExpenseBudget.ts

Fields:
- schoolId
- academicPeriodId
- categoryId
- budgetAmountMinor
- currency
- warnAtPercent (default 80)
- hardStopAtPercent (optional)
- createdBy

Indexes:
- (schoolId, academicPeriodId, categoryId) unique

### 4.5 ExpenseApprovalPolicy (optional v2)
File: src/models/ExpenseApprovalPolicy.ts

Fields:
- schoolId
- rules[]:
  - minAmountMinor
  - categoryIds (optional)
  - approverRole OR approverUserIds[]
- createdBy

Purpose:
- Threshold approvals (eg > GHS 2000 requires headmaster).

---

## 5. API routes (Next.js App Router)

All routes are protected and enforce capabilities.

### 5.1 Categories
- GET  /api/admin/expenses/categories
- POST /api/admin/expenses/categories
- PATCH /api/admin/expenses/categories/:id (rename, deactivate)

### 5.2 Vendors
- GET  /api/admin/expenses/vendors
- POST /api/admin/expenses/vendors
- PATCH /api/admin/expenses/vendors/:id

### 5.3 Expenses
List:
- GET /api/admin/expenses
Query:
- status, categoryId, vendorId, method
- dateFrom, dateTo
- q (search title/desc/vendor)
- page, limit

Create:
- POST /api/admin/expenses (creates draft)

Detail:
- GET /api/admin/expenses/:id

Edit (draft only):
- PATCH /api/admin/expenses/:id

Workflow:
- POST /api/admin/expenses/:id/submit
- POST /api/admin/expenses/:id/approve
- POST /api/admin/expenses/:id/reject
- POST /api/admin/expenses/:id/mark-paid

### 5.4 Budgets (optional v1.5)
- GET  /api/admin/expenses/budgets?academicPeriodId=...
- POST /api/admin/expenses/budgets
- PATCH /api/admin/expenses/budgets/:id

### 5.5 Export
- POST /api/admin/expenses/export
Uses ReportExport pattern (async export job).
Payload includes filters + format (csv default).

---

## 6. Ledger integration (must-have)

When an expense becomes paid:
- Create FinancialTransaction:
  - direction: outflow
  - category: expenses
  - sourceModule: expenses
  - sourceId: SchoolExpense._id
  - amountMinor, currency, method
  - occurredAt: paidAt (preferred) else expenseDate
  - status: success
  - attachments: receipt urls

Store financialTransactionId on SchoolExpense.

Reversals/refunds:
- Do not edit the original transaction.
- Create a new ledger entry with category refund/reversal referencing the original.

---

## 7. Admin UI (premium)

Pages:
- /admin/expenses (list + KPIs + filters)
- /admin/expenses/new (page or modal)
- /admin/expenses/:id (detail)
- /admin/expenses/budgets (optional)

List KPIs:
- This term spend
- This month spend
- Pending approvals
- Paid today

Table columns:
- status chip
- title
- category
- vendor
- amount
- method
- expenseDate
- createdBy
- actions

Detail view:
- Timeline: created -> submitted -> approved/rejected -> paid
- Receipt gallery (image lightbox + pdf preview)
- Actions (role based): submit/approve/reject/mark paid
- Missing receipt warning chip

World-class UI extras:
- Filters: "missing receipt", "over budget", "high spend"
- Vendor spend card on vendor click

---

## 8. Reporting

Minimum:
- Spend totals by category and vendor
- Trend by week/month
- Budget vs actual (if budgets enabled)
- Export CSV (accountant friendly)

World-class (later):
- Rule-based anomalies:
  - repairs up 40% vs last month
  - fuel spend unusually high this week

---

## 9. Build plan

Phase 1 (core):
- Models: ExpenseCategory, Vendor, SchoolExpense
- Draft workflow + approvals + mark paid
- Receipt uploads (store URLs)
- Ledger write on mark paid
- UI: list + create + detail
- Export job

Phase 2 (budgets):
- ExpenseBudget model + burn rate UI + alerts

Phase 3 (controls):
- Approval policies (threshold rules)
- Recurring expenses
- Vendor analytics dashboard

Phase 4 (audit-grade):
- Reversal workflows
- Lock prior term
- Reconciliation integration

---

## 10. Acceptance criteria (v1)

- Admin/Bursar can create expense draft, upload receipt, submit, approve, mark paid.
- Approved/paid expenses are locked (no silent edits).
- Every paid expense creates a FinancialTransaction entry.
- List supports filtering and export job enqueue.