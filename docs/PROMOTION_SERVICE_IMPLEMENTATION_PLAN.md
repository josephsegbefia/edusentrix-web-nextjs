# Promotion Service Implementation Plan (Tickets + Sequence)

## 1. Delivery Strategy

1. Deliver in phases to avoid regressions:
   - Phase A: Foundations + Preview-only backend
   - Phase B: Review/Placement UI + manual overrides
   - Phase C: Finalize/Rollback async execution
   - Phase D: Hardening, observability, rollout
2. Keep feature-flagged rollout:
   - `promotion.enabled`
   - `promotion.finalizeEnabled`
   - `promotion.rollbackEnabled`

## 2. Ticket Conventions

1. Prefixes:
   - `PROMO-BE-*` backend
   - `PROMO-FE-*` frontend
   - `PROMO-QA-*` quality/release
2. Each ticket includes:
   - Scope
   - Dependencies
   - Deliverables
   - Acceptance criteria

## 3. Backend Tickets

### PROMO-BE-001: Data Models and Indexes

1. Scope:
   - Add models: `PromotionPolicy`, `PromotionCycle`, `PromotionDecision`, `PromotionExecutionLog`.
   - Add optional student metadata fields required by promotion service.
2. Suggested files:
   - `src/models/PromotionPolicy.ts`
   - `src/models/PromotionCycle.ts`
   - `src/models/PromotionDecision.ts`
   - `src/models/PromotionExecutionLog.ts`
   - `src/models/Student.ts` (optional additive fields only)
3. Dependencies: none
4. Acceptance criteria:
   - Models compile.
   - Required indexes exist.
   - No existing model/API breakage.

### PROMO-BE-002: Policy APIs

1. Scope:
   - `GET /api/admin/promotions/policies/active`
   - `POST /api/admin/promotions/policies`
   - `POST /api/admin/promotions/policies/:id/activate`
2. Suggested files:
   - `src/app/api/admin/promotions/policies/active/route.ts`
   - `src/app/api/admin/promotions/policies/route.ts`
   - `src/app/api/admin/promotions/policies/[id]/activate/route.ts`
   - `src/schemas/promotion-policy.ts`
3. Dependencies: `PROMO-BE-001`
4. Acceptance criteria:
   - Validation enforced.
   - Version increment behavior works.
   - Exactly one active policy per school.

### PROMO-BE-003: Preview Engine + Cycle Creation

1. Scope:
   - `POST /api/admin/promotions/cycles/preview`
   - Build immutable policy snapshot on cycle.
   - Evaluate decisions from attendance/academics/finance inputs.
2. Suggested files:
   - `src/app/api/admin/promotions/cycles/preview/route.ts`
   - `src/lib/promotions/engine.ts`
   - `src/lib/promotions/evidence.ts`
   - `src/lib/promotions/conflicts.ts`
3. Dependencies: `PROMO-BE-001`, `PROMO-BE-002`
4. Acceptance criteria:
   - Preview is read-only for student placement.
   - Decisions and conflict codes saved correctly.
   - Policy fallback works when no active policy.

### PROMO-BE-004: Cycle Read APIs + Pagination

1. Scope:
   - `GET /api/admin/promotions/cycles`
   - `GET /api/admin/promotions/cycles/:cycleId`
   - `GET /api/admin/promotions/cycles/:cycleId/decisions`
2. Suggested files:
   - `src/app/api/admin/promotions/cycles/route.ts`
   - `src/app/api/admin/promotions/cycles/[cycleId]/route.ts`
   - `src/app/api/admin/promotions/cycles/[cycleId]/decisions/route.ts`
3. Dependencies: `PROMO-BE-003`
4. Acceptance criteria:
   - Pagination works (`page`, `limit`, filters).
   - Sorting and filtering return stable results.

### PROMO-BE-005: Overrides and Placement APIs

1. Scope:
   - `PATCH /api/admin/promotions/cycles/:cycleId/decisions/:studentId`
   - `POST /api/admin/promotions/cycles/:cycleId/placements/auto-assign`
   - `PATCH /api/admin/promotions/cycles/:cycleId/decisions/:studentId/placement`
   - Optimistic concurrency (`decision.version`).
2. Suggested files:
   - `src/app/api/admin/promotions/cycles/[cycleId]/decisions/[studentId]/route.ts`
   - `src/app/api/admin/promotions/cycles/[cycleId]/placements/auto-assign/route.ts`
   - `src/app/api/admin/promotions/cycles/[cycleId]/decisions/[studentId]/placement/route.ts`
   - `src/lib/promotions/placement.ts`
3. Dependencies: `PROMO-BE-004`
4. Acceptance criteria:
   - Override reason required.
   - Capacity-aware assignment with defined tie-breakers.
   - `409` on stale decision versions.

### PROMO-BE-006: Approve + Finalize Async Execution

1. Scope:
   - `POST /api/admin/promotions/cycles/:cycleId/approve`
   - `POST /api/admin/promotions/cycles/:cycleId/finalize`
   - Batch execution, progress tracking, retries, `finalize_failed` handling.
2. Suggested files:
   - `src/app/api/admin/promotions/cycles/[cycleId]/approve/route.ts`
   - `src/app/api/admin/promotions/cycles/[cycleId]/finalize/route.ts`
   - `src/lib/promotions/finalize-runner.ts`
   - Optional internal trigger route for resumable jobs
3. Dependencies: `PROMO-BE-005`
4. Acceptance criteria:
   - Finalize runs asynchronously and idempotently.
   - `TermResult.isPromoted` compatibility writes succeed.
   - Progress fields update during execution.

### PROMO-BE-007: Rollback Execution

1. Scope:
   - `POST /api/admin/promotions/cycles/:cycleId/rollback`
   - Restore pre-finalize student placement snapshots.
2. Suggested files:
   - `src/app/api/admin/promotions/cycles/[cycleId]/rollback/route.ts`
   - `src/lib/promotions/rollback-runner.ts`
3. Dependencies: `PROMO-BE-006`
4. Acceptance criteria:
   - Rollback is idempotent.
   - Failure states tracked as `rollback_failed`.

### PROMO-BE-008: Audit/Activity/Observability

1. Scope:
   - Add promotion activity event types.
   - Write execution logs, structured logs, and metrics hooks.
2. Suggested files:
   - `src/models/Activity.ts`
   - `src/lib/audit/recordActivity.ts`
   - `src/lib/promotions/logging.ts`
3. Dependencies: `PROMO-BE-006`
4. Acceptance criteria:
   - All critical transitions logged with actor/cycle metadata.
   - No failed main flow if audit write fails.

## 4. Frontend Tickets

### PROMO-FE-001: Navigation and Entry Points

1. Scope:
   - Add `/admin/promotions` sidebar item under Academics.
   - Add Settings shortcut: "Open Promotion Center".
2. Suggested files:
   - `src/components/nav/sidebars/school-admin-sidebar.tsx`
   - `src/app/(app)/admin/settings/page.tsx`
3. Dependencies: none
4. Acceptance criteria:
   - Nav works on desktop/mobile.
   - Settings link routes correctly.

### PROMO-FE-002: Promotions Page Shell + Tabs

1. Scope:
   - Build page shell with tabs and cycle status-aware visibility/disabled logic.
2. Suggested files:
   - `src/app/(app)/admin/promotions/page.tsx`
   - `src/components/admin/promotions/PromotionTabs.tsx`
   - `src/types/admin/promotion.ts`
3. Dependencies: `PROMO-FE-001`, `PROMO-BE-004`
4. Acceptance criteria:
   - Tabs follow status rules from spec.
   - Handles no-cycle empty state.

### PROMO-FE-003: Policy Tab

1. Scope:
   - Policy list/create/edit/activate flows.
2. Suggested files:
   - `src/components/admin/promotions/PolicyTab.tsx`
   - `src/hooks/admin/usePromotionPolicies.ts`
3. Dependencies: `PROMO-BE-002`
4. Acceptance criteria:
   - Validation errors surfaced.
   - Activation updates active policy state.

### PROMO-FE-004: Preview Tab

1. Scope:
   - Run preview with filters (grade/class), show totals and conflict summary.
2. Suggested files:
   - `src/components/admin/promotions/PreviewTab.tsx`
   - `src/hooks/admin/usePromotionPreview.ts`
3. Dependencies: `PROMO-BE-003`
4. Acceptance criteria:
   - Preview run is non-destructive.
   - Loading/progress and error states implemented.

### PROMO-FE-005: Review & Overrides Tab

1. Scope:
   - Paginated decision table, filters, override modal/form with required reason.
2. Suggested files:
   - `src/components/admin/promotions/ReviewTab.tsx`
   - `src/components/admin/promotions/OverrideDecisionModal.tsx`
   - `src/hooks/admin/usePromotionDecisions.ts`
3. Dependencies: `PROMO-BE-004`, `PROMO-BE-005`
4. Acceptance criteria:
   - Handles `409` concurrency conflicts gracefully.
   - Supports filter reset + empty states.

### PROMO-FE-006: Placement Tab

1. Scope:
   - Auto-assign action + manual placement editor for conflicts.
2. Suggested files:
   - `src/components/admin/promotions/PlacementTab.tsx`
   - `src/components/admin/promotions/ManualPlacementModal.tsx`
3. Dependencies: `PROMO-BE-005`
4. Acceptance criteria:
   - Auto-assign results reflected in decisions table.
   - Manual placement validates and updates decision rows.

### PROMO-FE-007: Finalize Tab

1. Scope:
   - Approve/finalize actions, async progress UI, retry for failures.
2. Suggested files:
   - `src/components/admin/promotions/FinalizeTab.tsx`
   - `src/hooks/admin/usePromotionFinalize.ts`
3. Dependencies: `PROMO-BE-006`
4. Acceptance criteria:
   - Shows live progress.
   - Prevents destructive actions while finalizing.

### PROMO-FE-008: History Tab

1. Scope:
   - Cycle history list and cycle detail view.
2. Suggested files:
   - `src/components/admin/promotions/HistoryTab.tsx`
3. Dependencies: `PROMO-BE-004`
4. Acceptance criteria:
   - Pagination and status badges work.
   - Supports drill-down into cycle detail.

### PROMO-FE-009: Student Promotion History Surface

1. Scope:
   - Add promotion history block in student relationships/details.
2. Suggested files:
   - `src/components/admin/students/detail/StudentRelationshipsTab.tsx`
   - optional: new API/read hook if required
3. Dependencies: `PROMO-BE-004`
4. Acceptance criteria:
   - Shows latest cycle outcome and history count.

## 5. QA and Release Tickets

### PROMO-QA-001: Backend Test Suite

1. Scope:
   - Unit tests for engine/evidence/placement logic.
   - Integration tests for full cycle lifecycle.
2. Dependencies: `PROMO-BE-007`
3. Acceptance criteria:
   - High-confidence coverage for critical rules and state transitions.

### PROMO-QA-002: Frontend Test Suite

1. Scope:
   - Component and flow tests for tab visibility, empty/error/loading states.
2. Dependencies: `PROMO-FE-008`
3. Acceptance criteria:
   - Core UI flows validated under success/failure paths.

### PROMO-QA-003: Regression and Pilot Rollout

1. Scope:
   - Regression pass for students/reports/fees/attendance.
   - Pilot rollout with feature flags.
2. Dependencies: `PROMO-QA-001`, `PROMO-QA-002`
3. Acceptance criteria:
   - No critical regressions.
   - Pilot schools run preview/finalize successfully.

## 6. Recommended Sequence (Execution Order)

1. `PROMO-BE-001`
2. `PROMO-BE-002`
3. `PROMO-BE-003`
4. `PROMO-BE-004`
5. `PROMO-FE-001`
6. `PROMO-FE-002`
7. `PROMO-FE-003`
8. `PROMO-FE-004`
9. `PROMO-BE-005`
10. `PROMO-FE-005`
11. `PROMO-FE-006`
12. `PROMO-BE-006`
13. `PROMO-FE-007`
14. `PROMO-BE-007`
15. `PROMO-FE-008`
16. `PROMO-BE-008`
17. `PROMO-FE-009`
18. `PROMO-QA-001`
19. `PROMO-QA-002`
20. `PROMO-QA-003`

## 7. Suggested Sprint Breakdown

1. Sprint 1:
   - `PROMO-BE-001` to `PROMO-BE-004`
   - `PROMO-FE-001` to `PROMO-FE-004`
2. Sprint 2:
   - `PROMO-BE-005`, `PROMO-BE-006`
   - `PROMO-FE-005`, `PROMO-FE-006`, `PROMO-FE-007`
3. Sprint 3:
   - `PROMO-BE-007`, `PROMO-BE-008`
   - `PROMO-FE-008`, `PROMO-FE-009`
   - QA/release tickets

## 8. Risk Register (Top Risks + Mitigation)

1. Risk: placement conflicts spike at finalize time.
   - Mitigation: strict pre-finalize validation + manual placement queue.
2. Risk: long-running finalize timeout.
   - Mitigation: resumable batch runner with cursor/progress.
3. Risk: concurrent admin edits cause data races.
   - Mitigation: optimistic locking on cycle and decision updates.
4. Risk: regressions in existing flows.
   - Mitigation: feature flags + regression suite + pilot-first rollout.

## 9. Definition of Done (Program Level)

1. Preview, review, placement, finalize, and rollback all work end-to-end.
2. Existing modules remain stable.
3. Observability and activity logs are in place.
4. QA sign-off completed.
5. Feature flags enabled for production rollout plan.
