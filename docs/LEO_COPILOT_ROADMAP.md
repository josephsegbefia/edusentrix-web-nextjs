# Leo Copilot — Phased Roadmap & Build Tracker

**Canonical spec:** [LEO_COPILOT_DEVELOPMENT_SPEC.md](./LEO_COPILOT_DEVELOPMENT_SPEC.md)  
**Legend:** `[ ]` not started · `[~]` in progress (optional) · `[x]` done — replace symbols as you ship.

**Last reviewed:** 2026-04-21 (set when you change status).

How to use this file:

- Check items when merged to `main` (or your release branch).
- Keep one “current phase” in focus; avoid expanding tool surface until Phase 0–1 are stable.
- For “migrated to Leo” items, the narrow AI can stay live until the row is checked.

---

## Version ↔ phase map (release tags)

| Version   | Phases   | User-visible theme                                      |
|----------|----------|----------------------------------------------------------|
| **v0.1** | Phase 0  | Flags, entitlements, school settings — no assistant UI  |
| **v0.2** | Phase 1  | Assistant shell, bootstrap, chat persistence (admin)      |
| **v0.3** | Phase 2  | Admin read-only Leo (tools + context, no writes)         |
| **v0.4** | Phase 3  | Admin safe actions (preview, confirm, audit)             |
| **v0.5** | Phase 4  | Teacher surfaces                                         |
| **v0.6** | Phase 5  | Parent + student                                         |
| **v1.0** | Phase 6  | Bursar, billing owner, platform admin operational Leo    |
| **v1.x** | + below  | Hardening, `Investigate` depth, monitors, cost caps      |

Phases are sequential dependencies: don’t mark a later phase “done” if an earlier one is still open for the same code path.

---

## Phase 0 — Control plane (target **v0.1**)

Aligned with spec §8, §11.1–11.2, §19 Phase 0, platform APIs in §13.1 / admin §13.2.

### Runtime & entitlement

- [x] `FEATURE_LEO_COPILOT_RUNTIME_ENABLED` (server)
- [x] `NEXT_PUBLIC_FEATURE_LEO_COPILOT_RUNTIME_ENABLED` (client; launcher gating)
- [x] When runtime off: launcher hidden; Leo API routes return `503` / `feature_disabled` (per spec)
- [x] Entitlement key `ai_leo_copilot` (or equivalent) wired in billing / subscription check
- [x] `LeoAccessResolver` (or equivalent) implementing order in spec §8.5 with **machine-readable** `disabledReason` for UI

### Data & settings

- [x] `PlatformFeatureFlag` model + unique index on `key` (`leo_copilot` or as named in spec)
- [x] `SchoolSettings.leo` (or nested `leo` object) + validation on PATCH
- [x] Migrations / additive schema only (per spec §21.6)

### UIs

- [x] Platform admin: view/edit global Leo flag, force modes, self-service policy, pilot bypass (per §8.6) — `/platform/leo`
- [x] School admin: Leo settings (only if `allowSchoolSelfService` / effective rules) — access + pilot bypass; **MVP** (not full `allowWriteActions` / retention UI yet) — `Admin → Settings → Features`

### API (minimal)

- [x] `GET/PATCH` platform Leo settings (spec §13.1)
- [x] `GET/PATCH` school/admin Leo settings (spec §13.2)

**Phase 0 done when:** effective access can be **computed**, **displayed**, and **changed** (where allowed) without any chat UI.

---

## Phase 1 — Assistant shell (target **v0.2**)

Aligned with spec §9, §10, §12.1–12.2, §12.3 (bootstrap + envelope), §19 Phase 1.

### Frontend (shell)

- [x] `LeoProvider` mounted in role layouts (start with **admin** only if needed) — *admin layout mounts `AdminLeoEntry`*
- [x] `LeoLauncher` (respects effective access; hidden when disabled) — *minimal `AdminLeoEntry` in admin layout*
- [x] `LeoPane` + `LeoChatThread` + `LeoDisabledState` / `LeoRoleEmptyState` — *MVP floating pane, chat thread, empty state*
- [x] `LeoContextBadgeBar` and/or `LeoQuickPromptStrip` (can be minimal v1) — *route-aware badge and quick prompt chips in admin pane*
- [x] `useLeoBootstrap` + bootstrap payload typing (`LeoBootstrapDTO`)

### Backend

- [x] `GET /api/leo/bootstrap` (or name in spec) — access, model profile, starters, tool **families** allowed (may be empty at first)
- [x] `LeoOrchestrator` stub: no-op or echo-only path acceptable until Phase 2 **if** clearly flagged — *scaffold assistant response stored with citation*

### Persistence

- [x] `LeoConversation` + `LeoMessage` models and indexes (spec §11.3–11.4)
- [x] `POST/GET` conversations; `POST` messages; list messages (spec §13.3 area)
- [x] Idempotency / error handling for failed assistant turns (basic)

### Out of scope for v0.2 (defer)

- [ ] `LeoMonitorPanel` / `LeoMonitor` model (Phase 1+ later)
- [ ] `LeoMessageBlockRenderer` rich blocks (start plain text, add later)
- [ ] `LeoHistoryPanel` full UI (optional stub)

**Phase 1 done when:** a school admin can **open Leo**, **send a message**, and **see it persisted** with correct **access gating** (no production-quality answers required yet).

---

## Phase 2 — Admin read-only Leo (target **v0.3**)

Aligned with spec §19 Phase 2, §12.2–12.4, §12.6–12.7, **§22 initial tools**.

### Core orchestration

- [x] `LeoContextBuilder` — route + tab + entity from context providers (spec §12.7) — *normalizes route, tab, entity, and mode from `pageContextSnapshot`*
- [x] `LeoToolRegistry` + at least one tool per **started** family (expand incrementally) — *registered read-only tool execution path with shared caching*
- [x] `LeoPolicyGuard` on every tool (school boundary, role)
- [x] Citations in responses (spec §12.6) — start strict: tool outputs only
- [x] `LeoResponseCache` for expensive summaries (optional but recommended for cost) — *short-lived cache around read-only tool drafts*

### Tools to ship first (spec §22 — check when implemented)

- [x] `setup_readiness_summary`
- [x] `teacher_assignment_conflicts`
- [x] `class_timetable_status`
- [x] `class_subject_teacher_links`
- [x] `teacher_week_summary`
- [x] `student_risk_summary`
- [x] `fees_overdue_summary`
- [x] `report_brief`
- [x] `settings_change_impact` (or scoped subset)

### Page coverage (minimum from spec §15)

Track separately from tools — a tool can back multiple routes.

- [x] `/admin` (dashboard) — *setup/readiness summaries*
- [x] `/admin/timetable` and class schedule surfaces — *class timetable status from `/admin/classes/[id]` route*
- [x] `/admin/teachers` + teacher detail — *teacher week summary from `/admin/teachers/[id]` route*
- [x] `/admin/reports` — *executive report brief from current report summary*
- [x] `/admin/finance` or fees hub (match your nav) — *overdue fees summary from finance/fees/overdue routes*

### Modes (product)

- [x] `Explain` works end-to-end — *tool-backed answers plus natural help/greeting fallback*
- [x] `Investigate` — explicitly “not yet” in UI and assistant response

**Phase 2 done when:** admin gets **useful, cited, permission-safe** answers on the main blocker pages without **any** write path through Leo.

---

## Phase 3 — Admin safe actions (target **v0.4**)

Aligned with spec §12.5, §19 Phase 3, §16, **§22 first write actions**.

### Infrastructure

- [x] `LeoActionRegistry` + `LeoActionRun` model (spec §11.5) — *initial guarded registry plus action run persistence*
- [x] `POST /api/leo/actions/preview` and `.../execute` (or as in spec)
- [x] `LeoConfirmDrawer` + `LeoActionCard` in the pane — *minimal action preview and confirmation UI*
- [x] `LeoAuditWriter` for every execute (spec §16.5) — *writes `AuditEvent` records for executed/failed Leo actions*
- [~] Thumbnails / “preview diff” as defined per action — *text/destination preview for first low-risk actions*

### First actions (spec §22)

- [x] `navigate_to_fix_surface`
- [x] `draft_school_notice`
- [x] `draft_parent_message`
- [x] `preview_teacher_assignment_change` — *read-only conflict/impact preview; execute records reviewed preview only*
- [x] `preview_homeroom_change` — *read-only conflict/impact preview; execute records reviewed preview only*
- [x] `preview_timetable_publish` — *read-only publish-readiness preview; execute records reviewed preview only*

**Phase 3 done when:** at least **two** actions flow **preview → confirm → execute** with **audit** and **permission** checks, on staging.

---

## Phase 4 — Teacher Leo (target **v0.5**)

Aligned with spec §6.2, §19 Phase 4, teacher routes in §15.

- [ ] Bootstrap + context on teacher layout
- [ ] Tools: schedule, class, attendance/gradebook summaries (as in spec §7 for teacher)
- [ ] Optional: teacher studio drafting hooks (if product priority)
- [ ] Confirm teacher cannot see other schools’ data (role tests in §18)

**Phase 4 done when:** a teacher can use Leo for **week/schedule** and **class-scoped** help with the same gating model as admin.

---

## Phase 5 — Parent & student Leo (target **v0.6**)

Aligned with spec §6.3–6.4, §19 Phase 5.

- [ ] Parent: ward-scoped tools only; fees/academics/calendar summarization
- [ ] Student: assignments, results, timetable, notices
- [ ] E2E tests from spec §18.2–18.3 for parent/student scoping

**Phase 5 done when:** E2E cases for parent **ward isolation** and student **self-only** data pass.

---

## Phase 6 — Finance + platform (target **v1.0**)

Aligned with spec §6.5–6.7, §19 Phase 6.

- [ ] Bursar: collections, reconciliation, overdue narratives (tool-backed)
- [ ] Billing owner: payment setup, payout/gateway **read** guidance
- [ ] Platform admin: school health, entitlements, rollout, incident-style triage (read-heavy first)
- [ ] `GET` platform usage/audit where spec §13 defines them

**v1.0 done when:** spec **§20 Acceptance Criteria** are all satisfied (use as release gate checklist below).

---

## Cross‑cutting (ship incrementally; track here)

| Area            | v0.1 | v0.2 | v0.3 | Later |
|-----------------|------|------|------|-------|
| `LeoUsageEvent` / cost telemetry | [ ]  | [ ]  | [ ]  | [ ]   |
| `LeoFeedback` (thumbs)           | [ ]  | [ ]  | [ ]  | [ ]   |
| Per-school token budget (§17)    | [ ]  | [ ]  | [ ]  | [ ]   |
| Prompt safety / allowlists (§16)| [ ]  | [ ]  | [x]* | [ ]   |
| Unit tests (§18.1)              | [ ]  | [ ]  | [ ]  | [ ]   |
| E2E tests (§18.2–3)              | [ ]  | [ ]  | [ ]  | [ ]   |

*Minimum viable before real users see model output in Phase 2.

---

## Spec §20 — Release gate (v1.0)

Copy from [LEO_COPILOT_DEVELOPMENT_SPEC.md](./LEO_COPILOT_DEVELOPMENT_SPEC.md) §20; check when **all** true:

- [ ] (1) Platform admin: enable/disable Leo **globally**
- [ ] (2) Platform admin: enable/disable for **one school**
- [ ] (3) Effective state **visible** and **auditable**
- [ ] (4) **Launcher** respects state + **role**
- [ ] (5) Leo **explains** key admin **blockers** on major pages
- [ ] (6) Leo can **suggest** and **preview** guarded **actions**
- [ ] (7) **Conversations**, **actions**, **usage**, **feedback** stored
- [ ] (8) **Permissions** respected (school, role, entity)
- [ ] (9) **Existing** point-AI can be invoked **through** Leo **or** migration path documented
- [ ] (10) **E2E:** global off, school pilot on, **role** scoping

---

## Migration — narrow AI → Leo tools (from spec §4 & §9.4)

Track each legacy entry until it is a **registered tool** (or **deprecated** with a ticket).

- [ ] `CreateTeacherModal` NL suggestions → `teacher_assignment_suggester` (or named tool)
- [ ] `CreateClassGroupsModal` draft → `class_group_plan_generator`
- [ ] Timetable coach → `timetable_gap_coach`
- [ ] Reports executive brief → `report_brief` / shared brief tool
- [ ] School setup readiness coaching → `setup_readiness_summary`
- [ ] Staff attendance AI insights
- [ ] Roles and duties AI insights
- [ ] Student ID suggestion
- [ ] `AICachedInsight` / `AIFeatureCache` / `AIFeatureUsageEvent` — align with `LeoResponseCache` / `LeoUsageEvent` where applicable

**Migration wave done when:** no new one-off `api/.../ai/...` routes for Leo-class features (per spec §21.3).

---

## Post‑v1.0 (optional / backlog)

- [ ] `LeoMonitor` + in-app + email delivery (spec §11.6)
- [ ] Full **Investigate** across modules with strict tool boundaries
- [ ] `LeoHistoryPanel` + search across conversations
- [ ] Advanced `LeoMessageBlockRenderer` (tables, charts, action blocks)
- [ ] `search` API if spec includes semantic/org search
- [ ] Internationalization of Leo UI strings
- [ ] Red-team / LLM security tests to spec §18.4

---

## What’s “left” at a glance

| Area                         | Status signpost                                      |
|-----------------------------|------------------------------------------------------|
| Control plane (Phase 0)     | All unchecked until flags + settings ship            |
| Chat shell (Phase 1)        | Depends on Phase 0                                   |
| Admin value (Phases 2–3)    | **Largest** product chunk before other roles         |
| Other roles (Phases 4–6)     | Gated on patterns from admin                         |
| §20 acceptance               | **Definition of done** for v1.0                    |
| Narrow AI migration         | Ongoing; can lag v1.0 if spec (9) allows “path documented” |

Update the **Version ↔ phase** table and this section when you cut releases.
