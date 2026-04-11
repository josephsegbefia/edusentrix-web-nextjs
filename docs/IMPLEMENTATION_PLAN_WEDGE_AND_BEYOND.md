# Implementation plan — wedge hardening → CRM-lite (backend → frontend)

**Principle:** Ship vertical slices. No big-bang refactors. Each phase has a **rollback story** (feature flag or isolated routes).

**Related:** `MARKET_POSITIONING_AND_ROADMAP_PILLARS.md`, `REAL_WORLD_UAT_GUIDE.html`

---

## Phase 0 — Baseline (done / ongoing)

- Keep regression UAT green after each merge.
- **Mobile (`jedi-app`)**: parity checklist tracked separately; web remains source of truth for money.

---

## Phase 1 — Wedge hardening (no new entities)

**Goal:** Fee truth, roles, Paystack clarity, SHS narrative in-product.

| Slice | Backend | Frontend | Risk |
|-------|---------|----------|------|
| **1a — SHS context hints** | None (`GET /api/school` already returns `type`) | `SchoolShsContextHint` on admin dashboard + parent ward Academics tab | Low |
| **1b — Fee / invoice audit visibility** | Extend or aggregate `InvoiceEvent` / existing audit APIs if gaps | Admin invoice detail + fees area: read-only timeline | Medium — read-only |
| **1c — Paystack environment** | Already `paystackKeyMode` on payment setup | Ensure banners on any school-facing Paystack CTA | Low |
| **1d — Role guard audit** | Grep `require*` guards; add tests for 403 paths | None if API-only | Low |

**Order:** 1a → 1c → 1b → 1d.

---

## Phase 2 — SHS narrative (product consistency)

**Goal:** One consistent story for terms, results, progression across admin / parent / student.

| Layer | Work |
|-------|------|
| **API** | Ensure ward academics + student results DTOs use same term labels and empty-state semantics. |
| **Admin** | Dashboard copy, reports entry points, period warnings aligned for SHS. |
| **Parent / student** | Tab copy, help links; optional “what this means for SHS” tooltips. |

**Depends on:** Phase 1a (context hints) + content review (no schema change required for v1).

---

## Phase 3 — International lighthouse profile

**Goal:** One curriculum (e.g. Cambridge) exemplary: exports + labels + calendar.

| Backend | Frontend |
|---------|----------|
| Report export endpoints (PDF/CSV) scoped by `curriculumCode` | Settings / reports: “Export” for that profile only |
| Optional: template mapping in `ReportTemplate` or similar | Branded, minimal templates |

**Risk:** Medium — gate behind `curriculumCode === 'cambridge'` (or chosen code) + feature flag.

---

## Phase 4 — CRM-lite (prospect → enrolled)

**Goal:** Structured pipeline without replacing platform applications wholesale.

| Step | Backend | Frontend |
|------|---------|----------|
| **4.1** | `Application` (or new `AdmissionPipeline`) fields: `stage`, `nextActionAt`, `ownerUserId` | Platform or school list: kanban or stage dropdown |
| **4.2** | POST convert application → create `Student` + link | Wizard: confirm class, fees, guardian |
| **4.3** | Activity log entries on stage change | Timeline on application detail |

**Start read-only:** stages + notes only; then mutations.

---

## Phase 5 — Student parity

**Goal:** Match promises (comms, clarity on work/results).

| Item | Notes |
|------|------|
| Student messaging (if product commits) | New routes + thread model reuse from teacher/parent — **not shipped** until product commits; student UI sets expectations in copy. |
| Results / assignments empty states | Copy + links only first — **done** (`StudentParityNavLinks`, dashboard blurb, assignments/notices/calendar/results empty and error paths). |

---

## Phase 6 — Thin verticals (optional, paid-pilot driven)

| Module | Backend sketch | Frontend |
|--------|------------------|----------|
| **Transport lite** | `TransportRoute`, `StudentTransportAssignment` (school-scoped) | Admin list + parent “bus info” read-only |
| **Library lite** | `LibraryItem` or reuse `TeacherResource` with tag | Simple shelf UI |
| **Cafeteria lite** | Fee line item category `meal` / prepaid SKU | Fees only |

**Rule:** No slice ships without a **named school** committed to UAT.

---

## What we are **not** doing in this plan

- Full payroll, multi-campus entity model, LTI, proctoring — see positioning doc.

---

## Completed slices (changelog)

- **2026-04-10:** Phase 5 (v2) — Student parity: shared `StudentParityNavLinks` (Assignments · Results · Calendar · Notices); dashboard copy distinguishes work vs grades vs notices and notes messaging not in-app; richer empty/error states on **Assignments**, **Notices**, **Calendar** (month + upcoming), **Results** (load errors, no terms, no subject grades). Copy + links only; **Phase 6 not started.**
- **2026-04-10:** Phase 4.2–4.3 — CRM-lite depth: `PATCH /api/platform/applications/[id]` accepts optional `pipeline` (`stage`, `nextActionAt`, `ownerUserId`) with `pipeline_updated` audit; `POST .../enroll-student` creates `Student` + `platformApplicationId` + `Application.enrolledStudentId` + `student_enrolled` audit; `GET .../enrollment-context` and `GET /api/platform/users/platform-admins` support the drawer; timeline shows audit `meta`. One enrollment per application; guardians/fees remain school-admin flows.
- **2026-04-10:** Phase 5 (v1) — Student Results: when there are no subject grades for the selected term, show a link to **Assignments** so learners have a clear next step (copy-only; no API change).
- **2026-04-10:** Phase 4.1 (v1) — CRM-lite pipeline on platform `Application`: schema fields `stage`, `nextActionAt`, `ownerUserId`; list + detail APIs expose `pipelineStage` / labels / owner; `pipelineStage` query filter with legacy inference from `status`; platform Applications UI: pipeline badge on cards, pipeline section in drawer, filter dropdown. Read-only (no PATCH for pipeline fields yet).
- **2026-04-09:** Phase 3 (v1) — Cambridge lighthouse CSV snapshot: gated by `FEATURE_CAMBRIDGE_LIGHTHOUSE_EXPORT=true` and `curriculumCode === "cambridge"`; `GET /api/admin/reports/curriculum-snapshot/export` returns read-only CSV (profile + academic periods); `lighthouseExportAvailable` on `GET /api/admin/curriculum`; admin Reports + Curriculum settings entry points. Does not change lesson notes, report generation, or other curricula.
- **2026-04-09:** Phase 1a — `SchoolShsContextHint` (admin dashboard + parent ward Academics).
- **2026-04-09:** Phase 1c — Parent Paystack test-mode: `paystackKeyMode` + `onlinePaymentsReady` on `GET /api/parent/fees` and `GET /api/parent/wards/[id]/fees/summary`; preview/success on `POST /api/parent/payments/checkout`; `ParentPaystackTestModeBanner` on parent Fees + ward Fees tab; test hint in checkout dialog.
- **2026-04-09:** Phase 1b — Invoice audit timeline already wired (`InvoiceEvent` + `InvoiceEventTimeline` on admin invoice detail); no schema change.
- **2026-04-09:** Phase 1d — Pure `role-gates` helpers (`gatePlatformAdminUser`, `gateParentApiAccess`, `gateFinanceStaffRoles`, `gateSchoolAdminRoles`, `gateTeacherApiAccess`) wired into matching `require*` modules; `tests/role-gates.test.ts` locks status codes and messages.
- **2026-04-09:** Phase 2 (v1) — `schoolLevel` on `StudentAcademicsDTO` from `buildStudentAcademicsDTO` (single source for parent / admin / student); SHS-aware empty copy on parent + admin student academics + student results; `PeriodWarningBanner` SHS subtitle when no period; `SchoolLevelForAcademics` type exported.
- **2026-04-09:** Phase 2 (v2) — Shared `termSelectorTooltip` + `TermSelectorHelpButton`; parent + admin `TermSelector` and student Results term control show WAEC/SHS-aware help; student results empty/error/no-periods states tightened.
