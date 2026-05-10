# Finance Center Command Center Progress

This tracker records implementation progress for `FINANCE_CENTER_COMMAND_CENTER_REDESIGN_SPEC.md`.

## Current Status

The finance command center redesign is implemented at the practical v1 level described in the spec.

Estimated full-spec completion: **100%**.

## Done

- Created the redesign specification.
- Created this implementation progress tracker.
- Replaced the old tabbed `/admin/finance` dashboard with a Finance Command Center layout.
- Added school-finance KPIs for collected funds, outstanding fees, overdue accounts, pending approvals, unreconciled items, and net movement.
- Added a computed **Needs Attention** queue using existing finance, fee, expense, and reconciliation data.
- Added a deterministic **Leo Finance Brief** placeholder.
- Added Trust and Controls, Fees Collection, Ledger Activity, Expenses Snapshot, and workflow entry panels.
- Moved manual ledger entry and bursar invitation into secondary actions.
- Added `GET /api/admin/finance/command-center`.
- Added `useFinanceCommandCenter`.
- Migrated `/admin/finance` to prefer command-center DTO data for KPIs, the work queue, trust controls, fee risk, reconciliation status, and expense snapshots.
- Added `POST /api/admin/finance/leo-brief`.
- Added `useFinanceLeoBrief`.
- Wired the Leo Finance Brief card to the endpoint with deterministic fallback.
- Leo brief now returns summary text, risk level, risks, recommended actions, evidence, and mutation guardrails.
- Added `/admin/finance/reports`.
- Added finance report shortcuts for collections, debtors, invoices, ledger/cashbook, reconciliation, and disbursements.
- Connected the command center Reports workflow card to `/admin/finance/reports`.
- Added `/admin/finance/payments`.
- Reused the existing Payment Inbox control component and payment detail drawer in a finance-focused surface.
- Repointed the command center Payments workflow card to `/admin/finance/payments`.
- Repointed pending approval work-queue items from the command-center API to `/admin/finance/payments`.
- Added `/admin/finance/cash-close`.
- Cash close page supports date selection, expected cash, counted cash, variance calculation, required variance note, closure submission, and recent closures.
- Linked Cash Close from the command center workflow grid.
- Linked Cash Close from the Payment Inbox page.
- Added a finance-control guardrail panel to the command center.
- Added a Leo report-commentary staging panel to `/admin/finance/reports`.
- Added `POST /api/admin/finance/report-commentary`.
- Added `useFinanceReportCommentary`.
- `/admin/finance/reports` can now generate report commentary drafts from command-center evidence for collections, debtors, invoices, cashbook, reconciliation, and disbursements.
- Added `POST /api/admin/finance/leo-explain`.
- Added `useFinanceLeoExplainQueueItem`.
- Needs Attention queue items now support contextual Leo explanations with evidence, next action, workflow link, and no-mutation guardrail.
- Added explicit permission/control guardrails on the command center.

## In Progress

- None.

## Not Started

- None for practical v1. Future enhancements can deepen report exports, AI-assisted reconciliation suggestions, and finance-specific permission matrices.

## Verification Log

- Focused lint passed for `src/app/(app)/admin/finance/page.tsx`.
- Existing `baseline-browser-mapping` staleness warning remains.
- Focused lint passed for:
  - `src/app/api/admin/finance/command-center/route.ts`
  - `src/hooks/admin/useFinancialCenter.ts`
  - `src/app/(app)/admin/finance/page.tsx`
- Focused lint passed for:
  - `src/app/api/admin/finance/leo-brief/route.ts`
  - `src/hooks/admin/useFinancialCenter.ts`
  - `src/app/(app)/admin/finance/page.tsx`
- Focused lint passed for:
  - `src/app/(app)/admin/finance/reports/page.tsx`
  - `src/app/(app)/admin/finance/page.tsx`
- Focused lint passed for:
  - `src/app/(app)/admin/finance/payments/page.tsx`
  - `src/app/(app)/admin/finance/page.tsx`
  - `src/app/api/admin/finance/command-center/route.ts`
- Focused lint passed for:
  - `src/app/(app)/admin/finance/cash-close/page.tsx`
  - `src/app/(app)/admin/finance/page.tsx`
  - `src/app/(app)/admin/finance/payments/page.tsx`
- Focused lint passed for:
  - `src/app/(app)/admin/finance/page.tsx`
  - `src/app/(app)/admin/finance/reports/page.tsx`
- Focused lint passed for:
  - `src/app/api/admin/finance/report-commentary/route.ts`
  - `src/app/api/admin/finance/leo-explain/route.ts`
  - `src/hooks/admin/useFinancialCenter.ts`
  - `src/app/(app)/admin/finance/reports/page.tsx`
  - `src/app/(app)/admin/finance/page.tsx`
- `npm run build` passed. Existing warnings remain for stale `baseline-browser-mapping`, deprecated Next middleware convention, and pre-existing Mongoose duplicate-index/reserved-key warnings.
