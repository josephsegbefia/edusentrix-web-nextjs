# EduSentrix Assess — REA-00A Repository Verification

**Audit date:** 15 October 2026 (Africa/Accra)  
**Repository:** `edusentrix-web-nextjs`  
**Branch:** `feat/assess-rea-foundation`  
**HEAD:** `9da217565eda468c12a106517b4f7a21d1881b0c` (`revamp bulk uploads`)  
**Working tree at audit completion:** clean except for this report file

## Executive conclusion

The checkout contains a substantial, working academic assessment and report-card engine that should remain the canonical School OS result path. It also contains separate exam-paper authoring, question-bank, exam-scheduling, invigilation, private scan-upload, and Leo advisory foundations.

The repository does **not** yet represent a complete premium Assess product boundary. The subscription registry still exposes broad `assessment.examinations` and `assessment.question_bank` capabilities, while several real routes are either not guarded by the canonical subscription guard or are missing from the registries. The legacy billing helpers used by some Leo paths are explicitly no-op entitlement adapters. These are architecture and commercial-boundary issues, not evidence that ordinary assessment calculations are absent.

REA-00B may begin as a read-only/product-contract exercise: define the capability matrix, route/API ownership, and School OS continuity rules. Do not begin premium entitlement implementation or call the current gate coverage production-ready until the confirmed gaps below are reconciled. REA-00C hardening should address the scanner cleanup race and score-lock race before premium Assess relies on those ledgers.

## Scope and method

This audit followed the attached REA-00A brief. It was read-only with one permitted artifact: this report. No database, migration, seed, deployment, subscription, application-source, or configuration changes were made.

Inspected:

- Git state, package scripts, dependencies, repository instructions, current assessment documentation, models, services, routes, UI route boundaries, storage policy, subscription registries, tests, and audit scripts.
- The canonical assessment engine, examination authoring/question bank, report-card compilation and approval, exam scheduling/invigilation, Konect scanner upload foundation, R2 storage boundary, and entitlement paths.
- Existing test coverage and safe static checks.

`AGENTS.md` was not present in the checked-out repository tree. The repository guidance supplied for this session was followed. The prior source-audit document at `docs/assess/rea/reports/EDUSENTRIX_ASSESS_REA_PHASE0_INITIAL_AUDIT.md` was treated as historical evidence and checked against the current checkout rather than accepted as proof.

## Current architecture map

### School OS academic backbone — implemented

The current canonical engine is the assessment-item/score/result/report-card chain:

```text
AcademicGradingPolicy + AssessmentPlan
        -> AssessmentItem + AssessmentScore
        -> SubjectResult
        -> ReportCardRun + StudentReportCard snapshot
        -> admin approval -> parent/student release
```

Evidence:

- `src/models/AssessmentPlan.ts`, `AssessmentItem.ts`, `AssessmentScore.ts`, `SubjectResult.ts`
- `src/lib/academics/assessment-engine/*`
- `src/lib/academics/reporting/report-card-run-service.ts`
- `src/lib/academics/reporting/report-card-approval-service.ts`
- `docs/ASSESSMENT_ENGINE_IMPLEMENTATION_MAP.md:51-150`

All new tenant-owned assessment records carry `schoolId`. Teacher marks are resolved through the active class/subject/period scope, and homeroom report-run access is checked against the class group and homeroom assignment (`report-card-run-service.ts:134-178`).

### Exam paper and question authoring — implemented, but not a complete delivery product

The exam-paper path has school-scoped papers, sections, typed questions, options, subquestions, expected answers, marking guides, attachments, review records, lifecycle transitions, and question-only PDF export:

- `src/models/ExamPaper.ts:15-49`
- `src/models/ExamQuestion.ts:42-71`
- `src/models/ExamPaperSection.ts:3-13`
- `src/models/QuestionBankItem.ts:23-60`
- `src/lib/examinations/paper-lifecycle.ts:6-94`
- `src/lib/examinations/question-bank-service.ts`
- `src/app/api/admin/examinations/*`
- `src/app/api/teacher/examinations/*`
- `src/app/api/question-bank/*`

Paper submission requires at least one question, admin approval records a review, and completion is constrained to approved/printed papers (`paper-lifecycle.ts:6-94`). Leo exam routes produce draft JSON and explicitly state that Leo cannot approve, publish, print, or lock content (`src/lib/leo/examinations-draft-shared.ts:15-24`).

### Exam sessions, scheduling, and invigilation — implemented foundation

The repository contains `ExamSession`, `ExamTimetableEntry`, `ExamInvigilatorAssignment`, venue, conflict, version, incident, and student-sitting models, plus services for session CRUD, conflict detection, smart scheduling, publish readiness, timetable versioning, notifications, and teacher day operations.

Representative paths:

- `src/lib/exams/exam-session-service.ts`
- `src/lib/exams/exam-conflict-detection.ts`
- `src/lib/exams/exam-smart-scheduler-service.ts`
- `src/lib/exams/exam-readiness-service.ts:78-172`
- `src/lib/exams/exam-publish-service.ts:204-331`
- `src/lib/exams/exam-invigilator-service.ts:198-508`
- `src/app/api/admin/exams/*`
- `src/app/api/teacher/exams/*`
- `src/app/(app)/admin/exams/*`

The scheduler is advisory and the publish service performs readiness/conflict checks. This is operational exam scheduling, not evidence of a CBT attempt runtime or a digital marking ledger.

### Konect scanner and private storage — upload/receipt foundation only

The scanner backend supports eligible completed/approved papers, idempotent script submissions, page initialization, presigned upload, upload completion, finalization, cancellation, ownership checks, expiry of abandoned drafts, and private `assess_script_page` storage.

- `src/models/ScriptSubmission.ts:38-100`
- `src/lib/konect/script-submission-service.ts:47-75,100-162,164-326`
- `src/app/api/konect/v1/admin/assess/scanner/*`
- `src/lib/storage/kinds.ts`
- `src/lib/storage/service.ts:104-170,196-280`
- `src/lib/storage/access-policy.ts`

`scannerContext()` is currently school-admin-only and gates against the broad examinations feature (`script-submission-service.ts:47-60`). The storage policy makes script pages private and school/submission scoped. No current source implementation was found for OMR recognition, answer-sheet interpretation, CBT delivery/attempt timing, or question-level digital marking/moderation. The absence classification is based on focused source searches, not an absolute proof about every possible implementation.

## Capability ledger

| Capability | Current status | Evidence and boundary |
|---|---|---|
| Grading policy and assessment-plan setup | Implemented | `assessment-plan-service.ts`; admin assessment-plan and grading-policy APIs; validation of components, weights, class/grade scope, and active policy references. |
| Assessment items and contribution rules | Implemented | `assessment-item-service.ts`; supports manual/app/exam/imported source types, policy component validation, fixed-required and teacher-selected contribution modes. |
| Bulk marks entry | Implemented with concurrency risk | `assessment-score-service.ts:86-250`; validates school/class/student scope, score range, status, and records an audit event. Lock race remains unresolved below. |
| Subject-result calculation | Implemented | `calculate-component.ts`, `calculate-subject-result.ts`, `subject-result-service.ts:292-365`; dynamic policy components, missing-item blocking, grade boundaries, positions, and snapshots. |
| Subject-result submission | Implemented with mutation hardening still needed | `subject-result-service.ts:401-520`; readiness and blocking checks followed by persisted submitted results. The read-before-write status check is not an atomic compare-and-set. |
| Report-card compilation | Implemented | `report-card-run-service.ts:813-1067`; checks readiness, snapshots school/policy/template/student/attendance/result data, and creates compiled `StudentReportCard` snapshots. |
| Report-card approval/return/release | Implemented with transactional hardening still needed | `report-card-approval-service.ts:392-740`; explicit status guards, approval logs, verification IDs, student-card release, result locking, and visibility flags. Several related writes are not one database transaction. |
| Parent/student report visibility | Implemented at snapshot boundary | `load-student-report-card.ts` defaults to released cards; release writes student-card visibility state. Signed-in client/runtime behavior was not tested. |
| Legacy gradebook retirement | Implemented in route contract | `src/app/api/teacher/gradebook/**` returns 410 and points to marks v2; `tests/assessment-engine.legacy-gradebook-deprecation.test.ts`. Legacy data compatibility remains in adapters. |
| Exam paper authoring/review/PDF | Implemented | Exam paper, section, question, review, lifecycle, builder, and PDF paths listed above. Student PDF intentionally excludes answer keys and marking guides. |
| Reusable question bank | Implemented, subscription guard gap | Search/create/reuse and academic-reference validation exist in `QuestionBankItem` and `question-bank-service.ts`. `/api/question-bank/route.ts` uses membership authorization but has no canonical `requireSchoolFeature` call (`route.ts:17-20,92-95`). |
| Leo exam drafting | Implemented as draft/advisory | JSON output and explicit review-only disclaimer; provider/runtime and usage behavior were not externally tested. |
| Exam scheduling/invigilation | Implemented foundation, subscription guard gap | Sessions, entries, venues, conflicts, readiness, publishing, invigilator assignment/replacement/acknowledgement, and teacher day operations exist. The shown admin routes use `requireSchoolAdmin` but do not call `requireSchoolFeature` (`src/app/api/admin/exams/sessions/route.ts:18-21,41-45`; publish route `:22-29`). |
| Scanner page capture | Implemented foundation, race risk | Durable submission/page state, R2 presign/complete, idempotency, ownership and expiry exist. No OMR/scan interpretation or marking handoff was found. |
| CBT delivery and attempts | Not found in focused search | No dedicated assessment delivery/attempt/response runtime, server-authoritative timer, or candidate delivery snapshot was found. |
| OMR recognition | Not found in focused search | Current scanner stores pages; it does not identify selected answers or create scored responses. |
| Digital marking/moderation ledger | Not found in focused search | Marking guides exist on questions; no question-level marker allocation, moderation, or immutable marking event ledger was found. |
| Advanced item analytics | Not confirmed | Exam analytics/operations routes exist, but a full item-performance analytics contract was not established by this audit. |

## Canonical academic and report lifecycle

The intended lifecycle is materially present:

1. Admin configures an active grading policy and assessment plan scoped to the school, period, grades, and class groups.
2. Teachers/admins create policy-compatible assessment items.
3. Teachers bulk-upsert scores for active students in their authorized class/subject scope.
4. The service calculates dynamic component results and previews readiness/positions.
5. Subject results are submitted and become non-editable according to service status checks.
6. A homeroom teacher or admin opens a report run; the service checks the active plan and policy.
7. Compilation snapshots student, school, policy, template, attendance, subject results, and summaries into `StudentReportCard`.
8. The homeroom teacher submits the compiled run for approval.
9. Admin approves or returns it. Release creates verification records, releases approved student snapshots, records visibility, and locks subject results.

The status constants are explicit in `src/constants/academics/assessment-engine.ts:47-123`. `ReportCardRun` has a unique school/period/class index (`src/models/ReportCardRun.ts:118-131`), and `StudentReportCard` has a unique run/student index (`src/models/StudentReportCard.ts:106-118`).

## Verified risk findings

### REA-RISK-01 — scanner cleanup can retire valid sibling assets

**Status: Confirmed static risk; not reproduced against R2.**

`initializePage()` first creates a pending storage asset, then attempts an atomic page insertion. If another request wins the same page-number race, the losing request calls `retireSubmissionAssets()` (`script-submission-service.ts:192-215`). That helper updates every pending, ready, or failed `assess_script_page` asset associated with the submission (`:23-40`), not just the asset created by the losing request. A duplicate/concurrent page initialization can therefore mark already-valid pages deleted. `completePage()` has a similar broad cleanup path if it observes a closed submission (`:239-253`).

The existing Konect suite proves idempotency, ownership, finalization concurrency, expiry isolation, and storage read isolation, but it does not exercise concurrent `initializePage()` losers with multiple valid sibling assets, real R2 behavior, or retry/reconciliation (`tests/konect/admin-integration-persistence.test.ts:154-215`).

**Required before premium reliance:** retire only the specific newly-created asset on an insertion failure; keep submission-wide cleanup for explicit cancellation/expiry only; add a concurrency test with at least two existing valid pages; add mock-R2 and provider integration coverage.

### REA-RISK-02 — score lock is not an atomic write invariant

**Status: Confirmed static race; no concurrent database test exists.**

`bulkUpsertAssessmentScores()` reads existing scores and rejects records whose current status is `locked` (`assessment-score-service.ts:148-174`). The later `AssessmentScore.bulkWrite()` filter only includes school, assessment item, and student (`:181-215`); it does not include `status != locked`, a version, or a lock token. A lock written after the pre-check can therefore be overwritten by a stale bulk update unless another external invariant prevents it.

The helper tests prove that a locked status is rejected in a single-threaded call (`tests/assessment-engine.assessment-mutations.test.ts:170-195`), but they do not prove edit-vs-lock concurrency, duplicate student IDs in one batch, retry behavior, or partial unordered bulk-write handling. Subject-result submission has the same general read-before-write shape (`subject-result-service.ts:423-488`) and should be included in the hardening scope.

**Required before premium reliance:** use a conditional/versioned update or equivalent atomic state transition, define duplicate-record semantics, and test concurrent edit, lock, retry, and partial-failure cases.

### REA-RISK-03 — entitlement registry and enforcement are not one complete source of truth

**Status: Confirmed static drift; runtime plan behavior remains unverified.**

What is consistent:

- `FEATURE_KEYS` defines canonical dotted keys (`src/lib/subscriptions/feature-keys.ts:16-81`).
- Every plan has a decision for every canonical key; `npx tsx scripts/audit-entitlements.ts` passed.
- The current plan matrix is Starter: examinations/question bank `NO`; Growth: both `LIMITED`; Enterprise: both `YES` (`plan-entitlements.ts:126-135,201-209,269-277`).

What is not consistent:

- The API registry lists `/api/admin/question-bank`, while the actual route is `/api/question-bank` (`src/lib/subscriptions/api-registry.ts:229-235`; `src/app/api/question-bank/route.ts`).
- The page registry lists `/admin/assessments/examinations` and `/admin/assessments/question-bank`, while the actual pages are `/admin/examinations` and `/admin/question-bank` (`route-registry.ts:100-110`; `src/app/(app)/admin/examinations/*`; `src/app/(app)/admin/question-bank/*`).
- The question-bank API has membership and school scoping but no canonical feature guard (`src/app/api/question-bank/route.ts:17-20,92-115`).
- Exam-session, publish, scheduler, and invigilator routes use admin authorization but do not visibly call the canonical subscription guard (`src/app/api/admin/exams/sessions/route.ts:18-21,41-45`; publish route `:22-29`; scheduler route `:16-22`; invigilator route `:23-29,65-71`).
- The broad guard is intentionally disabled unless both `SUBSCRIPTION_ENFORCEMENT_ENABLED` and `SUBSCRIPTION_API_GATES_ENABLED` are true (`src/lib/subscriptions/guards.ts:24-51`). Page gates have a separate `SUBSCRIPTION_FRONTEND_GATES_ENABLED` switch (`require-page-feature.ts:26-46`). Access mode also becomes `full` when enforcement is off (`access-mode.ts:45-49`).
- Legacy `src/lib/billing/feature-access.ts:100-106` returns true for every feature, `src/lib/billing/entitlements.ts:96-169` returns a full/unlimited snapshot, and `src/lib/billing/require-entitlement.ts:28-48` does not check the requested feature or limit.
- Exam Leo and scheduling Leo still use the legacy raw key `ai_leo_copilot` and legacy entitlement helper (`src/lib/leo/examinations-draft-shared.ts:26-49`; `src/lib/leo/exam-scheduling-advisory-shared.ts:50-68`).
- `consistency-scanner.ts:144-173` compares canonical plan values to the strings `"included"`, while the plan matrix uses `YES`, `LIMITED`, `OPTIONAL`, and `NO`; its usage-balance check is therefore not aligned with the current registry.

The repository’s legacy-key audit found 49 references, including the legacy billing helpers and Leo paths. The static feature-gate audit reported 58 raw issues, but that checker also prepends `/api` to registry entries that already contain `/api`; its output is not a clean route defect count. The manually confirmed mismatches above remain actionable.

**Required before commercial implementation:** choose the canonical entitlement boundary, map every actual page/API/server action (including nested routes), replace or deliberately quarantine legacy no-op checks, reconcile route/API registries, repair the consistency scanner, and test Starter/Growth/Enterprise/pilot/expired/no-subscription/standalone-Assess behavior with gates enabled.

## School OS core versus premium Assess recommendation

This is a recommendation for REA-00B, not a subscription change made by this audit.

### Keep in School OS core

- School, identity, membership, academic periods, grades, class groups, students, teachers, subjects, and subject offerings.
- Grading policies and assessment plans needed for ordinary school assessment.
- Assessment items, scores, standard exam-mark entry, calculation, subject results, corrections under policy, and audit history.
- Basic report-card compilation, approval, release, attendance snapshots, and parent/student released snapshots.
- A simple core examination path that can contribute a finalized result to the canonical assessment engine.

### Candidate premium Assess capabilities

- Advanced paper/question-bank workflows, blueprints, variants, higher-volume authoring and governed Leo generation, subject to a precise decision about which current operations are already relied upon by School OS customers.
- Exam delivery/CBT runtime, candidate assignment, attempt/response contracts, server-authoritative timing, and invigilation controls.
- Signed paper identity, OMR/QR recognition, Konect capture/review, scan reconciliation, and provider-backed storage operations.
- Digital marking, question-level marker/moderation workflows, immutable marking events, and advanced item/performance analytics.

Premium Assess should hand finalized results into the existing `AssessmentItem`/`AssessmentScore`/`SubjectResult` pipeline. It should not write directly into report-card snapshots. The current broad `assessment.examinations` key does not express this boundary and must not be treated as the final commercial design.

## Verification results

### Passed

- Pure assessment, report-card, exam-engine, and subscription suites: **278 tests passed, 0 failed**.
- Konect admin integration suite with local MongoDB listener access: **8 tests passed, 0 failed**.
- `npx tsx scripts/audit-entitlements.ts`: plan matrix consistent.
- `git diff --check`: passed.

### Failed or blocked, with classification

- `npm run lint`: failed on two existing errors in `src/lib/delegations/delegate-admin-access.ts:34,47`; two warnings also exist in `src/lib/learn/covered-lesson-sessions.ts:32-33`. No source was changed to address them.
- `./node_modules/.bin/tsc --noEmit`: failed with a broad pre-existing error set across generated `.next` validators, application routes, scripts, and tests. The output includes assessment fixture/type drift such as missing `appliesToGradeIds` and obsolete `class_only` visibility values. This is not a clean repository-wide type gate.
- `npm run test:konect-admin-integration` inside the restricted sandbox: blocked by `MongoMemoryServer` listener `EPERM`; the same unchanged suite passed when local listener access was allowed.
- `npx tsx scripts/audit-legacy-feature-keys.ts`: failed with 49 legacy references, as described in REA-RISK-03.
- `npx tsx scripts/audit-feature-gates.ts`: failed with 58 raw issues. The checker has a path-construction defect for API entries and stale route entries; use the manually confirmed findings above rather than the raw count.

### Not performed

- No production MongoDB, R2, Cloudflare, Coolify, Clerk, Inngest, OpenAI, or provider smoke tests.
- No native Konect repository/device test.
- No browser/signed-in user acceptance test, load test, security penetration test, migration, seed, or deployment check.
- No claim is made here that the current implementation is production-ready for CBT, OMR, digital marking, or commercial Assess entitlement enforcement.

## REA-00B readiness and next actions

**Recommendation: REA-00B can begin now as a design and verification-contract slice.** Its first deliverable should be a capability-by-capability matrix tied to actual page/API/server-action paths and explicit School OS continuity tests.

Before REA-00B implementation work is merged, resolve or explicitly accept:

1. The core-versus-premium capability decisions for existing exam authoring, question bank, scheduling, scanning, and Leo operations.
2. Canonical entitlement ownership and all route/registry mismatches.
3. Legacy billing/no-op helper migration or an explicit temporary boundary with tests proving it cannot protect premium paths accidentally.
4. Scanner asset cleanup concurrency and score/result lock races.
5. A clean targeted type/lint baseline for the touched assessment boundary.
6. Signed-in, gate-enabled, R2/provider, and native Konect verification plans.

No production release approval is given by this report.
