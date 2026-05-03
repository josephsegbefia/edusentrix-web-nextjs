# Internal Test School Mode — Phased Delivery Plan

**Source spec:** `docs/edusentrix-internal-test-school-mode-final-implementation-spec.md`  
**Purpose:** Ship **complete, usable slices**—each phase is deployable, testable, and avoids half-built UI. No specification gaps: every requirement maps to a phase (see § Coverage matrix).

**UI principle (all phases):** One primary task per screen section; **linear flows** for dangerous actions (warning → phrase → confirm → result); **grouped settings** (not long undifferentiated switch lists); **tabs only where scopes differ** (e.g. Settings vs Seed vs Reset vs Impersonate)—never duplicate the same control in two places.

---

## Prerequisites (before Phase 1 merge)

These are not a customer-facing “phase” but block safe shipping:

| Item | Spec refs |
|------|-----------|
| Decide **Clerk step-up** vs **`INTERNAL_TEST_ACTIVATION_SECRET`** per environment (§4.4–4.5); document in `.env.example` | §4 |
| Confirm **`ENABLE_INTERNAL_TEST_TOOLS`** policy per env (prod off unless needed) | §4.3 |
| **`platform.internalTest.manage`** added to RBAC and assigned only to intended platform operators | §4.2, §22 Chunk 1 |

---

## Phase 1 — Security foundation + test mode lifecycle + config UI

**Shippable outcome:** A platform admin with permission can **enable/disable internal test mode** for a school, **edit all safety toggles**, see **status**, and actions are **audit-logged**. No seeding, no impersonation yet.

### Build

| Area | Deliverables |
|------|----------------|
| Permission & guards | `platform.internalTest.manage`; env gate `ENABLE_INTERNAL_TEST_TOOLS`; shared guard for all `/api/platform/schools/[schoolId]/internal-test/*` | §4.1–4.3, §22 Chunk 1 |
| Step-up / secret | Clerk step-up **or** constant-time compare of `INTERNAL_TEST_ACTIVATION_SECRET` on activate/disable + any future sensitive routes | §4.4–4.5 |
| Phrases | Validate exactly: `ENABLE TEST SCHOOL`, `DISABLE TEST SCHOOL` (reset phrase deferred to Phase 3) | §4.6, §9 |
| School model | `environmentType`, `isInternalTestSchool`, `internalTest` block per §5 | §5 |
| Config model | `InternalTestSchoolConfig` + defaults on activation | §6 |
| APIs | `POST .../activate`, `POST .../disable`, `GET/PATCH .../config` | §9.1–9.4 |
| Audit | `internal_test.enabled`, `internal_test.disabled`, `internal_test.config_updated` | §20 |
| UI — entry | From **`/platform/schools/[schoolId]`**, single prominent link: **“Internal test controls”** (only if admin + permission + env flag) | §8.1 |
| UI — page | **`/platform/schools/[schoolId]/internal-test`** with: **(A)** Status panel (enabled, who, when, environment type); **(B)** If disabled: one **Enable test school** flow (modal: warning → phrase → step-up/secret per env → submit); **(C)** If enabled: **Safety controls** in **four grouped cards**: *Email & accounts* \| *Outbound notifications* \| *Payments* \| *Visibility & tools* (maps to config fields §6) — **not** one flat list of 15 switches | §8.2–8.3, §19 UI |
| Badge (partial) | **“Internal test school”** on platform school detail + this page header when enabled + `showInternalTestBadge` | §8.2, §23 UI |

### Explicitly NOT in Phase 1

- Generation jobs, reset, impersonation, seed UI, school-facing layouts badge (reduces confusion until behavior exists).

### Phase 1 exit criteria (must pass)

- §23 **Security** (access + env + permission + phrase + step-up/secret for activate/disable).
- §23 **Test school activation** + **Manual testing support** partially: config toggles persisted; **invitation bypass not required until Phase 2** (but document that users invited during P1 may still hit real email until P2—prefer enabling internal test only on low-risk schools until P2 lands).

### Spec coverage this phase

§2 (principles, centralized bypass *designed* but integration next), §4, §5, §6 (config), §8.1–8.3 (sections 1–2 + structure for 3–7 as placeholders **optional**: use **“Coming in later phases”** one-line callouts only—**no** fake buttons that 404).

**Recommended placeholder copy (if used):** Single grey **Info** card: “Data seeding, reset, and impersonation are enabled in later releases.” Avoid dummy CTAs.

---

## Phase 2 — Centralized side-effect suppression (invitations, notifications, payments)

**Shippable outcome:** For **internal test schools**, configured suppressions and sandbox payments **actually affect production code paths**; **real schools unchanged**.

### Build

| Area | Deliverables |
|------|----------------|
| Helpers | `shouldBypassInvitation`, `shouldSuppressNotification`, `shouldUseSandboxPayments` (single modules; **no** scattered `if (school.isInternalTestSchool)` in routes) | §2.4, §17, §21 |
| Invitation service | Central check + auto-activate / suppress metadata per §7.4; fake email pattern for **manual** creation as needed | §7, §12 (email patterns) |
| Notification channels | email, sms, whatsapp, push, in_app per §17.2; optional `isTestNotification` / `wasSuppressed` metadata where models allow | §17.2, spec notification fields |
| Payments | Sandbox / no real collection; generated refs later in P3; **infrastructure** here for create/update payment flows | §17.3 |
| Audit | `invitation_suppressed`, `payment_sandbox_used` where applicable | §20 |
| UI | On internal-test page, **one read-only “Effective delivery” strip**: e.g. “Invitations: suppressed”, “SMS/WhatsApp: suppressed”, tied to config—updates when PATCH config | §8.3 §2 |

### Phase 2 exit criteria

- §23 **Manual testing support** fully: manual UI user creation in test school **does not** send real invites when configured; real schools still invite normally.
- §23 **Side effects** for invitations + notifications + payments **for test schools**.

### Spec coverage

§7, §17, §2.4, §12 (patterns), §21 lib layout for helpers.

---

## Phase 3 — Generation jobs + academic periods + Core V1 seed + reset (single cohesive module)

**Shippable outcome:** Platform admin can define **1–2 periods**, start **`core_v1`** generation, watch **step progress**, **reset by batch** without deleting manual data. **Mandatory reset** ships together with generation per §2.5 and §19.

### Build

| Area | Deliverables |
|------|----------------|
| Models | `InternalTestDataGenerationJob`, `testDataBatchId`, steps array; optional `InternalTestGeneratedRecord` registry **or** metadata on documents per §11 | §10–11 |
| Metadata | `generatedByTestMode`, `testDataBatchId`, `testGenerationJobId` (and `testDataKind` where useful) on created docs **or** registry entries | §11 |
| APIs | `POST/GET .../generation-jobs`, `GET .../generation-jobs/[jobId]`, `POST .../reset` with phrase **`RESET TEST DATA`** | §9.5–9.8 |
| Validation | Periods 1–2, no overlap, one current, date sanity, **`core_v1` \| `extended_v2`** (V2 steps stubbed or no-op skipped until Phase 5) | §12, §9.5 |
| Generators | **§14 Core V1** list + **§15 order** + **§13** fixed grades/subjects/class naming (one class per grade); use **§16** contracts + existing services where possible | §13–16 |
| Reset | **§19.3 reverse order**; only records for `testDataBatchId` + school | §19 |
| Audit | generation started/completed/failed; reset started/completed/failed | §20 |
| UI — **Seed & reset** (avoid confusion) | **Dedicated tab “Seed data”** on internal-test page containing **only**: (1) Academic periods form (custom date picker, §8.4), (2) Counts / presets (Small/Medium/Large optional), (3) **Preview** summary bullet list (mirror §14 scope), (4) **Run generation** — **single** destructive confirm modal (summary + “Type the school name” or product-chosen guardrail); **API matches §9.5** (no `GENERATE TEST DATA` in final spec body—do not invent a second phrase users must learn unless you add it to the spec and API together), (5) **Job list + detail/progress** (step rows with status), (6) **Reset** sub-flow: select batch → show counts → typed phrase **`RESET TEST DATA`** per §9.8 → run. **Do not** mix impersonation here (Phase 4). | §8.3 (4–5), §9, §19 |

**Phrase alignment:** **Reset** always uses **`RESET TEST DATA`** (§4.6, §9.8). **Start generation** uses §9.5 payload only; use a **clear confirm modal** for UX—optional extra typed confirmation is product choice but must not contradict the API contract.

### Phase 3 exit criteria

- §23 **Seed generation** (periods, one class group per grade, V1 list, order).
- §23 **Reset** (by batch, manual preserved, audit).
- §14 **Non-goals V1** respected: §14.1 V2 modules **not** required in P3.

### Spec coverage

§2.5, §8.3 (4–5), §9.5–9.8, §10–16, §19, §14, §15, §13.

---

## Phase 4 — Impersonation (or approved substitute) + audit visibility

**Shippable outcome:** Platform admin can **assume a test user context** per §18 with audit + clear UI; **or** ship **documented safe alternative** (§9.9) with same access rules.

### Build

| Area | Deliverables |
|------|----------------|
| API | `POST .../impersonate` with preconditions §18.2 | §9.9 |
| Implementation | Prefer real impersonation aligned with Clerk; else **role simulation** with **no** permission bypass without audit (§9.9) | §9.9, §18 |
| Audit | `internal_test.impersonation_started` (+ end session if applicable) | §20 |
| UI | **Tab “View as test user”** (or side panel): filter test users by role, single **Start** → **global banner** “Viewing as … (internal test)” + **Exit** | §8.3 (6), §18.4 |

### Phase 4 exit criteria

- §23 audit **impersonation**; §18 completion verification.

### Spec coverage

§18, §9.9, §8.3 (6), §23 Audit + impersonation bullets.

---

## Phase 5 — Badges everywhere + internal-test audit panel + UX hardening

**Shippable outcome:** **Internal test school** badge appears wherever §8.2 requires (platform already done); **school admin / teacher / student/parent** surfaces show badge when `showInternalTestBadge`; **audit log panel** lists recent internal-test events on the internal-test page.

### Build

| Area | Deliverables |
|------|----------------|
| Badge | Layout headers for school admin, teacher, student/parent testing views per §8.2 | §8.2 |
| Audit UI | **Tab “Activity”** or bottom panel: paginated list of platform audit events filtered to `internal_test.*` for this school | §8.3 (7), §23 Audit visibility |
| UX | Skeleton loaders, empty states, danger zone separation §23 UI; no raw `<select>` / native dates on this feature | §8.4, §19.2, §23 |

### Phase 5 exit criteria

- §23 **UI** section fully; badge placement §8.2 complete.

### Spec coverage

§8.2, §8.4, §19–20 UI, §23 UI & Audit.

---

## Phase 6 — Extended V2 generators (`extended_v2`)

**Shippable outcome:** Optional second scope adds §14.1 modules **without** breaking `core_v1`: separate step keys, failures isolated per §22 Chunk 10.

### Build

| Area | Deliverables |
|------|----------------|
| Scope | `extended_v2` job flag; generators: curriculum/SOW, polls, fundraising, video, vendors/inventory, AI logs, analytics as listed §22 Chunk 10 / §14.1 | §14.1, §22 Chunk 10 |
| Reset | Extend reverse-delete order for new collections **or** registry rows | §19 |
| UI | Job scope selector **radio**: **Core (recommended)** vs **Core + extended**—default Core to avoid confusing partial failures | §14 |

### Phase 6 exit criteria

- §22 Chunk 10 completion verification; §14.2 extension points.

---

## Coverage matrix — spec section → phase

| Spec section | Phase |
|--------------|-------|
| §1–2 Principles & terminology | P1–6 (continuous compliance) |
| §4 Security | P1 (+ secret/env); P3–4 sensitive routes |
| §5 School model | P1 |
| §6 InternalTestSchoolConfig | P1 |
| §7 Test user & invitation | P2 (+ metadata P3 for seeded) |
| §8 Platform UI | P1 layout; P3 seed tab; P4 impersonation tab; P5 badge+audit UI |
| §9 APIs | P1 activate/disable/config; P3 jobs+reset; P4 impersonate |
| §10 Job model | P3 |
| §11 Metadata / registry | P3 |
| §12 Academic periods | P3 |
| §13 Seeded structure | P3 |
| §14 Core V1 / V2 scope | P3 core; P6 extended |
| §15 Generation order | P3 |
| §16 Module-aware generators | P3 (+ P6) |
| §17 Suppression | P2 |
| §18 Impersonation | P4 |
| §19 Reset | P3 |
| §20 Audit | P1–5 |
| §21 Folder structure | Incremental across P1–6 |
| §22 Chunks | Chunk1–2 → P1; 3 → P1+P5; 4 → P2; 5–7 → P3; 8 → P4; 9 → P3; 10 → P6 |
| §23 Acceptance | P1+P2+P3+P4+P5 (full V1); P6 optional product decision |
| §24 Non-goals | Honored in P3–6 |

---

## UI anti-patterns to avoid (confusion)

1. **Do not** show **Enable generation** before internal test mode is enabled—disable or hide with one sentence.
2. **Do not** duplicate safety toggles on school detail and internal-test page—**single** config surface (internal-test page).
3. **Do not** use **two different confirmation styles** for the same action (pick modal **or** typed phrase per route—document in API).
4. **Use tabs** on internal-test page: **Overview & safety** | **Seed data** | **View as user** (P4+) | **Activity** (P5+) — optional **Reset** inside **Seed data** as second step panel (batch → confirm).
5. **Destructive actions** always in a **Danger zone** card at bottom (disable test mode, reset batch).

---

## Release notes suggestion per phase

| Phase | User-visible summary |
|-------|------------------------|
| P1 | “Platform can mark internal test schools and configure delivery safety.” |
| P2 | “Test schools no longer trigger real invites/notifications/payments when configured.” |
| P3 | “Seed realistic core school data in one job; reset seeded data by batch.” |
| P4 | “Platform can view the product as seeded test users (audited).” |
| P5 | “Badges and activity log for internal test schools.” |
| P6 | “Optional extended seed modules for demos and QA.” |

---

**End of phase plan.** This document is the delivery contract for phased shipping; keep it updated if the final implementation spec changes.
