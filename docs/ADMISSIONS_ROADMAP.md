# EduSentrix Admissions — Phased Roadmap

> Companion to `docs/ADMISSIONS_DEVELOPMENT_SPEC.md`.
> Each phase ships a usable slice; nothing in a phase blocks anything in the next.

Legend: ✅ Done · 🛠 In progress · ⬜ Not started

---

## Phase 1 — Foundation & control plane

The school admin can create a draft cycle, customise the form, and delegate to a teacher. Nothing public is exposed yet.

- 🛠 Mongoose models: `AdmissionCycle`, `AdmissionForm`, `Application`, `AdmissionEvent`, `AdmissionInviteLink`.
- 🛠 RBAC: new `admissions_officer` subrole + `gateAdmissionsManager` + `requireAdmissionsManager`.
- 🛠 Sidebar: new "Admissions" item in school admin sidebar (under People); new "Admissions" item in teacher sidebar gated by `admissionsManage` permission.
- 🛠 API:
  - Cycles CRUD (`GET`, `POST`, `PATCH`, publish/pause/close).
  - Form schema (`GET`, `PUT`, `reset`).
  - Delegation (`GET`, `POST`, `DELETE`).
- 🛠 UI: `/admin/admissions` and `/teacher/admissions` workspace shell with tabs (Overview, Cycles, Form builder, Delegation).
- 🛠 Default form schema seed (platform-required fields locked).
- ⬜ Lint + tsc on changed files.

**Exit criteria**: an admin can create a cycle, see the default form, mark optional fields as visible/hidden, save, and delegate the cycle to a teacher. The teacher sees the same Admissions workspace from their side.

---

## Phase 2 — Public application + tracker + distribution

The cycle becomes publishable; the public form goes live and applications start arriving.

- ⬜ Public route `/apply/[schoolId]/[slug]` with branded SSR shell + client `PublicApplicationForm`.
- ⬜ Public tracker `/track/admissions/[referenceCode]?token=…`.
- ⬜ Public APIs:
  - `GET /api/public/admissions/cycles/:schoolId/:slug`
  - `POST /api/public/admissions/cycles/:schoolId/:slug/applications`
  - `POST /api/public/admissions/uploads/:cycleId/sign`
  - `GET /api/public/admissions/applications/:referenceCode/track`
  - `GET /api/public/admissions/invite/:code`
- ⬜ Middleware allow-list updates for the new public routes.
- ⬜ Cycle publish flow with confirmation modal + URL preview.
- ⬜ Distribution tab: copy public URL, QR PNG/SVG download, WhatsApp share link, invite-link manager (D + E + F).
- ⬜ Application reference codes (`ADM-XXXXX`) with collision-safe generator.
- ⬜ Auto-confirmation email to applicant + branded acceptance email template editor.
- ⬜ Honeypot + IP rate-limit on submission endpoint.

**Exit criteria**: a parent can open the public link, complete the form, upload documents, submit, get a confirmation email, and view their tracker page. Admins see new submissions in the Applications tab.

---

## Phase 3 — Review, decision, and provisioning

Admins decide on each application. Acceptance creates the Student + Guardian.

- ✅ Applications inbox with filters (status, channel, grade, search) — _Phase 2._
- ✅ Application drawer: applicant + guardian summary, documents, notes, decision panel, withdraw + resend-tracker actions.
- ✅ APIs:
  - ✅ `PATCH /api/admin/admissions/applications/:id` (status / notes / fee status / reviewer) — _Phase 2._
  - ✅ `POST /api/admin/admissions/applications/:id/decision`
  - ✅ `POST /api/admin/admissions/applications/:id/provision`
  - ✅ `POST /api/admin/admissions/applications/:id/withdraw`
  - ✅ `POST /api/admin/admissions/applications/:id/resend-tracker-link`
  - ✅ `GET /api/admin/admissions/lookup` (grades + class groups w/ live occupancy)
- ✅ Provisioning service: idempotent Student + Guardian creation, Clerk parent invite, class group capacity + auto-pick (least-loaded active group).
- ✅ Acceptance / rejection / waitlist email senders, with cycle-customisable templates and `{{variable}}` interpolation.
- ✅ Applications Kanban view (drag between columns) — locked decision/withdrawn cards live in a "Locked applications" rail.
- ✅ Embeddable widget (`/embed/admissions.js`) — auto-resizing iframe + plain-iframe fallback in the Distribution tab.
- ✅ Audit tab feeding from `AdmissionEvent` — filterable timeline (`/api/admin/admissions/cycles/:id/events`).

**Exit criteria**: an admin clicks "Accept", picks a target grade (and optionally a class group), confirms, and the platform records the decision, optionally emails the family, then a one-click "Provision now" creates the Student + Guardian and sends a Clerk parent invite. Re-running provisioning is a no-op.

---

## Phase 4 — Leo integration & quality of life

- ✅ `LeoAdmissionsGuide` card in the Overview, Form builder, and Application drawer (heuristic guidance — no LLM round-trip).
- ✅ Public form "Need help?" widget — contextual FAQ accordion + school contact channels (admissions-only context).
- ✅ Form builder validations (`/lib/admissions/form-validations.ts`) — platform-required, duplicates, empty sections/options, document constraints. Surfaced inline in the Form builder.
- ✅ Cycle templates (`blank`, `standard_primary`, `standard_jhs`, `standard_shs`) — pickable in the Create Cycle modal, server-seeded via `/api/admin/admissions/templates` + `templateId` in `POST /cycles`.
- ✅ Bulk actions in the inbox: list-mode multi-select, change status, export CSV (selected and "all matching filters"). Decisions / withdrawn / provisioned rows are intentionally excluded.

**Exit criteria**: an admin can spin up a new cycle from a template in under a minute, immediately see Leo's guidance + form-validation warnings, drag applications across statuses on a Kanban, run bulk operations, embed the form on their school site, and audit every change after the fact.

---

## Phase 5 — Analytics, capacity intelligence & polish

- ✅ Funnel analytics: submitted → reviewed → decided → provisioned, by channel and grade. (`src/lib/admissions/analytics.ts`, `src/app/api/admin/admissions/cycles/[cycleId]/analytics/route.ts`, `AnalyticsTab`)
- ✅ Capacity dashboard: per-grade waitlist heatmap, projected enrolment. (capacity section in `AnalyticsTab`)
- ✅ Admin weekly digest email. (`src/lib/admissions/weekly-digest.ts`, `src/app/api/cron/admissions-weekly-digest/route.ts`, `ADMISSIONS_WEEKLY_DIGEST` template)
- ✅ Parent self-service portal (lightweight) showing application + tracker. (`/apply/lookup`, `PublicLookupView`, `POST /api/public/admissions/lookup`)
- ✅ Application fee collection via Paystack (online), with idempotent reconciliation. (`src/lib/admissions/fee-payments.ts`, public `pay/init` + `pay/verify` routes, webhook hooks for `admissions_fee`)
- ✅ Accessibility pass (WCAG AA on the public form), localisation seed. (`PublicFormField` ARIA wiring, skip-link & focus management in `PublicApplicationFlow`, `src/lib/admissions/i18n.ts`)
- ✅ Documented runbook + admin onboarding tour. (`docs/ADMISSIONS_RUNBOOK.md`, `AdmissionsOnboardingTour` mounted in `CycleWorkspace`)

---

## Cross-cutting (every phase)

- ⬜ Telemetry events (see spec §12) wired into `Activity` + product analytics.
- ⬜ Tests for service layer (provisioning idempotency, capacity warnings, role gates).
- ⬜ Update `LEO_COPILOT_DEVELOPMENT_SPEC.md` + roadmap to acknowledge admissions as a Leo surface.
