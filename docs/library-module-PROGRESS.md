# Library module — build progress

Living tracker for **implementation vs** `edusentrix-library-module-v1-v2-technical-spec.md` (sub-versions **V1.0–V1.3**).

## How we stay on track

| Mechanism | Purpose |
|-----------|---------|
| **This file** | Human-readable checklist; update after each merge. |
| **§34 in main spec** | Source-of-truth phase order; do not reorder without discussion. |
| **Code comments `# library V1.x`** | Optional grep anchors on large files. |

**Rule:** Finish **V1.0** before V1.1, etc. (see spec §36).

---

## V1.0 — Catalogue & inventory

### V1.0-A — Backend foundation

| Item | Status |
|------|--------|
| `LibraryBook` model | Done (initial) |
| `LibraryBookCopy` model | Done (initial) |
| `LibrarySettings` model | Done (initial) |
| Zod validators (`src/lib/library/library.validators.ts`, serializers) | Done (initial) |
| Default settings constants | Done |
| `library-book.service.ts` — CRUD + list + archive + initial copies | Done (initial) |
| `library-copy.service.ts` — create/list/update + counter sync | Done (initial) |
| `library-settings.service.ts` — getOrCreate, patch | Done (initial) |
| Counter sync from copies (`syncBookCountersFromCopies`) | Done |
| `GET/POST /api/admin/library/books` | Done (initial) |
| `GET/PATCH /api/admin/library/books/[bookId]` | Done (initial) |
| `GET/POST /api/admin/library/books/[bookId]/copies` | Done (initial) |
| `GET/PATCH /api/admin/library/copies/[copyId]` | Done (initial) |
| `GET/PATCH /api/admin/library/settings` | Done (initial) |
| Auth | Done — school admin **or** active `library` delegation (`requireSchoolAdminOrDelegated*`) |
| Audit (`AuditEvent` / policy) | Done (initial) — Tier 1 codes + `library-audit.ts` + route hooks |
| Pagination/search polish (text index, sort) | Done — `$text` catalogue search; `sortBy` / `sortOrder`; expanded text index |
| Unit tests (services) | Done (initial) — `tests/library.services.integration.test.ts` (replica set) |
| Prod index sync | Done — `npm run library:sync-indexes` (`scripts/sync-library-indexes.ts`) |

### V1.0-B — Admin UI

| Item | Status |
|------|--------|
| `/admin/library` dashboard | Done — dashboard API + circulation snapshot |
| Books list / new / detail / edit | Done (initial; list supports sort) |
| Copies UI | Done (initial — book detail) |
| Settings UI | Done (initial) |
| UploadThing covers | Done — `libraryBookCover` route + cover upload on new/detail |
| TanStack Query hooks | Done — `useLibraryAdmin.ts` |
| Delegations (`library` module, API gates, cover upload) | Done — registry presets + route auth + `library-upload-gate` |
| Capability flags (`GET /api/admin/library/capabilities`) + UI gates | Done |

---

## V1.1 — Circulation (initial)

### V1.1-A — Backend

| Item | Status |
|------|--------|
| `LibraryLoan` model + indexes (incl. partial unique open loan per copy) | Done |
| Validators: issue / return / renew / list loans / borrower search | Done |
| `library-loan.service.ts` — issue, return, renew, list hydration | Done |
| `library-borrower.service.ts` — borrower search + `assertBorrowerInSchool` | Done |
| `library-dashboard.service.ts` — stats + recent / due / overdue / popular / low stock | Done |
| `GET /api/admin/library/capabilities` | Done |
| `GET /api/admin/library/dashboard` | Done |
| `GET /api/admin/library/borrowers/search` | Done |
| `GET/POST /api/admin/library/loans` | Done |
| `GET /api/admin/library/loans/[loanId]` | Done |
| `POST /api/admin/library/loans/[loanId]/return` | Done |
| `POST /api/admin/library/loans/[loanId]/renew` | Done |
| Audit + policy: `library.loan.issued`, `library.loan.returned`, `library.loan.renewed` | Done |
| `LibraryLoan` in `library:sync-indexes` | Done |
| Tests (issue/return/renew + validators) | Done |

### V1.1-B — Admin UI & delegation

| Item | Status |
|------|--------|
| `useLibraryCapabilitiesQuery`, dashboard + loans hooks | Done |
| Permission-aware: books list/new/detail, settings, cover read-only | Done |
| `/admin/library/circulation` — issue, open loans, return/renew | Done (initial) |
| Dashboard — aggregates + recent loans + overdue strip | Done |
| Sidebar — Circulation | Done |
| Registry — viewer `library.loans.read`; librarian loan permissions | Done |

### Deferred / follow-ups

| Item | Notes |
|------|-------|
| Fee module wiring (`createFeeCharge`, `linkedFeeId`) | **Done (students)** — `library-fee-persistence.ts` appends a **Library charge** line item on the student’s current-period `Invoice` (creates draft invoice if needed); `linkedFeeId` = line item id. Teachers/staff still use dev **stub** only when `createFeeCharge` is true. |
| Background job to set loan `status: overdue` | **Done (V1.2)** — `markOpenLoansOverdueForSchool` on list + dashboard load; optional cron still possible |
| Spec path `/api/library/*` vs implemented `/api/admin/library/*` | Documented in code; admin app uses latter |

---

## V1.2 — Exceptions & fees

### V1.2-A — Backend & jobs

| Item | Status |
|------|--------|
| `markOpenLoansOverdueForSchool` (`library-jobs.ts`) | Done — `active` + past `dueAt` → `overdue` |
| Call job from `listLibraryLoans` + `getLibraryDashboardData` | Done |
| `computeAutoFineOnReturn` + student invoice persistence (`library-fines.ts`, `library-fee-persistence.ts`); stub for non-students (`library-fee-hook.ts`) | Done |
| `returnLibraryLoan` — auto fine, student fee line item + `linkedFeeId` when `createFeeCharge` | Done |
| `renewLibraryLoan` — sets `status: active` after extension | Done |
| `effectiveLibraryLoanStatus` — open + past due → overdue (DTO) | Done |
| `waiveLibraryLoanFine` + `POST .../waive-fine` + `library.loan.fine_waived` audit/policy | Done |
| `POST .../mark-lost` / `.../mark-damaged` (delegated perms) | Done |
| Return route — lost/damaged needs `LOANS_RETURN` **or** `mark_*` (any-of) | Done |
| List bucket `fines_pending` + `sortBy: returnedAt` | Done |
| Registry / capabilities — `fines.read`, `fines.waive`, `mark_lost`, `mark_damaged` | Done |

### V1.2-B — Admin UI

| Item | Status |
|------|--------|
| `/admin/library/overdue` — overdue list + pending fines + waive | Done |
| Overdue — **Send in-app reminders** (`POST .../overdue/send-reminders`) | Done (V1.3) |
| Circulation — mark lost/damaged when user lacks `LOANS_RETURN` but has mark perms | Done |
| Sidebar + dashboard quick link | Done |
| Hooks — `waiveFine`, `markLoanLost`, `markLoanDamaged` | Done |

### V1.2-C — Tests

| Item | Status |
|------|--------|
| Integration — overdue job, auto fine, waive, `fines_pending` bucket, renew clears overdue | Done |

### Deferred / follow-ups (V1.2)

| Item | Notes |
|------|-------|
| Fee module persistence (`linkedFeeId`, real charges) | **Out of scope** for library track until school finance/invoicing APIs own `linkedFeeId` creation — continue using `stubLibraryFeeChargeIntent` |
| Cron / scheduled overdue job | **Done** — `GET/POST /api/cron/library-loans-overdue` (same auth as reservation cron); see **Library operations** below |

---

## V1.3 — History, reports, imports

### V1.3-A — Backend

| Item | Status |
|------|--------|
| `LibraryImportJob` model + indexes | Done |
| `library-import.service.ts` — CSV parse, row cap, job status, `books` / `copies` / `books_and_copies` | Done |
| `library-report.service.ts` — `overdue`, `most_borrowed`, `inventory_value`, `active_readers`, `lost_damaged`, `category_usage`, `class_activity` | Done |
| `listBorrowerLoanHistory` (paginated, school-scoped) | Done |
| `enqueueLibraryOverdueReminderNotifications` — `Notification` + **queued email** (`LIBRARY_LOAN_OVERDUE_REMINDER`); patron **actionUrl** student/teacher → `/student|/teacher/library` | Done |
| Dashboard — `totalLoansAllTime`, `pendingFinesTotal` | Done |
| `GET /api/admin/library/reports` | Done — `library.reports.view` |
| `POST /api/admin/library/imports` | Done — `library.books.create` — **202 Accepted**, worker via `after()`; client polls `GET .../imports/[jobId]` |
| `GET /api/admin/library/imports/[jobId]` | Done — `library.books.create` **or** `library.books.read` |
| `GET /api/admin/library/borrowers/[type]/[id]/loans` | Done — `library.loans.read` |
| `POST /api/admin/library/overdue/send-reminders` | Done — `library.loans.read` |
| Validators — report query, import body, send-reminders, borrower history | Done |
| Audit `library.import.completed` + policy | Done |
| `library:sync-indexes` — `LibraryImportJob` | Done |

### V1.3-B — Admin UI & delegation

| Item | Status |
|------|--------|
| `/admin/library/reports` | Done |
| `/admin/library/imports` | Done |
| `/admin/library/history` — borrowing history lookup | Done |
| Dashboard — extra metrics + quick links (cap-gated) | Done |
| Sidebar — Reports, CSV import, Borrowing history | Done |
| Capabilities — `reportsView` | Done |
| Registry — `library.reports.view` on viewer + librarian presets | Done |
| Hooks — `useLibraryReportQuery`, `useLibraryImportMutation`, `useLibraryImportJobQuery`, `useBorrowerHistoryQuery`, `useLibrarySendOverdueRemindersMutation` | Done |

### V1.3-C — Tests

| Item | Status |
|------|--------|
| Integration — import partial failure, report school isolation, borrower history | Done |

### Deferred / follow-ups (V1.3)

| Item | Notes |
|------|-------|
| Async import worker + polling UI | **Done** — enqueue + `after()` worker; imports page polls until terminal |
| Report export (CSV/PDF) | Not in V1.3 scope |
| Per-report read audit events | Optional; import completion is audited |

---

## V2

### V2.1 — Patron visibility (web)

| Item | Status |
|------|--------|
| `LibraryNotice` model + `library:sync-indexes` | Done |
| `library-notice.service` — admin list/create/update, patron list with audience rules | Done |
| Validators — create/update/list admin notices | Done |
| `GET/POST /api/admin/library/notices`, `GET/PATCH .../notices/[noticeId]` — `library.notices.manage` | Done |
| Capabilities `noticesManage` + librarian preset | Done |
| Student — `GET .../books`, `GET .../books/[id]`, `GET .../notices`, `GET .../my-loans` | Done |
| Teacher — same under `/api/teacher/library/*` | Done |
| Parent — `GET .../books`, `GET .../books/[id]`, `GET .../notices`, `GET .../summary` (wards + open loans) | Done |
| UI — `/admin/library/notices`, `/student/library`, `/teacher/library`, `/parent/library` (+ detail routes) | Done |
| Sidebars — Library links (admin submenu, student, teacher, parent) | Done |

### V2.2 — Reservations (initial)

| Item | Status |
|------|--------|
| `LibraryReservation` model + partial unique active hold per patron/title + indexes | Done |
| `library-reservation-promotion.ts` — promote next pending when copy becomes `available` | Done |
| `library-reservation.service.ts` — list, create, cancel, fulfill (loan from reserved copy), patron cancel | Done |
| `issueLibraryLoanFromReservedCopy` + `defaultLoanDueAtForBorrower`; return hook promotes queue | Done |
| Validators — list/create/patron create | Done |
| `GET/POST /api/admin/library/reservations`; `POST .../[id]/cancel`, `POST .../[id]/fulfill` (needs `reservations.manage` + `loans.issue`) | Done |
| Patron — `GET/POST /api/student/library/reservations`, `POST .../cancel`; teacher parity | Done |
| Audit — `library.reservation.created` / `cancelled` / `fulfilled` + policy | Done |
| `requireSchoolAdminOrDelegatedAllPermissions` for fulfill | Done |
| `library:sync-indexes` — `LibraryReservation` | Done |
| Admin UI `/admin/library/reservations` + sidebar + dashboard link | Done |
| Student/teacher UI — “My holds”, reserve/cancel on book detail | Done |
| Holds: `expiresAt` on create/promote; auto-expire pending (30d) / ready (7d) + queue cleanup + promotion | Done |
| Ready notifications — in-app **`Notification`** + **queued email** (`LIBRARY_HOLD_READY`, Brevo) for patron & parent | Done |
| Parent — `GET/POST /api/parent/library/reservations`, `POST .../[id]/cancel`; book detail + dashboard holds | Done |
| Admin borrower search on reservations page + `borrowers/search` allows `reservations.manage` | Done |
| Cron `GET/POST /api/cron/library-reservation-expiry` — `LIBRARY_CRON_SECRET` or `CRON_SECRET` | Done |
| Cron `GET/POST /api/cron/library-loans-overdue` — same auth; global `active`→`overdue` transition | Done |
| Cron `GET/POST /api/cron/library-loans-due-soon` — same auth; `notifyBeforeDueDate` + `dueReminderDaysBefore`; `LIBRARY_LOAN_DUE_SOON` email + in-app; `lastDueSoonReminderAt` on `LibraryLoan` | Done |
| Audit `library.reservation.expired` (job actor) when a hold auto-expires | Done |
| Script `npm run library:backfill-reservation-expires` — sets missing `expiresAt` on active holds | Done |
| Parent in-app notification when a student’s hold is ready (linked guardians) | Done |

### Library — operations (cron & one-off scripts)

| Item | Detail |
|------|--------|
| **Reservation expiry** | `GET` or `POST` `/api/cron/library-reservation-expiry`. Auth: `Authorization: Bearer <secret>` or header `x-cron-secret: <secret>` where secret is `LIBRARY_CRON_SECRET` or, if unset, `CRON_SECRET`. Recommended: **daily** (off-peak). |
| **Loans → overdue** | `GET` or `POST` `/api/cron/library-loans-overdue` — same secrets. Marks **all schools**’ open `active` loans with `dueAt < now` as `overdue`. Recommended: **daily** (before reports/alerts). Per-school on-read still runs via `markOpenLoansOverdueForSchool` where needed. |
| **Loans — due soon** | `GET` or `POST` `/api/cron/library-loans-due-soon` — same secrets. For each school with pre-due reminders enabled, notifies patrons for open `active` loans whose `dueAt` falls within `dueReminderDaysBefore` (debounced via `lastDueSoonReminderAt`). Recommended: **daily**. |
| **Backfill hold `expiresAt`** | `npm run library:backfill-reservation-expires` — optional `--dryRun`. Run once per environment if older rows lack `expiresAt` (logic still expires via legacy cutoffs until backfilled). |

Configure your host (e.g. Vercel Cron, GitHub Actions, or `curl` from systemd) to hit these URLs with the shared secret. Do not log the bearer token.

### V2.2+ (spec §5 remainder — **product backlog**)

Baseline **V2.2** (web admin + patron + reservations + crons + email) is complete. Below is further **web** engagement; native apps, offline circulation, and dedicated handheld SDK remain backlog.

| Item | Status |
|------|--------|
| QR/barcode **values** for copies, lookup by copyCode / barcode / QR payload, labels (QR image) on book detail | **Shipped** — `POST /api/admin/library/copies/[copyId]/generate-code`, `GET /api/admin/library/copies/lookup?code=`, `/admin/library/scan`, circulation lookup field; run `npm run library:sync-indexes` after deploy for `{ schoolId, qrCode }` sparse index |
| Keyboard-wedge / manual “scan” workflow | **Shipped** (admin scan page + circulation) |
| **Camera** QR / barcode (browser `BarcodeDetector` where supported) | **Shipped** on `/admin/library/scan` |
| Patron **digital shelf** (loans + holds in one card) + mobile-friendly grids | **Shipped** — student, teacher, **parent** library home |
| **Leo picks** (rule-based recommendations) | **Shipped** — patron APIs + Leo tool `library_recommend_books` (grade phrase or grade id in message; `recommendLibraryBooksForGrade`) |
| **Loan issued** | **Shipped** — after issue and after fulfill-hold, in-app + email `LIBRARY_LOAN_ISSUED` (patron; parents when student borrower) |
| Native mobile app, offline circulation, dedicated handheld SDK | **Backlog** |
