# Financial Center Reboot Spec

## Overview

The Financial Center (`/admin/finance`) is the command center for all school financial operations. It must provide a unified view of cash flow, fees, expenses, transactions, and **reconciliation**—with clear navigation and cross-linking between related areas.

---

## 1. Reconciliation Integration (Critical)

Reconciliation is **already implemented** at `/admin/finance/reconciliation`. This spec ensures it is fully integrated into the Financial Center.

### 1.1 Reconciliation Console (Existing)

- **Route**: `/admin/finance/reconciliation`
- **Features**:
  - Ingestion queue (import bank/gateway data)
  - Match/unmatch payments to ingestions
  - Alerts (critical, warning)
  - Run history
  - Export CSV
  - Help drawer

### 1.2 Integration Requirements

| Requirement | Description |
|-------------|-------------|
| **Finance Overview** | Show reconciliation summary on the main Finance page: unmatched count, needs-review count, link to full console |
| **Quick Link** | Prominent "Reconciliation" card/link in Finance overview quick actions |
| **Transactions** | Transactions list already has reconciliation status filter; ensure it links to reconciliation console for unmatched items |
| **Cross-links** | Reconciliation page links to Fees, Transactions, Financial Center (already present) |
| **Sidebar** | Both admin and bursar sidebars already include Reconciliation; ensure consistent labeling |

### 1.3 Reconciliation Summary for Overview

The Finance overview should display:

- **Unmatched** – Count of ingestion items awaiting match (link to reconciliation queue filtered by unmatched)
- **Needs Review** – Count of ambiguous matches (link to reconciliation queue filtered by ambiguous)
- **Active Alerts** – Count of reconciliation alerts (link to reconciliation alerts tab)
- **Last Run** – Timestamp of most recent reconciliation run

---

## 2. Financial Center Structure

### 2.1 Tabbed Layout

The main Finance page (`/admin/finance`) uses a **tabbed layout**:

| Tab | Purpose | Content |
|-----|---------|---------|
| **Overview** | Executive dashboard | KPIs, reconciliation summary, fee snapshot, alerts, quick actions |
| **Transactions** | Ledger view | Recent transactions with link to full list |
| **Fees** | Fee snapshot | Outstanding, collection rate, defaulters, link to Fees page |
| **Expenses** | Expense snapshot | Pending approvals, recent expenses, link to Expenses page |

### 2.2 Overview Tab (Default)

**Header**
- Title: "Financial Center"
- Subtitle: "Unified view of money movements"
- Date range selector (Today, This Week, This Month, Last 30 Days)
- Actions: Refresh, Invite Bursar, Record Transaction

**KPI Row (4 cards)**
1. Total Inflow
2. Total Outflow
3. Net Position
4. Pending (count + amount)

**Reconciliation Summary Card** (NEW)
- Title: "Reconciliation"
- Unmatched count (red if > 0)
- Needs Review count (amber if > 0)
- Active Alerts count
- Last run timestamp
- CTA: "Open Reconciliation" → `/admin/finance/reconciliation`

**Alerts**
- Failed transactions banner (existing)
- Critical reconciliation alerts (link to reconciliation)

**Main Grid**
- Left: Income by category, Spending by category (existing)
- Right: Recent transactions (existing)

**Quick Actions (4 cards)**
1. **All Transactions** → `/admin/finance/transactions`
2. **Fees & Payments** → `/admin/fees`
3. **Expenses** → `/admin/expenses`
4. **Reconciliation** → `/admin/finance/reconciliation` (NEW – replace or add)

### 2.3 Transactions Tab

- Embedded or linked view of recent transactions
- Filter by reconciliation status (unmatched, matched, etc.)
- Link to full transactions page

### 2.4 Fees Tab

- Fee summary from `useFeeSummary`: total outstanding, collection rate, overdue count
- Top defaulters (5)
- Upcoming due (5)
- Link to Fees page

### 2.5 Expenses Tab

- Pending approvals count
- Recent expenses (5)
- Link to Expenses page

---

## 3. Cross-Linking Matrix

| From | To | Link Text / Location |
|------|-----|----------------------|
| Finance Overview | Reconciliation | "Reconciliation" quick action card, Reconciliation summary card |
| Finance Overview | Transactions | "All Transactions" quick action |
| Finance Overview | Fees | "Fees & Payments" quick action |
| Finance Overview | Expenses | "Expenses" quick action |
| Reconciliation | Finance | "Financial Center" quick link (existing) |
| Reconciliation | Fees | "Fees & Payments" quick link (existing) |
| Reconciliation | Transactions | (Add) "Transactions Ledger" quick link |
| Transactions | Reconciliation | Filter by reconciliation status; badge linking to reconciliation for unmatched |
| Fees | Finance | (Add if missing) "Financial Center" link |
| Expenses | Finance | (Add if missing) "Financial Center" link |

---

## 4. API Requirements

### 4.1 Finance Overview

- **Existing**: `GET /api/admin/finance/overview` – KPIs, breakdowns, recent transactions
- **Enhancement**: Include reconciliation summary in response, OR
- **Alternative**: Finance page fetches reconciliation data via existing hooks:
  - `useReconciliationIngestions({ status: 'all', limit: 1 })` → summary
  - `useReconciliationAlerts()` → active alerts
  - `useReconciliationRuns(1)` → last run

### 4.2 Reconciliation

- **Existing**: All reconciliation APIs are in place
- No new APIs required; use existing hooks on Finance overview

---

## 5. Sidebar Consistency

### Admin Sidebar (Operations)
- Financial Center → `/admin/finance`
- Reconciliation Queue → `/admin/finance/reconciliation`
- Fees & Payments → `/admin/fees`
- Expenses → `/admin/expenses`

### Bursar Sidebar
- Finance Dashboard / Financial Center → `/admin/finance`
- Reconciliation → Queue → `/admin/finance/reconciliation`
- Transactions Ledger → `/admin/finance/transactions`

---

## 6. Implementation Tasks

1. **Create spec** – This document
2. **Add Reconciliation Summary to Finance Overview** – New card showing unmatched, needs review, alerts, last run; link to reconciliation
3. **Add Reconciliation to Quick Actions** – Fourth card linking to `/admin/finance/reconciliation`
4. **Add tabbed layout** – Overview (default), Transactions, Fees, Expenses
5. **Fees tab** – Use `useFeeSummary`, show defaulters, upcoming due
6. **Expenses tab** – Use `useExpenses`, show pending approvals, recent
7. **Transactions tab** – Reuse recent transactions from overview or link to full page
8. **Reconciliation page** – Add "Transactions Ledger" quick link if missing
9. **Verify all cross-links** – Audit Finance, Fees, Expenses, Reconciliation, Transactions for bidirectional links

---

## 7. Out of Scope (Future)

- Budgets integration on overview
- Cash closure summary
- Bank accounts management
- Multi-currency
