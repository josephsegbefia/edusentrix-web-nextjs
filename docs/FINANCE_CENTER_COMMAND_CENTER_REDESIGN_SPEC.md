# Finance Center Command Center Redesign Spec

## 1. Purpose

The current `/admin/finance` page should become a serious school finance command center.

It should not behave like a decorative dashboard or a shallow menu of finance links. It should operate as the daily control room for the bursar, headteacher, accountant, and authorized school administrators.

The redesigned finance center must answer four questions quickly:

1. What is the school’s current money position?
2. What fees are owed, overdue, collected, pending, or at risk?
3. What finance work needs action today?
4. Can the school trust the numbers shown here?

The page should support action, review, audit, and decision-making without clutter.

## 2. Current Problem

The existing `/admin/finance` page mixes several unrelated ideas into one busy interface:

- general inflow/outflow KPIs,
- transaction summaries,
- fees preview,
- expenses preview,
- reconciliation shortcut,
- bursar invitation,
- manual transaction entry,
- disbursement links,
- generic dashboard cards.

This creates three problems.

First, the page does not clearly distinguish between school-fee receivables, actual cash collected, unreconciled payment evidence, general income, expenses, and ledger entries.

Second, the user does not immediately know what to do next. A serious finance user needs queues, exceptions, controls, and closing workflows more than decorative analytics.

Third, the page feels like a SaaS metrics dashboard instead of a school finance operations desk.

## 3. Product Positioning

Rename the mental model from **Financial Center** to **Finance Command Center**.

The command center is the top-level operating view. It should route users into specialized workflows:

- Fees and receivables
- Payments inbox
- Reconciliation
- Expenses and payables
- Disbursements
- Ledger and audit
- Reports
- Payment setup

The command center does not replace those workflows. It summarizes them, ranks the work, and gives clear entry points.

## 4. Industry Pattern

Finance modules in serious school management systems and accounting-adjacent products usually split work into these domains:

| Domain | Purpose |
| --- | --- |
| Receivables | Invoices, bills, student balances, overdue accounts, credits |
| Collections | Online payments, cash payments, bank transfer records, approvals |
| Reconciliation | Bank/gateway statement matching, unmatched items, settlement checks |
| Payables | Expenses, vendors, reimbursements, approvals, disbursements |
| Ledger | Immutable financial events, corrections, reversals, audit trail |
| Reporting | Debtors reports, collection reports, cashbook, daily close, exports |
| Controls | Maker-checker approval, locked periods, role permissions, audit logs |

EduSentrix already has many of these surfaces. The redesign should make them feel like one coherent finance operating system.

## 5. Primary Users

### Bursar / Finance Staff

Needs to:

- record payments,
- approve or reject pending payments,
- follow up on overdue accounts,
- reconcile bank and gateway data,
- close cash at end of day,
- produce collection reports,
- explain payment/account issues to guardians.

### Headteacher / School Admin

Needs to:

- see collection health,
- identify risk areas,
- approve sensitive transactions,
- monitor overdue accounts,
- review finance controls,
- understand whether numbers are trustworthy.

### Billing Owner / Payment Setup Owner

Needs to:

- verify payment setup,
- resolve payout/settlement issues,
- review platform or gateway status,
- understand online collection readiness.

### Auditor / Board Reviewer

Needs to:

- inspect transaction history,
- verify approvals,
- confirm reconciliation status,
- export reports,
- trace corrections and reversals.

## 6. Design Principles

1. **Operational before analytical**
   The first screen should show what needs action, not just charts.

2. **Trust is a first-class signal**
   Reconciliation, approval status, failed payments, and ledger exceptions must be visible.

3. **Separate cash from receivables**
   Amount billed, amount collected, amount outstanding, amount overdue, pending payments, and settlement position must not be blended.

4. **One clear primary action per workflow**
   The command center can offer actions, but complex work should happen in dedicated screens.

5. **Human-controlled finance**
   Leo may suggest, explain, draft, rank, and summarize. Leo must not silently approve, send, reverse, reconcile, or refund.

6. **Dense but calm**
   Finance users need scannable, compact information. Avoid marketing-style hero layouts, excessive gradients, and oversized decorative cards.

7. **Auditability**
   Every sensitive action should produce traceable state: who did it, when, why, before/after values, and linked evidence.

## 7. Proposed Information Architecture

### Existing Routes To Keep

- `/admin/finance` — Finance Command Center
- `/admin/finance/transactions` — Ledger / transaction log
- `/admin/finance/transactions/:id` — Transaction detail and audit trail
- `/admin/finance/reconciliation/sessions` — Reconciliation sessions
- `/admin/finance/reconciliation/sessions/new` — New reconciliation session
- `/admin/finance/reconciliation/sessions/:id` — Reconciliation workspace
- `/admin/finance/disbursements` — Disbursements
- `/admin/fees` — Fees and payments overview
- `/admin/fees/invoices` — Invoices
- `/admin/fees/invoices/new` — Create invoice
- `/admin/fees/structures` — Fee structures
- `/admin/fees/payments/record` — Record payment
- `/admin/expenses` — Expenses workflow, if present

### Recommended New Routes

- `/admin/finance/payments` — Payment inbox
- `/admin/finance/cash-close` — Daily cash closure
- `/admin/finance/reports` — Finance reports
- `/admin/finance/settings` — Finance-specific settings, if separate from payment setup

### Redirects / Cross-links

The command center should link into dedicated surfaces instead of duplicating them.

Examples:

- Pending payments -> payment inbox
- Unmatched reconciliation items -> reconciliation sessions
- Overdue fee accounts -> fees/defaulters view
- Failed transactions -> filtered ledger
- Expenses awaiting approval -> expenses page
- Settlement or payout issue -> payment setup/disbursements

## 8. Finance Command Center Layout

### 8.1 Header

The header should be compact.

Content:

- Page title: `Finance`
- Context line: current academic period, date range, last refreshed time
- Status chips:
  - Payment setup status
  - Reconciliation health
  - Cash close status for today
  - Current period lock status, if applicable

Primary actions:

- `Record Payment`
- `Issue Invoices`
- `Reconcile`
- `Export Report`

Secondary actions:

- `Invite Bursar`
- `Payment Setup`
- `Finance Settings`

Do not put `Invite Bursar` in the most prominent visual position. It is an administrative setup action, not a daily finance task.

### 8.2 Date And Scope Controls

Controls:

- Date range:
  - Today
  - This week
  - This month
  - Current term
  - Custom
- Academic period
- Grade/class filter
- Payment channel filter
- Include/exclude reversed/refunded transactions

Default view:

- Use `Current term` for receivables-oriented metrics.
- Use `Today` or `This week` for operations queues.
- Show both explicitly where needed.

### 8.3 KPI Row

Replace generic KPIs with school-finance-specific KPIs.

Recommended KPIs:

1. **Collected**
   Money successfully collected in selected range.

2. **Outstanding Fees**
   Active unpaid receivables for current academic period.

3. **Overdue Fees**
   Amount past due and number of affected students/families.

4. **Pending Approval**
   Payments/expenses awaiting finance review.

5. **Unreconciled**
   Bank/gateway evidence not matched to payment records.

6. **Net Cash Movement**
   Collected inflows minus approved outflows in selected range.

Each KPI should have:

- amount,
- count where useful,
- trend only where meaningful,
- click target,
- clear loading and empty states.

### 8.4 Work Queue

The work queue is the most important area of the page.

It should be titled: **Needs Attention**

Queue items:

- Payments pending approval
- High-confidence payments ready to approve
- Failed online payments
- Unmatched bank/gateway lines
- Ambiguous reconciliation suggestions
- Overdue families requiring reminder
- Expense approvals due
- Cash close variance
- Refund/reversal requests
- Duplicate-looking transactions

Each queue item should show:

- severity,
- count,
- amount if applicable,
- owner/role,
- suggested next action,
- link to workflow,
- Leo explanation button.

Example:

```text
12 payments pending approval
GHS 8,420 total · 9 have receipts attached
Action: Review payment inbox
```

### 8.5 Trust And Controls Panel

This panel answers: “Can we trust these numbers?”

Signals:

- Last reconciliation session
- Matched/unmatched/ambiguous counts
- Active reconciliation alerts
- Pending maker-checker approvals
- Locked period warnings
- Failed/reversed/refunded transaction count
- Payment setup health
- Settlement/payout health

States:

- Healthy
- Needs review
- Critical

This should be visually distinct from performance metrics.

### 8.6 Fees Collection Panel

Purpose:

Show accounts receivable health without forcing users into the full fees page.

Include:

- Billed vs collected
- Collection rate
- Outstanding amount
- Aging buckets:
  - Not due
  - 1-7 days overdue
  - 8-30 days overdue
  - 31+ days overdue
- Top overdue families/students
- Grade/class collection comparison
- Reminder status

Actions:

- View fees
- View defaulters
- Send reminders
- Issue invoices
- Export debtors report

### 8.7 Payments Panel

Purpose:

Show collection workflow, especially cash and online payments needing review.

Include:

- Today’s payments by channel:
  - Cash
  - Mobile money
  - Card
  - Bank transfer
  - Cheque
- Pending approval count
- Failed payment count
- Unapplied payment count
- Recent payments

Actions:

- Record payment
- Open payment inbox
- Review failed payments
- Export payment report

### 8.8 Reconciliation Panel

Purpose:

Show whether finance records match external evidence.

Include:

- Last import/source
- Last reconciliation run time
- Matched count
- Unmatched count
- Ambiguous count
- Ignored count
- Alert count
- Suggested exact matches

Actions:

- Start reconciliation
- Continue latest session
- Upload statement
- View alerts
- Export reconciliation report

### 8.9 Expenses And Disbursements Panel

Purpose:

Show outgoing money operations.

Include:

- Pending expense approvals
- Approved but unpaid disbursements
- Recent expenses
- Vendor/payee summary
- Budget impact, if budgets are active

Actions:

- Open expenses
- Review approvals
- Open disbursements
- Create expense

### 8.10 Ledger And Audit Panel

Purpose:

Give confidence that everything can be traced.

Include:

- Recent ledger entries
- Corrections/reversals
- High-risk manual transactions
- Transactions requiring dual control
- Export ledger

Actions:

- Open ledger
- Export transactions
- Review corrections

### 8.11 Reports Panel

Reports should be first-class.

Reports:

- Daily collection report
- Debtors report
- Class/grade collection report
- Cashbook
- Reconciliation report
- Payment channel report
- Expense report
- Income and expenditure summary
- Audit trail export

Each report should support:

- date range,
- academic period,
- grade/class,
- export CSV/PDF,
- Leo commentary draft.

## 9. Leo Integration

Leo should be integrated as a finance operations analyst.

Leo should not behave like a generic chat widget. It should provide contextual, evidence-backed assistance.

### 9.1 Leo Finance Brief

Place near the top of `/admin/finance`.

Purpose:

Summarize the day or selected range in plain language.

Inputs:

- financial overview KPIs,
- fees summary,
- pending payments,
- reconciliation summary,
- failed payments,
- overdue accounts,
- expenses pending approval,
- cash close status,
- recent anomalies.

Output:

- concise summary,
- top risks,
- recommended actions,
- links to workflows.

Example:

```text
Today: GHS 8,450 collected, 12 payments pending approval, and 4 bank lines unmatched.
JHS 2 has the weakest collection rate this week. Start with payment approvals, then reconcile exact bank matches.
```

### 9.2 Leo Smart Queue Ranking

Leo should rank work queue items based on:

- financial impact,
- age,
- confidence,
- operational risk,
- deadline proximity,
- policy violations,
- user role.

Example ranking:

1. Approve 9 receipt-backed cash payments.
2. Match 6 exact bank statement lines.
3. Review 2 duplicate-looking mobile money records.
4. Send reminders to 18 guardians overdue by 14+ days.

Leo should show reasoning:

- same amount,
- same reference,
- overdue age,
- missing receipt,
- large balance,
- maker-checker requirement.

### 9.3 Leo Payment Explanation

On payment rows:

Actions:

- `Explain`
- `Check duplicate risk`
- `Draft guardian message`
- `Summarize account`

Leo should answer:

- Why is this payment pending?
- Why did this payment fail?
- Which invoice does this likely belong to?
- Is this payment safe to approve?
- Is another approval required?

### 9.4 Leo Reconciliation Assistant

On unmatched statement lines:

Leo should suggest possible matches using:

- amount,
- date proximity,
- payment reference,
- payer phone,
- guardian/student name,
- invoice number,
- previous payment behavior.

Output should include:

- recommended match,
- confidence score,
- evidence list,
- risks,
- alternative candidates.

Leo may prepare the match, but the user must confirm.

### 9.5 Leo Reminder Drafting

Leo should draft fee reminders based on account state.

Message types:

- polite reminder,
- overdue follow-up,
- payment plan reminder,
- final notice,
- class-wide reminder,
- exam/report restriction warning if school policy allows.

Inputs:

- guardian name,
- student name,
- invoice balance,
- due date,
- overdue age,
- previous reminder history,
- payment plan status,
- school tone settings.

Leo must not send automatically.

### 9.6 Leo Debtor Risk Analysis

Leo should identify accounts likely to need intervention.

Risk signals:

- repeated late payment,
- partial payment pattern,
- no response to reminders,
- multiple siblings with balances,
- high balance near report/exam dates,
- bounced/failed payments,
- broken payment plan.

Output:

- risk level,
- reason,
- recommended action,
- suggested message.

### 9.7 Leo Cash Close Assistant

For end-of-day close:

Leo should compare:

- cash recorded,
- cash expected,
- payments pending approval,
- missing receipts,
- unmatched bank lines,
- manual transaction entries,
- reversal/refund activity.

Output:

- close readiness,
- variance explanation,
- checklist,
- unresolved blockers.

Leo may draft the close note. User confirms closure.

### 9.8 Leo Report Commentary

Leo can draft commentary for exports and board/headteacher summaries.

Examples:

- collection performance summary,
- overdue trend explanation,
- class/grade comparison,
- reconciliation exception summary,
- cash close note.

The commentary must cite the metrics it is based on.

### 9.9 Leo Guardrails

Leo must never silently:

- approve a payment,
- reject a payment,
- send a reminder,
- reconcile a statement line,
- reverse or refund a transaction,
- create an expense,
- approve a disbursement,
- close a cash session,
- change payment setup,
- change fee structures.

Leo may:

- explain,
- draft,
- rank,
- suggest,
- prefill,
- summarize,
- prepare a report.

Every mutation must require an explicit human confirmation.

## 10. Data Requirements

The current APIs provide some data, but the command center will need aggregated operational endpoints.

### 10.1 Current Useful Data Sources

- `/api/admin/finance/overview`
- `/api/admin/finance/transactions`
- `/api/admin/fees/summary`
- `/api/admin/fees/payments/pending`
- `/api/admin/fees/reconciliation/*`
- `/api/admin/finance/budgets`
- `/api/admin/finance/disbursements`
- `/api/admin/fees/invoices`
- `/api/admin/fees/overdue-risk`
- `/api/admin/fees/reminders/history`

### 10.2 Recommended New Endpoint

Create:

```text
GET /api/admin/finance/command-center
```

Query params:

- `range`
- `dateFrom`
- `dateTo`
- `academicPeriodId`
- `gradeId`
- `classGroupId`

Response shape:

```ts
type FinanceCommandCenterDTO = {
  context: {
    schoolId: string;
    academicPeriodId: string | null;
    academicPeriodLabel: string | null;
    range: { start: string; end: string; label: string };
    currency: string;
    lastRefreshedAt: string;
  };
  kpis: {
    collectedMinor: number;
    outstandingFeesMinor: number;
    overdueFeesMinor: number;
    overdueStudentCount: number;
    pendingApprovalCount: number;
    pendingApprovalMinor: number;
    unreconciledCount: number;
    unreconciledMinor: number;
    netCashMovementMinor: number;
  };
  workQueue: FinanceWorkQueueItem[];
  trust: {
    status: "healthy" | "needs_review" | "critical";
    lastReconciliationAt: string | null;
    unmatchedCount: number;
    ambiguousCount: number;
    activeAlertCount: number;
    failedTransactionCount: number;
    makerCheckerPendingCount: number;
    paymentSetupStatus: string | null;
  };
  fees: {
    totalBilledMinor: number;
    totalCollectedMinor: number;
    totalOutstandingMinor: number;
    collectionRate: number;
    agingBuckets: Array<{
      key: string;
      label: string;
      amountMinor: number;
      studentCount: number;
    }>;
    gradeBreakdown: Array<{
      gradeId: string;
      gradeName: string;
      billedMinor: number;
      collectedMinor: number;
      outstandingMinor: number;
      collectionRate: number;
    }>;
    topOverdue: Array<{
      studentId: string;
      studentName: string;
      guardianName?: string | null;
      className?: string | null;
      amountMinor: number;
      daysOverdue: number;
      lastReminderAt?: string | null;
    }>;
  };
  payments: {
    byMethod: Array<{ method: string; amountMinor: number; count: number }>;
    pending: Array<FinancePaymentQueueItem>;
    failed: Array<FinancePaymentQueueItem>;
  };
  reconciliation: {
    latestSessionId: string | null;
    latestSessionLabel: string | null;
    matchedCount: number;
    unmatchedCount: number;
    ambiguousCount: number;
    ignoredCount: number;
    exactSuggestionsCount: number;
  };
  expenses: {
    pendingApprovalCount: number;
    pendingApprovalMinor: number;
    recent: Array<FinanceExpenseSummary>;
  };
  reports: Array<FinanceReportShortcut>;
};
```

### 10.3 Work Queue Item Shape

```ts
type FinanceWorkQueueItem = {
  id: string;
  type:
    | "payment_approval"
    | "failed_payment"
    | "unmatched_reconciliation"
    | "ambiguous_reconciliation"
    | "overdue_reminder"
    | "expense_approval"
    | "cash_close_variance"
    | "duplicate_risk"
    | "refund_review";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  count?: number;
  amountMinor?: number;
  href: string;
  leoEnabled: boolean;
  evidence?: Array<{ label: string; value: string }>;
};
```

## 11. Permissions And Controls

Finance access should be permission-sensitive.

Suggested permissions:

- `finance.view`
- `finance.reports.export`
- `finance.transactions.view`
- `finance.transactions.create_manual`
- `finance.transactions.approve`
- `finance.transactions.reconcile`
- `fees.view`
- `fees.invoice.create`
- `fees.payment.record`
- `fees.payment.approve`
- `fees.reminders.send`
- `expenses.view`
- `expenses.approve`
- `disbursements.view`
- `disbursements.approve`
- `finance.cash_close.manage`

Sensitive actions require dual control:

- approving manual payments above threshold,
- reversing payments,
- refunds,
- write-offs,
- discounts/waivers,
- disbursements,
- ledger corrections,
- locked-period changes.

The command center should hide unavailable actions or show disabled actions with clear reason.

## 12. UX Requirements

### Visual Style

Use a professional operational layout:

- compact header,
- restrained colors,
- clear status states,
- stable table/card dimensions,
- no excessive gradient-heavy dashboard cards,
- no oversized hero section,
- no nested cards.

Finance surfaces should feel calm and authoritative.

Recommended colors:

- Green for confirmed collections
- Amber for pending/review
- Red/rose for critical risk
- Blue/indigo for neutral control workflows
- Slate/neutral for structural surfaces

Avoid using many saturated gradients at once.

### Layout

Desktop:

- Header/actions
- KPI row
- Two-column layout:
  - left: work queue and operational panels
  - right: trust panel, Leo brief, reports

Mobile:

- Header
- Primary actions as compact menu
- KPI horizontal cards or stacked cards
- Work queue first
- Panels stacked

### Content Tone

Use finance-specific labels:

- `Collected`
- `Outstanding`
- `Overdue`
- `Pending approval`
- `Unreconciled`
- `Cash close`
- `Ledger`
- `Audit trail`

Avoid vague labels:

- `Total inflow`
- `Total outflow`
- `Pending`
- `Unified view of all money movements`

## 13. Empty States

Empty states should guide action.

Examples:

### No Invoices

```text
No invoices have been issued for this period.
Create fee structures or issue invoices before collection tracking can begin.
```

Actions:

- Create fee structure
- Issue invoices

### No Reconciliation Session

```text
No bank or gateway reconciliation has been run yet.
Upload a statement or start a session to verify payment records.
```

Actions:

- Start reconciliation
- Learn how reconciliation works

### No Payments Today

```text
No payments recorded today.
When payments are recorded or received online, they will appear here.
```

Actions:

- Record payment
- Open payment inbox

## 14. Implementation Plan

### Phase 1: Spec And Information Architecture

- Create this spec.
- Confirm route structure.
- Decide whether `/admin/finance/payments`, `/admin/finance/cash-close`, and `/admin/finance/reports` are new routes or redirects to existing pages.

### Phase 2: Command Center Data Contract

- Add `GET /api/admin/finance/command-center`.
- Aggregate:
  - finance overview,
  - fees summary,
  - pending payments,
  - reconciliation summary,
  - expenses pending approval,
  - trust/control status.
- Return work queue items.

### Phase 3: Command Center UI

- Replace current `/admin/finance` page layout.
- Remove decorative tabbed previews.
- Add:
  - KPI row,
  - Needs Attention queue,
  - Finance Trust panel,
  - Fees Collection panel,
  - Payments panel,
  - Reconciliation panel,
  - Expenses panel,
  - Reports panel.

### Phase 4: Leo Finance Brief

- Add Leo brief card using command center DTO.
- Add explanation actions for work queue items.
- Add draft reminder action for overdue fee accounts.

### Phase 5: Payment Inbox And Cash Close

- Add or improve payment inbox.
- Add cash-close workflow.
- Connect command center queue to these workflows.

### Phase 6: Reporting

- Add `/admin/finance/reports`.
- Support CSV/PDF exports.
- Add Leo report commentary drafts.

### Phase 7: Audit And Controls

- Ensure sensitive actions show:
  - maker,
  - checker,
  - timestamps,
  - evidence,
  - reason,
  - linked ledger entries.
- Add locked-period and policy guardrails.

## 15. Acceptance Criteria

The redesign is successful when:

1. A bursar can open `/admin/finance` and know the top three tasks for today within five seconds.
2. The page clearly separates collected cash, outstanding fees, overdue fees, pending approvals, and unreconciled evidence.
3. Reconciliation health is visible without opening another page.
4. Fees collection risk is visible by amount, age, student/family, and grade/class.
5. Every metric links to the workflow where the user can act.
6. Leo gives useful summaries and suggestions with evidence.
7. Leo never performs finance mutations without explicit user confirmation.
8. The page works on mobile without hiding the work queue.
9. Empty states explain what to do next.
10. Finance actions remain permission-aware and audit-friendly.

## 16. Non-goals

This redesign should not initially:

- replace the full fees module,
- replace the full reconciliation workspace,
- replace the ledger page,
- build a complete accounting general ledger,
- auto-send reminders without review,
- auto-approve payments,
- auto-reconcile bank lines,
- introduce payroll,
- introduce inventory procurement.

## 17. Risks

### Risk: Mixing Finance And Fees Too Much

The command center should summarize fees but keep detailed fee management in `/admin/fees`.

### Risk: Leo Overreach

Leo must be advisory and explainable. Finance actions require human confirmation.

### Risk: KPI Mistrust

Metrics must state whether they include pending, failed, reversed, refunded, or unreconciled records.

### Risk: Too Many Cards

The redesign should prioritize the work queue and trust indicators over decorative cards.

### Risk: Permission Confusion

Users should see why actions are unavailable, especially around approvals and reconciliation.

## 18. Suggested First Build Slice

Start with the smallest slice that materially improves the page:

1. Replace the current tabbed dashboard with a command center layout.
2. Keep using existing data hooks:
   - `useFinancialOverview`
   - `useFeeSummary`
   - reconciliation hooks
   - expenses hooks
3. Add a local computed `Needs Attention` queue from existing data.
4. Replace generic KPIs with school-finance KPIs.
5. Add clear workflow cards:
   - Fees
   - Payments
   - Reconciliation
   - Expenses
   - Ledger
   - Reports placeholder
6. Add a Leo Finance Brief placeholder using deterministic text first.

After that, add the dedicated command-center API and real Leo tools.

