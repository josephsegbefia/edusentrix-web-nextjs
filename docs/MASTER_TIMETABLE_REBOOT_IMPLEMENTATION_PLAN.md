# Master Timetable Reboot Implementation Plan (Tickets + Sequence)

## 1. Delivery Strategy

1. Deliver additively to avoid regressions.
2. Keep existing timetable and assignment flows active during migration.
3. Introduce new timetable domain behind feature flags.
4. Move to new admin planner first, then role read-only views.
5. Cut over only after dual-write parity and QA sign-off.

## 2. Feature Flags

1. `timetable.reboot.enabled`
2. `timetable.dualWrite.enabled`
3. `timetable.adminPlanner.enabled`
4. `timetable.publishWorkflow.enabled`
5. `timetable.roleReadViews.enabled`

## 3. Ticket Conventions

1. Prefixes:
   - `TT-BE-*` backend
   - `TT-FE-*` frontend
   - `TT-OPS-*` ops/migration
   - `TT-QA-*` quality/release
2. Each ticket must include:
   - Scope
   - Dependencies
   - Deliverables
   - Acceptance criteria

## 4. Backend Tickets

### TT-BE-001: New Timetable Models + Indexes

1. Scope:
   - Add `TimetableVersion`, `TimetableSlot`, `TimetableConflict`, `TimetableChangeLog`.
   - Add required compound indexes for school/period/version queries.
2. Suggested files:
   - `src/models/TimetableVersion.ts`
   - `src/models/TimetableSlot.ts`
   - `src/models/TimetableConflict.ts`
   - `src/models/TimetableChangeLog.ts`
3. Dependencies: none
4. Acceptance criteria:
   - Models compile.
   - Indexes created.
   - No breaking schema changes to existing models.

### TT-BE-002: Timetable Validation + Conflict Engine

1. Scope:
   - Centralize time validation and overlap detection.
   - Detect teacher overlap and class overlap conflicts.
2. Suggested files:
   - `src/lib/timetable/validate.ts`
   - `src/lib/timetable/conflicts.ts`
3. Dependencies: `TT-BE-001`
4. Acceptance criteria:
   - Conflict engine returns deterministic conflict codes.
   - Shared logic used by slot CRUD and publish.

### TT-BE-003: Version Management APIs

1. Scope:
   - `GET /api/admin/timetable/versions`
   - `POST /api/admin/timetable/versions`
   - `POST /api/admin/timetable/versions/:versionId/clone-from-published`
2. Suggested files:
   - `src/app/api/admin/timetable/versions/route.ts`
   - `src/app/api/admin/timetable/versions/[versionId]/clone-from-published/route.ts`
3. Dependencies: `TT-BE-001`
4. Acceptance criteria:
   - Version creation and clone flow works per school+period.

### TT-BE-004: Draft Slot CRUD APIs

1. Scope:
   - `GET/POST/PATCH/DELETE` for draft slots.
   - Enforce draft-only mutation and validation rules.
2. Suggested files:
   - `src/app/api/admin/timetable/versions/[versionId]/slots/route.ts`
   - `src/app/api/admin/timetable/versions/[versionId]/slots/[slotId]/route.ts`
3. Dependencies: `TT-BE-002`, `TT-BE-003`
4. Acceptance criteria:
   - Invalid slots rejected with clear errors.
   - Conflict records refreshed after mutations.

### TT-BE-005: Conflict APIs + Recompute

1. Scope:
   - `GET /api/admin/timetable/versions/:versionId/conflicts`
   - `POST /api/admin/timetable/versions/:versionId/conflicts/recompute`
2. Suggested files:
   - `src/app/api/admin/timetable/versions/[versionId]/conflicts/route.ts`
   - `src/app/api/admin/timetable/versions/[versionId]/conflicts/recompute/route.ts`
3. Dependencies: `TT-BE-002`, `TT-BE-004`
4. Acceptance criteria:
   - Conflict list is paginated/filterable.
   - Recompute is idempotent and stable.

### TT-BE-006: Publish Workflow API (Atomic Swap)

1. Scope:
   - `POST /api/admin/timetable/versions/:versionId/publish`
   - Block publish when unresolved error conflicts exist.
   - Archive previous published version atomically.
2. Suggested files:
   - `src/app/api/admin/timetable/versions/[versionId]/publish/route.ts`
   - `src/lib/timetable/publish.ts`
3. Dependencies: `TT-BE-005`
4. Acceptance criteria:
   - One published version per school+period.
   - Publish is transactional and auditable.

### TT-BE-007: Published Read APIs (Week/Day/Calendar)

1. Scope:
   - `GET /api/timetable/week`
   - `GET /api/timetable/day`
   - `GET /api/timetable/calendar`
2. Suggested files:
   - `src/app/api/timetable/week/route.ts`
   - `src/app/api/timetable/day/route.ts`
   - `src/app/api/timetable/calendar/route.ts`
   - `src/lib/timetable/read-model.ts`
3. Dependencies: `TT-BE-006`
4. Acceptance criteria:
   - Monday day query returns all Monday slots sorted by start time.
   - Week/day/calendar read from published version only.

### TT-BE-008: Role Read Facade APIs (Read-Only)

1. Scope:
   - Teacher detail read API.
   - Class detail read API.
   - Parent ward read API.
   - Student self read API.
2. Suggested files:
   - `src/app/api/admin/teachers/[teacherId]/timetable/week/route.ts`
   - `src/app/api/admin/classes/[classId]/timetable/week/route.ts`
   - `src/app/api/parent/wards/[studentId]/timetable/week/route.ts`
   - `src/app/api/student/timetable/week/route.ts`
3. Dependencies: `TT-BE-007`
4. Acceptance criteria:
   - Parent and student access checks enforced.
   - Endpoints are read-only.

### TT-BE-009: Classroom Label Mapping and Fallbacks

1. Scope:
   - Resolve `classroomLabel` from `ClassGroup.defaultRoomName`.
   - Fallback to `${grade.name} ${classGroup.name} Classroom`.
2. Suggested files:
   - `src/lib/timetable/classroom-label.ts`
3. Dependencies: `TT-BE-001`
4. Acceptance criteria:
   - Every slot has non-empty classroom label.

### TT-BE-010: Dual-Write Bridge from Existing Assignment Flows

1. Scope:
   - Mirror schedule updates from existing assignment endpoints to draft timetable.
   - Keep legacy routes functioning.
2. Suggested files:
   - `src/app/api/admin/teacher-assignments/[id]/schedule/route.ts` (additive integration only)
   - `src/app/api/admin/teachers/[id]/assignments/route.ts` (additive integration only)
   - `src/lib/timetable/dual-write.ts`
3. Dependencies: `TT-BE-004`, `TT-BE-009`
4. Acceptance criteria:
   - Legacy and new draft data remain in parity during pilot.

### TT-BE-011: Audit and Activity Logging

1. Scope:
   - Log slot create/update/delete and publish actions.
2. Suggested files:
   - `src/lib/timetable/audit.ts`
   - `src/models/Activity.ts` (additive event types)
3. Dependencies: `TT-BE-006`
4. Acceptance criteria:
   - All admin write actions are traceable by actor/time.

## 5. Frontend Tickets

### TT-FE-001: Admin Timetable Center Shell

1. Scope:
   - Build planner shell for `/admin/timetable` with version banner and view switcher.
2. Suggested files:
   - `src/app/(app)/admin/timetable/page.tsx`
   - `src/components/admin/timetable/TimetableCenterShell.tsx`
3. Dependencies: `TT-BE-003`
4. Acceptance criteria:
   - Draft/published status is visible.
   - View switching works.

### TT-FE-002: Week View (Admin)

1. Scope:
   - Weekly timetable view with filters (grade, class, teacher, subject).
2. Suggested files:
   - `src/components/admin/timetable/WeekView.tsx`
3. Dependencies: `TT-BE-007`
4. Acceptance criteria:
   - Filtered weekly rendering is correct and performant.

### TT-FE-003: Day View (Admin)

1. Scope:
   - Selected day list sorted by start time.
2. Suggested files:
   - `src/components/admin/timetable/DayView.tsx`
3. Dependencies: `TT-BE-007`
4. Acceptance criteria:
   - Monday day view shows all Monday slots in chronological order.

### TT-FE-004: Calendar View (Admin)

1. Scope:
   - Month calendar navigation that opens day/week context.
2. Suggested files:
   - `src/components/admin/timetable/CalendarView.tsx`
3. Dependencies: `TT-BE-007`
4. Acceptance criteria:
   - Date navigation is stable and timezone-safe.

### TT-FE-005: Draft Slot Editor

1. Scope:
   - Create/edit/delete slot modal/panel for draft version.
2. Suggested files:
   - `src/components/admin/timetable/SlotEditorModal.tsx`
   - `src/hooks/admin/useTimetableDraftSlots.ts`
3. Dependencies: `TT-BE-004`
4. Acceptance criteria:
   - Validation errors displayed inline.
   - Mutations reflect immediately in current view.

### TT-FE-006: Conflict Panel + Publish Blockers

1. Scope:
   - Conflict list UI with severity, codes, and jump-to-slot support.
   - Publish button disabled with unresolved errors.
2. Suggested files:
   - `src/components/admin/timetable/ConflictPanel.tsx`
3. Dependencies: `TT-BE-005`, `TT-BE-006`
4. Acceptance criteria:
   - Publish blockers are clear and actionable.

### TT-FE-007: Teacher Detail `My Week` (Read-Only)

1. Scope:
   - Add `My Week` tab in teacher detail.
2. Suggested files:
   - `src/app/(app)/admin/teachers/[id]/page.tsx`
   - `src/components/admin/teachers/detail/TeacherMyWeekTab.tsx`
3. Dependencies: `TT-BE-008`
4. Acceptance criteria:
   - Teacher timetable is readable only and sourced from published version.

### TT-FE-008: Class Detail Timetable (Read-Only)

1. Scope:
   - Add class read-only week/day timetable tab.
2. Suggested files:
   - `src/components/admin/classes/detail/ClassScheduleTab.tsx` (v2 read-only data source)
3. Dependencies: `TT-BE-008`
4. Acceptance criteria:
   - Class timetable reads published version only.

### TT-FE-009: Parent Ward Timetable (Read-Only)

1. Scope:
   - Add ward week/day timetable with ward switcher.
2. Suggested files:
   - `src/app/(app)/parent/...` relevant timetable surface
   - `src/components/parent/timetable/WardTimetable.tsx`
3. Dependencies: `TT-BE-008`
4. Acceptance criteria:
   - Parents can switch wards and view only linked wards.

### TT-FE-010: Student `My Week` (Read-Only)

1. Scope:
   - Add student week/day timetable surface.
2. Suggested files:
   - `src/app/(app)/student/...` relevant page
   - `src/components/student/timetable/MyWeek.tsx`
3. Dependencies: `TT-BE-008`
4. Acceptance criteria:
   - Student can view own timetable only.

### TT-FE-011: Empty/Error/Loading States

1. Scope:
   - Standardize no-published-timetable, empty-day, loading skeleton, and retry states.
2. Dependencies: `TT-FE-001` to `TT-FE-010`
3. Acceptance criteria:
   - UX behavior is consistent across admin/teacher/class/parent/student views.

## 6. Ops and Migration Tickets

### TT-OPS-001: Backfill Script from Legacy Assignment Schedules

1. Scope:
   - Create internal script/job to populate initial draft timetable from `TeacherAssignment.schedules`.
2. Dependencies: `TT-BE-001`, `TT-BE-009`
3. Acceptance criteria:
   - Backfill results are repeatable and auditable.

### TT-OPS-002: Dual-Write Parity Monitor

1. Scope:
   - Add parity checks comparing legacy schedule output vs new draft output for pilot schools.
2. Dependencies: `TT-BE-010`
3. Acceptance criteria:
   - Mismatch report available before cutover.

### TT-OPS-003: Timetable Observability

1. Scope:
   - Metrics and alerts:
     - read latency
     - publish failures
     - conflict recompute failures
     - dual-write mismatch rate
2. Dependencies: `TT-BE-006`, `TT-BE-007`, `TT-OPS-002`
3. Acceptance criteria:
   - Dashboards and alert thresholds defined.

## 7. QA and Release Tickets

### TT-QA-001: Backend Test Suite

1. Scope:
   - Unit and integration tests for validation, conflicts, versioning, and publish.
2. Dependencies: `TT-BE-011`
3. Acceptance criteria:
   - Core backend flows have reliable automated coverage.

### TT-QA-002: Frontend Test Suite

1. Scope:
   - Week/day/calendar behavior, conflict panel, publish blockers, and read-only surfaces.
2. Dependencies: `TT-FE-011`
3. Acceptance criteria:
   - Role views verified as read-only.

### TT-QA-003: Regression and Pilot Rollout

1. Scope:
   - Regression across legacy assignment and timetable behavior.
   - Pilot rollout with feature flags and parity monitoring.
2. Dependencies: `TT-QA-001`, `TT-QA-002`, `TT-OPS-002`
3. Acceptance criteria:
   - No critical regressions.
   - Pilot schools run publish and role reads successfully.

## 8. Recommended Execution Order

1. `TT-BE-001`
2. `TT-BE-009`
3. `TT-BE-002`
4. `TT-BE-003`
5. `TT-BE-004`
6. `TT-BE-005`
7. `TT-BE-006`
8. `TT-BE-007`
9. `TT-BE-008`
10. `TT-BE-011`
11. `TT-OPS-001`
12. `TT-BE-010`
13. `TT-OPS-002`
14. `TT-FE-001`
15. `TT-FE-002`
16. `TT-FE-003`
17. `TT-FE-004`
18. `TT-FE-005`
19. `TT-FE-006`
20. `TT-FE-007`
21. `TT-FE-008`
22. `TT-FE-009`
23. `TT-FE-010`
24. `TT-FE-011`
25. `TT-OPS-003`
26. `TT-QA-001`
27. `TT-QA-002`
28. `TT-QA-003`

## 9. Suggested Sprint Breakdown

1. Sprint 1:
   - `TT-BE-001..005`
   - `TT-OPS-001`
2. Sprint 2:
   - `TT-BE-006..010`
   - `TT-OPS-002`
   - `TT-FE-001..004`
3. Sprint 3:
   - `TT-FE-005..008`
   - `TT-BE-011`
   - `TT-OPS-003`
4. Sprint 4:
   - `TT-FE-009..011`
   - `TT-QA-001..003`
   - Pilot rollout and cutover decision

## 10. Non-Regression Checklist

1. Existing `/api/admin/timetable/master` continues to respond during migration.
2. Existing assignment schedule update flow remains functional.
3. Current class schedule pages remain usable before cutover.
4. Teacher assignment create/update does not lose schedule data.
5. Legacy UI remains available behind fallback flag until pilot sign-off.

## 11. Risk Register (Top Risks + Mitigation)

1. Risk: dual-write divergence.
   - Mitigation: parity monitor, mismatch dashboard, controlled pilot.
2. Risk: publish race conditions.
   - Mitigation: transactional publish and optimistic lock version.
3. Risk: performance regression on week/day reads.
   - Mitigation: read-optimized indexes and p95 latency alerts.
4. Risk: unauthorized role access to timetable data.
   - Mitigation: strict scope checks for parent/student endpoints.
5. Risk: rollout confusion across old/new UIs.
   - Mitigation: feature flags, clear cutover runbook, fallback switch.

## 12. Definition of Done (Program Level)

1. Admin can manage draft timetable and publish safely.
2. Week/day/calendar views function in admin center.
3. Monday day view shows all Monday slots in correct order.
4. Teacher/class/parent/student read-only timetable surfaces are live.
5. Classroom labels follow class-classroom rule consistently.
6. Existing schedule features remain stable through rollout.
7. QA and pilot rollout sign-off completed.

## 13. Transition Plan: Teacher Assignment Schedule Source Cutover

### Objective

Move teacher assignment schedule display from legacy `TeacherAssignment.schedule/schedules` to class-group timetable slots, while preventing schedule creation from the teacher assignment tab.

### Scope of Cutover

1. Read path:
   - Teacher assignment API (`GET /api/admin/teachers/:id/assignments`) resolves schedules from timetable slots.
   - Version selection per academic period is `draft` first, `published` fallback.
   - Legacy assignment schedules are fallback-only when no timetable slots exist.
2. Write path:
   - Teacher assignment tab is read-only for schedules.
   - Schedule creation/editing happens only in timetable planner flows.
3. Sync integrity:
   - Subject assign/unassign routes participate in timetable dual-write so all assignment entry points remain in sync.

### Rollout Steps

1. Step 1: Deploy read-path projection + UI guard rails
   - Enable schedule projection in assignment API.
   - Remove schedule create/edit controls from teacher assignment tab.
   - Keep legacy fallback to avoid blank schedules during migration.
2. Step 2: Ensure all assignment entry points dual-write
   - Add dual-write calls to:
     - `POST /api/admin/subjects/assign-teacher`
     - `POST /api/admin/subjects/unassign-teacher`
   - Confirm existing dual-write on teacher assignment routes remains active.
   - Enforce schedule-edit deprecation on assignment schedule endpoint:
     - `PATCH /api/admin/teacher-assignments/:id/schedule` rejects schedule payloads.
3. Step 3: Data parity validation
   - Run parity script:
     - `npm run timetable:parity`
   - Use admin parity API/report:
     - `GET /api/admin/timetable/parity?academicPeriodId=...`
   - Investigate and resolve mismatches before removing legacy dependence.
4. Step 4: Backfill (if required)
   - For periods with only legacy schedules, run:
     - `npm run timetable:backfill`
   - Re-run parity script and confirm mismatch rate is acceptable.
5. Step 5: Observability gate
   - Track dual-write failures and parity mismatch trend.
   - Block full cutover if mismatch or error rates exceed thresholds.
6. Step 6: Legacy deprecation (final phase)
   - After sustained parity success, stop reading legacy schedule fields.
   - Keep rollback window where legacy fallback can be re-enabled quickly.

### Acceptance Criteria

1. Assignment tab always shows timetable-derived schedules when slots exist.
2. No schedule-create controls are present in assignment tab.
3. Assign/unassign via subject workflows updates timetable draft consistently.
4. No regressions in teacher/class/parent/student read-only timetable views.
