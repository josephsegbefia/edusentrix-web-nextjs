# EduSentrix Assess — REA-00B
## Core versus Premium Capability and Entitlement Architecture

**Audit date:** 15 October 2026 (Africa/Accra)  
**Repository:** `edusentrix-web-nextjs`  
**Branch:** `feat/assess-rea-foundation`  
**HEAD inspected:** `9da217565eda468c12a106517b4f7a21d1881b0c` (`revamp bulk uploads`)  
**Status:** Design-only architecture report. No application-code, subscription, permission, database, or deployment changes were made.

## 1. Executive architectural decision

EduSentrix should operate as one School OS platform with two separable product entitlements:

1. **School OS Core** provides the ordinary academic operating system, including mark entry, examination marks, grading, subject results, report-card compilation, approval, release, and historical results.
2. **EduSentrix Assess** provides advanced assessment workflows such as advanced authoring, CBT, invigilation, QR/OMR/Konect workflows, digital marking, moderation, advanced analytics, and governed assessment AI.

The canonical result path must remain:

```text
AssessmentPlan / AssessmentItem
        -> AssessmentScore
        -> SubjectResult
        -> ReportCardRun / StudentReportCard snapshot
        -> approval -> release
```

This is already the shape of the School OS academic engine (`src/models/AssessmentPlan.ts`, `AssessmentItem.ts`, `AssessmentScore.ts`, `SubjectResult.ts`, `src/lib/academics/assessment-engine/*`, and `src/lib/academics/reporting/*`). Premium delivery systems must produce finalized, provenance-bearing inputs to that engine. They must not create a second score engine, write report-card snapshots directly, or bypass School OS authorization.

The current repository is not yet an authoritative implementation of this boundary. The canonical feature registry contains only broad assessment keys (`src/lib/subscriptions/feature-keys.ts:39-42`), current plan rows treat examinations and question banks differently by plan (`src/lib/subscriptions/plan-entitlements.ts:133-135,201-209,269-277`), and several examination APIs rely on role authorization without a canonical subscription guard. This report therefore defines the target contract and a safe migration sequence; it does not change current commercial behavior.

### Architectural decision summary

| Decision | Recommendation | Current status |
|---|---|---|
| Result authority | Keep `AssessmentItem`/`AssessmentScore`/`SubjectResult`/`ReportCardRun` canonical | Confirmed current engine |
| Basic academic assessment | School OS Core, independent of Assess | Required product boundary; current plan catalog does not express it cleanly |
| Advanced assessment workflows | Assess Premium | Proposed classification |
| Entitlement ownership | Product grant + capability grant + role + tenant scope + lifecycle/usage | Proposed target model |
| Enforcement location | Page, API, server action, and domain-service boundary; API/service checks are authoritative | Current coverage is incomplete |
| Assess-only provisioning | Supported through a minimal school tenant and Assess grant, without unrelated School OS modules | Proposed product capability |
| Existing plans | Preserve existing snapshots and behavior during migration; use compatibility aliases/grandfathering | Required; no silent changes in REA-00B |

## 2. Evidence boundary and method

### Confirmed implementation facts

The following are repository observations independently checked against the REA-00A report:

- The assessment engine models plans, items, scores, subject results, report-card runs, student report-card snapshots, attendance snapshots, and approval logs (`src/models/AssessmentPlan.ts`, `AssessmentItem.ts`, `AssessmentScore.ts`, `SubjectResult.ts`, `ReportCardRun.ts`, and `src/models/ReportApprovalLog.ts`).
- Assessment marks are validated against school, class group, subject, academic period, student status, teacher scope, score range, and assessment-plan scope in `src/lib/academics/assessment-engine/assessment-score-service.ts:86-146`.
- Score writes currently pre-read locked rows at `src/lib/academics/assessment-engine/assessment-score-service.ts:148-174`, then use a bulk-write filter without a lock/version predicate at `:181-215`. This is a confirmed static concurrency risk, not a claim about a reproduced production race.
- Subject-result submission calculates and checks readiness before upserting submitted results in `src/lib/academics/assessment-engine/subject-result-service.ts:401-520`; its read-before-write status decision also requires concurrency hardening.
- Report compilation, approval, release, and result locking are implemented in `src/lib/academics/reporting/report-card-run-service.ts` and `report-card-approval-service.ts`. Parent/student report reads are designed around released snapshots.
- Exam paper, section, question, review, lifecycle, PDF, session, timetable, venue, conflict, and invigilator models/services exist (`src/models/ExamPaper.ts`, `ExamQuestion.ts`, `ExamSession.ts`, `ExamTimetableEntry.ts`, `ExamInvigilatorAssignment.ts`, and corresponding `src/lib/examinations/*` and `src/lib/exams/*` services).
- Konect scanner persistence supports private page upload/complete/finalize/cancel flows, but the focused search found no CBT attempt runtime, OMR answer recognition, or digital marking/moderation ledger (`src/models/ScriptSubmission.ts`, `src/lib/konect/script-submission-service.ts`, `src/app/api/konect/v1/admin/assess/scanner/*`).
- Leo examination output is explicitly draft-only and cannot approve, publish, print, or lock content (`src/lib/leo/examinations-draft-shared.ts:15-24`). Its entitlement helper still uses the legacy `ai_leo_copilot` key (`:7-8,35-49`).
- The canonical subscription module defines `FEATURE_KEYS`, plan access levels, an entitlement resolver, lifecycle access modes, page guards, API guards, role rules, and usage gates (`src/lib/subscriptions/README.md`, `feature-keys.ts`, `plan-entitlements.ts`, `resolve-school-entitlements.ts`, `access-mode.ts`, `guards.ts`, and `role-entitlement-rules.ts`).
- The canonical guards are no-ops unless both `SUBSCRIPTION_ENFORCEMENT_ENABLED` and `SUBSCRIPTION_API_GATES_ENABLED` are true (`src/lib/subscriptions/guards.ts:24-51`). Page gates have a separate frontend switch (`src/lib/subscriptions/require-page-feature.ts:26-46`).
- Legacy billing helpers remain permissive: `hasTierFeature()` returns true (`src/lib/billing/feature-access.ts:100-106`), and the legacy entitlement path supplies a full/unlimited snapshot (`src/lib/billing/entitlements.ts:96-169`).

### Proposed architecture

Statements marked **proposed**, **must**, or **should** below describe the target contract. They are not claims that the repository already implements that behavior.

## 3. Capability ownership inventory

The correct classification is at the capability level, not at the route prefix level. The existing examination pages and services mix basic academic use with advanced assessment operations, so the route name alone must not determine whether a capability is premium.

| Capability | Current repository evidence | Recommended owner | Boundary decision |
|---|---|---|---|
| School identity, memberships, academic periods, grades, class groups, students, teachers, subjects, subject offerings | Core models and school-scoped services throughout `src/models`, `src/lib/auth`, and academic routes | School OS Core | Never require Assess |
| Grading policies and assessment plans | `src/models/AcademicGradingPolicy.ts`, `AssessmentPlan.ts`; `src/lib/academics/assessment-engine/assessment-plan-service.ts` | School OS Core | Required for ordinary assessment and reports |
| Assessment item definition and contribution rules | `assessment-item-service.ts`; item source modes include manual/exam/imported paths | School OS Core | Basic items remain available; advanced authoring is separate |
| Classwork/continuous-assessment mark entry | `/api/teacher/marks/assessment-items`, `/api/teacher/marks/scores/bulk`; `assessment-score-service.ts` | School OS Core | Teacher/admin role and class/subject scope still apply |
| Basic examination mark entry | Existing exam marks feed the assessment engine; teacher exam mark routes and `AssessmentItem`/`AssessmentScore` support this path | School OS Core | Must work without Assess, even if advanced paper tooling is unavailable |
| Ordinary grading, subject results, positions, pass/fail, and calculation snapshots | `calculate-component.ts`, `calculate-subject-result.ts`, `subject-result-service.ts` | School OS Core | Canonical result calculation |
| Basic report-card compilation, approval, release, and historical reads | `report-card-run-service.ts`, `report-card-approval-service.ts`, released snapshot loaders | School OS Core | Retain without Assess; preserve parent/student release authorization |
| Manual/basic examination paper creation, if retained as a School OS workflow | `ExamPaper`, `ExamQuestion`, paper lifecycle, builder routes | Decision required; recommended Core Lite or grandfathered legacy capability | Do not infer that all current paper authoring is premium |
| Advanced question bank and reusable item operations | `QuestionBankItem`, `question-bank-service.ts`, `/api/question-bank/**` | Assess Premium | Split from basic exam marks; existing schools need compatibility treatment |
| Advanced paper authoring, blueprints, variants, higher-order assembly | Current `ExamPaper`/builder foundation; no separate blueprint/variant contract confirmed | Assess Premium | New capability keys and lifecycle contracts required |
| Governed Leo exam generation/advisory | `src/lib/leo/examinations-draft-shared.ts`; generated output is draft-only | Assess Premium when assessment-scoped | Human review and no automatic publish/lock remain mandatory |
| Exam sessions, scheduling, venues, conflict review, publishing, invigilation | `src/lib/exams/*`, `/api/admin/exams/**`, `/admin/exams/**` | Assess Premium | Existing role controls are not equivalent to entitlement controls |
| CBT delivery, candidate assignment, attempt timing, responses | No dedicated runtime found in focused search | Assess Premium | New delivery/attempt contract required |
| QR-coded papers and scan identity | Scanner storage foundations exist; complete QR identity workflow not confirmed | Assess Premium | Must be idempotent and school/submission scoped |
| OMR answer-sheet recognition | No recognition implementation found in focused search | Assess Premium | Recognition must be reviewable before score finalization |
| Konect script capture and reconciliation | `ScriptSubmission` and private `assess_script_page` storage | Assess Premium | Current upload foundation needs race hardening before reliance |
| Digital marking | Marking guides exist on questions; no complete marker ledger found | Assess Premium | Requires immutable marking events and moderation state |
| Moderation and second marking | No complete moderation ledger found in focused search | Assess Premium | Must not overwrite original marking evidence |
| Advanced assessment analytics | Exam operations analytics exist; complete item-performance contract not confirmed | Assess Premium | Must use authorized, finalized data and explicit retention rules |
| Non-assessment Leo, lesson generation, generic analytics | Existing broad AI keys and module paths | Separate module/product capability | Do not grant unrelated AI or School OS modules through Assess |

### Important classification rule

“Examination” is not one entitlement. The following must remain separately expressible:

- recording a normal exam mark against an assessment item;
- authoring or reusing advanced question content;
- scheduling and invigilating a session;
- delivering CBT attempts;
- recognizing OMR/scanned answers;
- marking, moderating, and finalizing premium evidence;
- viewing advanced analytics.

The current `assessment.examinations` key is too broad for this boundary. It may remain as a compatibility alias during migration but must not be the long-term authorization decision for all of these operations.

## 4. Current plans versus the required product boundary

The current canonical map has four plan codes (`src/lib/subscriptions/plan-codes.ts:6-18`): Pilot, Starter, Growth, and Enterprise. It currently expresses:

| Current plan | Current assessment rows | Product description currently in code | Architectural implication |
|---|---|---|---|
| Pilot | Assessment keys `OPTIONAL` | Platform-admin-controlled onboarding | Explicit per-school grants are appropriate; do not assume full Core or Assess |
| Starter | Examinations and question bank `NO` | Core records/admissions/fees/basic reports | Conflicts with the required Core guarantee for basic examination marks; migration must correct interpretation without removing basic marks |
| Growth | Examinations and question bank `LIMITED` | “Basic examinations” and “basic question bank” | Must separate basic Core marks from advanced Assess workflows; preserve existing customer behavior during migration |
| Enterprise | Examinations and question bank `YES` | Full School OS/advanced operations | Enterprise may include or bundle Assess commercially, but product grant should still be explicit and auditable |

This report does not change any row. The discrepancy is a confirmed architecture issue, not permission to alter subscriptions in this slice.

### Proposed product entitlement axes

The future resolver should evaluate these independently:

1. **Tenant existence and product provisioning** — which products are provisioned for the school.
2. **Product grant** — `school_os` and/or `assess`, each with lifecycle and plan/grant provenance.
3. **Capability grant** — the feature inside that product, including optional, limited, or usage-metered access.
4. **Role permission** — the user’s school membership role and any scoped permission.
5. **Tenant/data scope** — `schoolId`, class group, grade, subject, period, student, paper/session ownership.
6. **Lifecycle access mode** — active, pilot/trial, grace, restricted, or suspended.
7. **Usage and operational state** — limits, credits, lock status, result state, and idempotency state.

No single plan code or frontend switch should substitute for these layers.

## 5. Proposed feature-key catalog and compatibility mapping

These names are proposed only. Existing keys must not be modified in REA-00B.

### Product and School OS Core keys

| Proposed key | Meaning |
|---|---|
| `product.school_os` | School OS product provisioned |
| `schoolos.academics.assessment_plans` | Grading policies and assessment plans |
| `schoolos.academics.mark_entry` | Classwork, continuous assessment, and ordinary exam mark entry |
| `schoolos.academics.result_calculation` | Subject-result calculation and correction workflows |
| `schoolos.reports.basic` | Basic report-card compilation, approval, release, and historical reads |
| `schoolos.academics.basic_examinations` | Core examination setup needed to record ordinary exam marks; not advanced delivery |

Existing `core.*`, `academics.subjects`, and related School OS keys remain the compatibility base for existing modules.

### Assess Premium keys

| Proposed key | Meaning |
|---|---|
| `product.assess` | EduSentrix Assess product provisioned |
| `assess.authoring.advanced` | Advanced paper authoring and assembly |
| `assess.question_bank` | Reusable advanced question-bank operations |
| `assess.blueprints` | Blueprint and coverage planning |
| `assess.variants` | Examination variant generation and governed distribution |
| `assess.cbt.delivery` | Candidate delivery, attempts, timing, and responses |
| `assess.exam.scheduling` | Advanced session scheduling, venue, and conflict workflows |
| `assess.exam.invigilation` | Invigilation assignment and operational controls |
| `assess.paper.qr` | QR identity and paper reconciliation |
| `assess.omr.recognition` | OMR recognition and review |
| `assess.konect.scanning` | Konect scan capture, reconciliation, and review |
| `assess.marking.digital` | Digital marking and question-level evidence |
| `assess.marking.moderation` | Moderation, second marking, and governed adjustments |
| `assess.analytics.advanced` | Advanced assessment and item analytics |
| `assess.ai.governed` | Governed AI assistance for assessment workflows |
| `assess.integrations` | Premium assessment integrations and provider boundaries |

Usage limits should be separate keys or limit keys, not encoded as a boolean feature. Examples include `assess.cbt.active_attempts`, `assess.ai.credits`, `assess.omr.pages`, and `assess.storage.bytes`.

### Compatibility mappings

| Existing key/path | Transitional interpretation | Target treatment |
|---|---|---|
| `core.school_profile`, `core.academic_periods`, `core.classes`, `core.students`, `core.teachers`, `core.parents` | Existing School OS capabilities | Keep as Core keys; no Assess dependency |
| `academics.subjects`, `academics.curriculum`, `academics.schemes`, `academics.lesson_notes`, `academics.lessons` | Existing School OS modules | Keep separate from Assess |
| `assessment.examinations` | Mixed legacy bundle covering paper/exam/session operations | Compatibility alias only; classify each route/capability into Core or Assess |
| `assessment.question_bank` | Legacy question-bank capability | Compatibility alias during grandfathering; target `assess.question_bank` |
| `ai.leo` | Broad Leo access | Do not use as proof of Assess entitlement; use product-specific capability for assessment AI |
| `ai.exam_generation` | Existing assessment-adjacent AI key | Map to `assess.ai.governed` only after review of current customers and workflow scope |
| `ai_leo_copilot` | Legacy raw key in examination/scheduling Leo helpers | Quarantine behind a compatibility adapter, then migrate or explicitly retire |
| `core_school_ops`, `examinations`, `question_bank` and other legacy flat keys | Legacy billing vocabulary | Read-time compatibility only; never add new direct checks |

### Compatibility rule

Existing subscriptions must receive a stable effective-grant snapshot during migration. A school must not lose a currently used workflow because a broad key was renamed. The migration must distinguish:

- Core access that becomes guaranteed for all eligible School OS customers;
- premium access explicitly included by a current plan or school override;
- legacy access that is grandfathered until renewal or an agreed migration date;
- access that was never actually implemented or authorized and must not be invented by migration.

The grandfathering policy, renewal boundary, and whether current Growth question-bank users retain advanced operations are open decisions in Section 13.

## 6. Actual route, API, service, and server-action ownership

The matrix below separates the current owner from the proposed entitlement. “Partial” means role/tenant authorization exists but canonical subscription enforcement is absent or inconsistent.

| Surface | Current owner/evidence | Current authorization observation | Proposed product boundary |
|---|---|---|---|
| Admin assessment-plan APIs | `src/app/api/admin/academics/assessment-plans/**`; `assessment-plan-service.ts` | Admin and school scope are present; feature enforcement must be verified per route | `product.school_os` + `schoolos.academics.assessment_plans` |
| Teacher assessment-item APIs | `/api/teacher/marks/assessment-items/**`; `assessment-item-service.ts` | Teacher scope and active plan checks are domain-owned | `product.school_os` + `schoolos.academics.mark_entry` |
| Teacher bulk scores | `/api/teacher/marks/scores/bulk`; `assessment-score-service.ts` | Teacher/class/subject/student scope exists; atomic lock invariant is incomplete | Core; require role/scope and atomic result-state checks |
| Subject-result preview/submit | `/api/teacher/marks/subject-results/{preview,submit}`; `subject-result-service.ts` | Domain scope and readiness checks exist; submit race requires hardening | Core; require result version/state checks |
| Homeroom report runs | `/api/teacher/homeroom/report-runs/**`; `report-card-run-service.ts` | Homeroom/admin authorization and class scope are domain concerns | `product.school_os` + `schoolos.reports.basic` |
| Admin report approval/release | `/api/admin/reports/report-runs/**`; `report-card-approval-service.ts` | Admin approval/release state machine exists | Core; never Assess-only |
| Parent/student released reports | Parent/student report-card read paths and released snapshot loaders | Released snapshot boundary is the relevant authorization | Core read; historical retention survives Assess changes |
| Admin exam paper pages | `/admin/examinations/**`; `src/app/(app)/admin/examinations/**` | Page layout exists; page registry uses stale `/admin/assessments/examinations` path | Split basic Core workflow from advanced Assess operations; correct registry later |
| Admin examination APIs | `/api/admin/examinations/**`; `ExamPaper`, paper lifecycle, builder actions | Collection POST has a canonical feature call; nested routes do not show uniform guards | Per-route classification; advanced authoring -> `assess.authoring.advanced` |
| Teacher examination APIs | `/api/teacher/examinations/**`; examination services | Main route contains a feature call; nested routes need an inventory and uniform enforcement | Basic mark contribution Core; advanced authoring/complete workflow Assess or explicit legacy grant |
| Builder server actions | `src/lib/examinations/builder-route-actions.ts` | Server actions create/patch/delete sections/questions; direct-call guard coverage must be verified | Enforce Assess capability at action/service boundary, not only page/API |
| Question-bank page | `/admin/question-bank`; page layout exists | Registry path is stale (`/admin/assessments/question-bank`) | `assess.question_bank` |
| Question-bank APIs | `/api/question-bank/**`; `question-bank-service.ts` | `requireQuestionBankActor()` authenticates/membership-scopes, but `/api/question-bank/route.ts:17-20,92-115` has no canonical feature guard | `assess.question_bank` at route and service boundary |
| Exam sessions | `/admin/exams/sessions/**`; `/api/admin/exams/sessions/**`; `exam-session-service.ts` | Admin role and school scope; session routes shown do not call `requireSchoolFeature` | `assess.exam.scheduling` |
| Scheduling/conflicts/publish | `/api/admin/exams/sessions/**/scheduler/**`, `conflicts/**`, `publish/**`; `exam-smart-scheduler-service.ts`, `exam-publish-service.ts` | Role authorization is present; subscription coverage is not uniform | `assess.exam.scheduling` |
| Venues/invigilation | `/api/admin/exams/venues/**`, `/invigilators/**`; `exam-venue-service.ts`, `exam-invigilator-service.ts` | Admin/teacher role and school scope; premium guard not consistently visible | `assess.exam.invigilation` |
| Teacher exam operations | `/api/teacher/exams/**`; `exam-teacher-service.ts` | Assigned duties and school scope are domain-controlled | Read/acknowledge may be Assess; basic marks remain Core; exact split requires approval |
| Leo examination draft | `src/lib/leo/examinations-draft-shared.ts` and examination Leo routes | Draft-only rule is explicit; legacy entitlement helper/key remains | `assess.ai.governed` plus role/usage guard |
| Leo scheduling advisory | `src/lib/leo/exam-scheduling-advisory-shared.ts` | Uses legacy entitlement path | `assess.ai.governed` plus `assess.exam.scheduling` |
| Konect scanner | `/api/konect/v1/admin/assess/scanner/**`; `script-submission-service.ts` | Scanner context is school-admin-only and uses broad examinations gate | `assess.konect.scanning`, `assess.paper.qr`, and storage/provider policy |
| CBT/OMR/digital marking | No focused implementation found | No current route/service contract established | New premium surfaces must be added only after the shared result boundary exists |

### Route registry drift confirmed

The route registry lists `/admin/assessments/examinations` and `/admin/assessments/question-bank` (`src/lib/subscriptions/route-registry.ts:98-110`), while the actual pages are under `/admin/examinations` and `/admin/question-bank`. The API registry lists `/api/admin/question-bank` (`src/lib/subscriptions/api-registry.ts:229-235`), while the actual question-bank route is `/api/question-bank`.

This is not merely a navigation issue: static entitlement audits and page/API enforcement can disagree about the actual surface. Registry reconciliation is a prerequisite to enabling commercial gates.

### Server-action rule

Every server action or domain service that can mutate a premium artifact must receive an authenticated school context and enforce:

```text
tenant membership -> role/permission -> product grant -> capability grant
-> lifecycle/usage -> entity scope -> state/version invariant
```

Page visibility and client-side locked UI are advisory only. A direct API call, server action invocation, background job, or internal service call must receive the same authoritative decision.

## 7. Authorization and enforcement model

### Layered decision contract

The target decision should return a structured result, not only a boolean:

```text
EntitlementDecision {
  allowed: boolean
  product: school_os | assess
  capability: canonical key
  schoolId: string
  membershipRole: role
  accessMode: full | pilot_limited | grace | restricted_read_only | suspended
  limit: number | null
  remaining: number | null
  reasonCode: stable denial code | null
  entitlementVersion: string
}
```

The decision must be calculated server-side from the active school membership and school subscription/product grants. It must not use a stale `User.role` or `User.schoolId` as the new tenant authority; the repository’s canonical identity direction is the membership resolver stack described in the supplied repository guidance.

### Role matrix

| Role | School OS Core | Assess Premium |
|---|---|---|
| School admin | Configure plans, marks, reports, approval/release, and core school records | Configure premium workflows, publish sessions, assign invigilators, review/finalize premium evidence when capability grant exists |
| Teacher | Create permitted assessment items, enter marks, submit subject results, operate assigned homeroom/report workflow | Author/mark/invigilate only where role permission, assignment, and capability grant permit |
| Bursar/billing owner | Only explicitly allowed academic reads, not assessment mutation by default | No premium assessment mutation unless separately granted by role policy |
| Parent | Released report/results and authorized published academic information | No authoring, marking, scheduling, scan, or unreleased evidence |
| Student | Own released results and permitted exam timetable/delivery | Own assigned delivery/attempt only when a future CBT contract grants it; never other students’ data |
| Platform admin/operator | Subscription/product administration and support tools, subject to platform authorization | Does not inherit ordinary school-teacher/admin data access without an explicit support path and audit |

The existing `FEATURE_DEFINITIONS.allowedForRoles` and `role-entitlement-rules.ts` are useful foundations, but role rules must be applied in addition to product and tenant grants rather than treated as a substitute for them.

### Tenant and data isolation requirements

- Every read/write query must include the active `schoolId` or derive it from a verified scoped entity.
- IDs supplied by clients must be validated before `ObjectId` construction.
- A paper, session, question, script submission, attempt, result, and evidence reference must be checked against the active school before any provider or storage operation.
- A class-group/subject/period scope must be revalidated at mutation time; a previous page load is not sufficient.
- Cross-school identifiers must return a non-disclosing not-found or authorization response according to the established API policy.
- Premium provider callbacks must use signed/provider-authenticated context plus an idempotency key and must not trust school IDs supplied only in the body.

## 8. Subscription lifecycle contract

Product lifecycles must be independent. An Assess expiry must not suspend School OS Core, and a School OS restriction must not silently grant or preserve Assess Premium.

| State | School OS Core | Assess Premium | Unfinished premium work |
|---|---|---|---|
| No Assess entitlement, active School OS | Core read/write according to School OS grant | Deny premium starts and premium mutations; allow only truthful empty/upgrade/read states | No premium artifacts should exist unless grandfathered or imported; any legacy artifact is read-only/audited |
| Active Assess | Core remains available; Assess capabilities follow grants, role, and limits | Full entitled access | Normal operation, with all finalization and audit rules |
| Trial/pilot Assess | Core follows its own grant | Only explicitly enabled Assess capabilities; usage and end date enforced | Preserve artifacts; do not interpret pilot as full premium |
| Assess past due/grace | Core unaffected if its own product remains active | Recommended: permit inspection and narrowly defined completion/reconciliation of already-started work; deny new premium starts and new expensive reservations | Preserve drafts, attempts, scans, marks, and evidence; do not delete or silently invalidate them |
| Assess cancelled/expired after grace | Core unaffected if active | Premium writes, new attempts, new scans, and new marking sessions denied; authorized audit/export/read policy remains | Freeze safely, preserve evidence, and expose a resumable/reconciliation state after renewal |
| School OS restricted read-only, Assess active | Core reads/historical snapshots allowed; Core writes follow School OS lifecycle policy | Assess operations that depend on Core entities must fail closed if required Core mutation/read authority is unavailable | Preserve all premium records; no orphan writes or hidden retries |
| School suspended | No ordinary school reads/writes except explicitly allowed billing/support paths | Deny premium operations | Preserve records and provider receipts; no deletion as a side effect of suspension |
| User lacks role/permission | Deny mutation; permit only role-authorized reads | Deny premium operation even if school is entitled | Do not expose hidden evidence or cross-role drafts |
| Cross-school request | Deny without leaking entity existence | Deny | Do not mutate or reconcile using caller-provided foreign-school IDs |
| Missing/inconsistent entitlement data | Core follows an explicit safe fallback only if the Core grant is independently verified; otherwise deny writes | Fail closed for premium writes and expensive usage; return stable diagnostic/audit reason | Preserve artifacts and retry only after entitlement data is repaired |

### Historical access rule

Historical marks, finalized subject results, released report cards, approval logs, and retention-required evidence remain available according to School OS authorization and retention policy. A premium expiry is not a data deletion event.

### No silent discard rule

The system must not discard or overwrite unfinished CBT attempts, scan pages, provider receipts, digital marks, moderation decisions, or correction history because an entitlement expired. Each artifact needs an explicit state such as `paused`, `frozen_pending_entitlement`, `awaiting_reconciliation`, or `completed`, with an audit event explaining the transition.

## 9. Canonical result-integration design

### Core manual and examination marks

The core flow should remain:

1. Resolve the active school, period, class group, subject, assessment plan, and grading policy.
2. Create or select an `AssessmentItem` with a valid component/source classification.
3. Record an `AssessmentScore` for the authorized student with `maxScoreSnapshot`, score status, actor, and audit metadata.
4. Calculate and submit a `SubjectResult` using the active policy and source item IDs.
5. Compile and approve `StudentReportCard` snapshots through `ReportCardRun`.

Basic examination marks are a source of assessment scores; they are not a separate premium result engine.

### Premium result handoff

CBT, OMR, Konect, and digital marking should all terminate at one proposed domain boundary, for example:

```text
finalizeAssessmentEvidence(input) -> AssessmentResultReceipt
  -> validate school/student/period/subject/item scope
  -> validate provider/source identity and evidence
  -> validate grading policy/max-score snapshot
  -> enforce idempotency and expected version
  -> create/update canonical AssessmentScore(s)
  -> append provenance/audit event
  -> return canonical result references
```

The name is illustrative; no implementation is authorized in REA-00B.

### Required provenance fields

Before a premium delivery runtime is implemented, the integration contract should carry at least:

- `schoolId`, `academicPeriodId`, `classGroupId`, `gradeId`, and `subjectId`;
- canonical `studentId` and canonical `assessmentItemId` or a validated external-to-canonical item mapping;
- source type (`cbt`, `omr`, `konect`, `digital_marking`, or another approved source);
- source/provider name, source artifact/run/attempt ID, and immutable evidence references;
- score, maximum score snapshot, grading-policy/version reference, and calculation context;
- source result version and correction/revision number;
- idempotency key and receipt/finalization timestamp;
- actor/provider identity, review/finalization actor, and audit correlation ID;
- whether the result is provisional, reviewed, finalized, corrected, or rejected.

### Idempotency and versioning requirements

- Replaying the same provider result must return the same canonical receipt and must not create duplicate scores or audit effects.
- A different result version must be rejected or create an explicit correction revision; it must never silently overwrite a finalized result.
- Finalization must use an atomic expected-state/version predicate. The current score-lock precheck/bulk-write sequence is not sufficient (`src/lib/academics/assessment-engine/assessment-score-service.ts:148-215`).
- A correction must preserve the original source result, actor, time, reason, and before/after values.
- Result finalization must be safe under retries, provider timeouts, duplicate callbacks, and concurrent approval/release.
- Report-card compilation must consume the resulting canonical `SubjectResult`; premium code must never update `StudentReportCard` directly.

### Corrections after report release

A correction after submission or report release must follow an explicit policy:

1. identify the affected canonical score/result and prior snapshot;
2. require the correct role and correction reason;
3. append a correction audit event and new result version;
4. mark affected report runs/snapshots for controlled re-compilation or correction notice;
5. never mutate historical evidence in place without an audit trail;
6. require re-approval before a corrected report becomes visible if school policy requires it.

The existing report release and lock lifecycle provides a foundation, but the atomic lock/version contract must be hardened before premium finalization depends on it.

## 10. Security risks and required corrections

### REA-00B-SEC-01 — mixed broad examination entitlement

**Confirmed:** `assessment.examinations` covers a mixture of pages and API families, while basic Core mark entry and advanced delivery are materially different capabilities.  
**Correction:** introduce product/capability classification and retain a compatibility alias until all routes are mapped. Do not change plan rows in this slice.

### REA-00B-SEC-02 — nested API enforcement gaps

**Confirmed:** question-bank routes use membership/actor checks but no visible canonical feature guard; exam session/scheduler/publish/invigilator routes use `requireSchoolAdmin` without uniform `requireSchoolFeature` calls. The route evidence is in `src/app/api/question-bank/route.ts:17-20,92-115`, `src/app/api/admin/exams/sessions/route.ts:18-21,41-45`, and the nested `/src/app/api/admin/exams/sessions/**` routes.  
**Correction:** inventory every handler, apply the same product/capability decision at each mutation/read boundary, and add direct-request tests with gates enabled.

### REA-00B-SEC-03 — page/API registry drift

**Confirmed:** registry paths do not match actual page/API paths as described in Section 6.  
**Correction:** make route registries generated or verified against the App Router tree; fail CI on stale or duplicate entries before enabling commercial enforcement.

### REA-00B-SEC-04 — enforcement switches can create an open system

**Confirmed:** canonical guards and access mode intentionally pass while environment flags are off (`guards.ts:24-51`, `access-mode.ts:45-49`, `resolve-school-entitlements.ts` module comments).  
**Correction:** retain flags for staged rollout, but add startup/observability checks, an explicit environment policy, and gate-enabled test coverage. A production environment with premium entitlements must not be considered protected while gates are disabled.

### REA-00B-SEC-05 — legacy no-op entitlement helpers

**Confirmed:** legacy helpers return permissive values and Leo examination/scheduling paths still call them.  
**Correction:** replace new calls with a compatibility adapter backed by canonical decisions; instrument legacy calls; remove the adapter only after route coverage and grandfathering are verified.

### REA-00B-SEC-06 — scanner sibling-asset cleanup race

**Confirmed static risk:** `retireSubmissionAssets()` can retire all pending/ready/failed script-page assets for a submission after a losing page-initialization race (`src/lib/konect/script-submission-service.ts:23-40,192-215`).  
**Correction:** retire only the asset created by the failed operation; reserve submission-wide retirement for explicit cancellation/expiry; add concurrent sibling-page tests and provider/storage integration checks.

### REA-00B-SEC-07 — score/result lock race

**Confirmed static risk:** score writes do not include a status/version predicate after the pre-read (`assessment-score-service.ts:148-215`). Subject-result submission has a similar read-before-write shape.  
**Correction:** use conditional/versioned writes, define duplicate-record semantics, and test edit-versus-lock, retry, partial failure, and release races.

### REA-00B-SEC-08 — provider boundary is not yet a canonical result boundary

**Confirmed:** scanner upload storage exists, but focused search did not find OMR recognition, CBT attempts, or digital marking ledgers.  
**Correction:** define the result receipt/provenance/idempotency contract before building any premium runtime or provider adapter.

### REA-00B-SEC-09 — subscription consistency scanner drift

**Confirmed:** `src/lib/subscriptions/consistency-scanner.ts:144-173` compares plan values to `"included"`, while the canonical plan map uses `YES`, `LIMITED`, `OPTIONAL`, and `NO`.  
**Correction:** make the scanner consume the canonical access-level type and test plan/usage consistency for every product grant.

## 11. Safe migration and compatibility plan

### Stage 0 — decisions and inventory

- Approve the Core/Premium capability matrix and the treatment of existing exam authoring/question-bank customers.
- Inventory every actual App Router page, API handler, server action, background function, and domain service.
- Identify current school subscriptions, feature snapshots, overrides, legacy keys, and observed usage without changing them.
- Define which existing Growth/Enterprise/Pilot schools are grandfathered.

### Stage 1 — shadow capability resolution

- Add no-op/read-only resolution in a future implementation slice that computes proposed product/capability decisions alongside current decisions.
- Log differences without denying access.
- Verify school, role, route, plan, and lifecycle combinations.
- Keep existing plan snapshots and legacy aliases intact.

### Stage 2 — registry and compatibility adapter

- Reconcile page/API registries with actual routes.
- Introduce a single compatibility adapter for legacy keys.
- Make new code use canonical product/capability keys only.
- Add explicit grandfather grants rather than silently interpreting a broad key differently for the same school.

### Stage 3 — harden shared result and storage invariants

- Implement atomic score/result state transitions and version checks.
- Fix scanner asset cleanup scope and add concurrent sibling-page coverage.
- Define idempotent premium result receipt and provenance contracts.
- Keep provider and premium runtime work blocked until these contracts pass targeted tests.

### Stage 4 — enforce at boundaries

- Add capability decisions to page layouts, APIs, server actions, background jobs, and domain services.
- Keep API/service enforcement authoritative when frontend gates are disabled or stale.
- Enable shadow telemetry first, then enforce by controlled cohort.
- Return stable denial codes and upgrade/help paths without exposing tenant or assessment evidence.

### Stage 5 — provision Assess independently

- Allow platform operators to provision an Assess product grant for a school without adding unrelated finance, admissions, communications, Learn, or AI capabilities.
- Provision only the minimum academic foundation needed by the approved Assess workflow.
- Ensure standalone Assess schools still use the same identity, membership, class, subject, student, and canonical result contracts.

### Rollback

Rollback must disable new premium enforcement decisions without deleting product grants or assessment records. Existing canonical scores/results/reports remain readable. In-flight premium artifacts remain preserved and marked for reconciliation. Compatibility aliases remain available until all affected schools are migrated or explicitly grandfathered.

## 12. Acceptance-test matrix

The following tests are required before commercial entitlement changes are deployed. They should exist at unit, route/service, and integration levels as appropriate.

| Area | Required cases | Expected result |
|---|---|---|
| Core without Assess | Active School OS school enters CA and exam marks, calculates subject results, compiles/approves/releases reports | Allowed; no Assess grant required |
| Core without Assess | Core parent/student reads released historical results | Allowed under released-snapshot authorization |
| Premium denied | No Assess school opens/POSTs question bank, blueprint, CBT, scheduling, OMR, Konect, digital marking, advanced analytics | Denied with stable premium reason; no mutation |
| Premium allowed | Active Assess school with capability grants performs each granted operation | Allowed only for entitled role/scope |
| Partial grant | Assess school has scheduling but not OMR or CBT | Scheduling allowed; OMR/CBT denied |
| Pilot/trial | Explicitly granted pilot feature works; ungranted feature is denied | No implicit full Assess |
| Expiry/grace | Assess expires while Core remains active | Core continues; premium new starts blocked; in-flight policy is applied and recorded |
| School OS expiry | School OS becomes restricted while Assess remains present | Core lifecycle rules apply; no orphan premium writes requiring unavailable Core data |
| Suspension | School suspended | Ordinary reads/writes blocked according to policy; records preserved |
| Role boundary | Teacher, admin, bursar, parent, student, platform operator each call the same endpoint | Role and product decisions are independent and correct |
| Tenant isolation | School A presents School B paper/session/student/result/provider ID | Denied without cross-school disclosure or mutation |
| Direct API | Call nested API without visiting gated page | Same denial/allow decision as page flow |
| Server action | Invoke builder/action/service directly with an otherwise valid payload | Product, role, tenant, and state checks still run |
| Background job | Retry premium finalization/provider callback after entitlement change | Idempotent, auditable, no unauthorized mutation |
| Registry | Enumerate actual pages/APIs and compare registry entries | No stale/missing/duplicate entitlement path |
| Legacy key | Legacy `ai_leo_copilot`, `examinations`, and `question_bank` paths resolve through compatibility adapter | No new raw-key calls; grandfather behavior explicit |
| Score lock | Concurrent mark edit versus lock/release | Locked/finalized result cannot be overwritten |
| Result finalization | Duplicate provider receipt/retry | Same receipt; no duplicate score/audit effect |
| Correction | Corrected premium result after submission/release | New version, before/after audit, controlled re-approval |
| CBT | Timer, candidate assignment, retry, refresh, duplicate submit, expired attempt | Server-authoritative and idempotent |
| OMR/Konect | Duplicate pages, sibling-page race, failed recognition, reprocessing | Valid pages preserved; recognition reviewable; reconciliation auditable |
| Digital marking | First mark, second mark, moderation, disagreement, finalization | Immutable marking evidence and governed final result |
| Upgrade | Core school activates Assess | Existing Core data remains; granted premium features become available |
| Downgrade | Assess removed while Core remains active | Core data/workflows remain; premium artifacts are preserved/frozen per policy |
| Rollback | Disable new enforcement after a failed rollout | No data deletion; prior authorized Core behavior remains |
| Missing entitlement | Null/malformed subscription, missing product grant, stale feature snapshot | Premium writes fail closed and emit diagnostic/audit event |
| Data compatibility | Existing canonical marks/reports and legacy adapters | Historical results remain readable and unchanged |

### Minimum deployment gate

No entitlement change should be released until the following are green with enforcement enabled in an isolated environment:

- route/API registry verification;
- Core-without-Assess route and service tests;
- premium denial and allow tests for every classified capability;
- direct API and server-action authorization tests;
- tenant isolation tests;
- lifecycle upgrade/downgrade/expiry/rollback tests;
- atomic score/result lock and idempotent result-receipt tests;
- scanner sibling-page concurrency tests;
- existing assessment, examination, subscription, and Konect regression suites.

Signed-in browser, provider, storage, and deployed-runtime verification remain separate release evidence and cannot be inferred from unit/static tests.

## 13. Proposed Architectural Decision Records

### ADR-REA-01 — One canonical academic result engine

Premium assessment products produce validated canonical assessment inputs. `SubjectResult`, `ReportCardRun`, and released report-card snapshots remain shared and authoritative.

### ADR-REA-02 — Product grants are independent

School OS and Assess are independently grantable products. Assess does not implicitly grant unrelated School OS modules, and Assess expiry does not disable active School OS Core.

### ADR-REA-03 — Capability-level entitlement, not route-level entitlement

Basic mark entry, question authoring, delivery, scanning, marking, and analytics receive separate capability decisions. Broad legacy keys are compatibility aliases only.

### ADR-REA-04 — Server boundaries are authoritative

Page gates improve UX, but API routes, server actions, background jobs, and domain services must independently enforce product, capability, role, tenant, lifecycle, usage, and state constraints.

### ADR-REA-05 — Premium evidence is durable and auditable

Entitlement expiry, cancellation, or suspension must not silently delete or overwrite attempts, scans, marks, moderation events, or provider receipts.

### ADR-REA-06 — Finalized result handoff is idempotent and versioned

All premium result sources use a shared finalization contract with provenance, idempotency, expected version/state, correction history, and canonical `AssessmentScore`/`SubjectResult` output.

### ADR-REA-07 — Existing schools migrate by compatibility grant

Existing subscription snapshots and observed customer behavior are preserved through explicit grandfather/compatibility grants. No plan is silently reinterpreted during migration.

## 14. Open product decisions requiring approval

1. Should basic paper authoring remain in School OS Core, or should Core provide only assessment/exam mark entry while existing paper-authoring users are grandfathered?
2. Which current Growth and Enterprise customers use question-bank or exam-session features, and for how long should those capabilities be grandfathered?
3. Is Assess-only provisioning expected to include a minimal student/class/subject foundation, and which Core foundation capabilities are included in its price?
4. During Assess grace, may an already-open CBT attempt or marking session finish, or is it frozen immediately after the grace boundary?
5. What exact retention period applies to raw scan pages, provider evidence, CBT responses, marking events, and moderation history?
6. Which roles may finalize premium results and request post-release corrections?
7. Are parent/student exam timetable reads Core or Assess when the underlying session is premium?
8. Is advanced analytics allowed to read provisional data, or only finalized/approved results?
9. What are the external provider contracts, signature requirements, retry windows, and reconciliation ownership for OMR/Konect/CBT providers?
10. What subscription renewal boundary ends grandfathered legacy access?

These decisions must be approved before altering plan matrices, entitlement keys, or customer access.

## 15. REA-00C readiness recommendation

**Recommendation: ready for REA-00C as a scoped entitlement-boundary and shared-result hardening slice; not ready for premium runtime delivery or commercial enforcement rollout.**

REA-00C should begin with:

1. approval of the Core/Premium matrix and grandfather policy;
2. a complete generated route/API/server-action inventory;
3. correction of registry drift and the legacy entitlement adapter boundary;
4. atomic score/result locking and scanner asset cleanup hardening;
5. the canonical premium result receipt/provenance/idempotency contract;
6. gate-enabled Core-without-Assess and premium-denial tests;
7. a shadow-mode migration plan with rollback evidence.

It should not begin CBT, OMR recognition, digital marking, or production subscription enforcement until those contracts and tests are complete. No production readiness or release approval is claimed by this report.

## 16. Verification record

The report was created under the REA-00B hard constraints:

- no application-code changes;
- no database migrations or data operations;
- no subscription or permission changes;
- no REA/ECC installation;
- no production-system access;
- no commit or push;
- no new premium feature implementation.

The preceding REA-00A report records the broader automated verification results and their limitations. This report relies on that evidence where stated and independently checked the relevant subscription, route, assessment-engine, examination, Leo, scanner, and lifecycle source paths. It does not claim signed-in, provider, storage, native-device, or deployed-runtime verification.
