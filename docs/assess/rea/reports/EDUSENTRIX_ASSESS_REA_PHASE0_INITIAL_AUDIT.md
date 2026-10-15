# EduSentrix Assess — REA Phase 0 Initial Source Audit

**Date:** 14 October 2026  
**Source:** `edusentrix-web-nextjs copy.zip` (read-only examination of uploaded snapshot)  
**Status:** Preliminary source inspection; **not** a production-readiness certification, full security assessment, or executable integration-test report.

## Executive decision

Build Assess as a distinct **commercial and UX product** within the existing EduSentrix Web repository, over the **existing canonical academic assessment, scoring and report-card backbone**. Preserve basic exam operations, continuous-assessment/classwork marks, exam-mark entry, and basic report cards for School OS customers **without** Assess. Add independently controlled premium Assess entitlements. Keep Konect as the mobile capture client and use supported APIs rather than creating a second scanner backend.

Do **not** start by splitting databases, cloning models, or rewriting the existing assessment engine.

## 1. Inventory and basis

The uploaded snapshot contains approximately **310 `page.tsx` screens**, **1,084 `route.ts` API handlers**, **267 model `.ts` files**, and **179 `.test.ts` files** (file counts, not assertions or successful tests). It includes Next.js App Router, TypeScript, Mongoose/MongoDB, Clerk, Tailwind, subscription management, private storage and Inngest/background processing dependencies.

* Repository agent instructions: `AGENTS.md`.
* Main package: `package.json` (Next 16.0.10 in package range, React 19 project conventions, Mongoose, Clerk).
* Existing assessment history: `docs/ASSESSMENT_ENGINE_IMPLEMENTATION_MAP.md` (24 slices documented complete, but completion claims **not** independently runtime-verified here).
* Exam scheduling integration: `docs/EXAM_ENGINE_INTEGRATION_NOTES.md`.
* Theme program: `docs/EDUSENTRIX_LIGHT_DARK_THEME_MIGRATION_MASTER_SPEC.md` (tracker says 130/310 pages complete; status snapshot, not independently visually validated).
* REA Assess master planning files from earlier discussion (`EDUSENTRIX_ASSESS_MASTER_SPEC.md`, `12_ROADMAP_PHASES_AND_SLICES.md`) are not present in this extracted web source. They should be brought into the appropriate documentation authority and reconciled; do not assume they are tracked in this repo already.

## 2. Reusable foundations: evidence

| Domain | Found in snapshot | Assessment |
|---|---|---|
| Academic scoring | `src/models/AssessmentItem.ts`, `AssessmentScore.ts`, `SubjectResult.ts`, `AssessmentPlan.ts`; `src/lib/academics/assessment-engine/*` | Real implementation exists; preserve as School OS canonical scoring path. |
| Marks entry | `src/app/api/teacher/marks/scores/bulk/route.ts`, `.../subject-results/submit/route.ts`, `src/app/(app)/teacher/marks/*` | Existing route/service workflow with role permission checks. |
| Report cards | `src/models/ReportCardRun.ts`, `StudentReportCard.ts`, `src/lib/academics/reporting/*`, `src/app/api/admin/reports/report-runs/*` | Compilation, review/approval and release foundations exist. |
| Exams and authoring | `src/models/ExamPaper.ts`, `ExamQuestion.ts`, `ExamPaperSection.ts`, `ExamPaperReview.ts`; `src/lib/examinations/*` | School-owned paper/question management, review and PDF services present. |
| Question bank | `src/models/QuestionBankItem.ts`, `src/app/api/question-bank/*`, `src/lib/examinations/question-bank-service.ts` | Search, creation, reuse and academic validation present. |
| Exam scheduling | `src/models/ExamSession.ts`, `ExamTimetableEntry.ts`, invigilator/conflict models, `src/lib/exams/*` | Scheduling, invigilation, readiness, conflict management present. |
| Konect scanning backend | `src/models/ScriptSubmission.ts`, `src/lib/konect/script-submission-service.ts`, `src/app/api/konect/v1/admin/assess/scanner/*` | Draft/page-upload/finalize/cancel and receipt foundations present. This is **not** full OMR/digital marking. |
| Private scan storage | `src/lib/storage/kinds.ts`, `key-builder.ts`, `access-policy.ts`, `service.ts` | `assess_script_page` asset kind and scoped upload policy present. |
| Subscription system | `src/lib/subscriptions/*`, `src/models/SchoolSubscription.ts`, `SubscriptionAddOn.ts` | Feature registry/plan access, resolver and API/page guards present, but requires redesign for Assess commercial separation. |

**Not found in this snapshot as dedicated production domain/runtime implementations:** `AssessmentDelivery`, `AssessmentAttempt`, `AssessmentResponse`, a CBT player and server-authoritative attempt timer, OMR recognition pipeline, digital question-level marking/moderation ledger, advanced item analytics. File-name and code searches cannot prove absolute absence of every similar function; this is a focused discovery classification.

**Important scope limitation:** This archive contains **Web** source only. The Konect **native mobile repository** and its real-device behaviour were not inspected.

## 3. Highest-priority architecture conflicts and risks

### P0 — School OS basic assessment entitlements conflict with latest product decision

* `src/lib/subscriptions/plan-entitlements.ts`: `starter` has `ASSESSMENT_EXAMINATIONS: NO`, `ASSESSMENT_QUESTION_BANK: NO`; `growth` uses `LIMITED` for both; `enterprise` uses `YES`; `pilot` uses `OPTIONAL`.
* `src/lib/subscriptions/feature-keys.ts` currently exposes broad `assessment.examinations` and `assessment.question_bank` feature names, not a distinct suite of premium Assess entitlement keys.
* `src/models/SubscriptionAddOn.ts` supports usage credits/seats/storage, but no Assess-suite subscription type in its current `AddOnType` union.

**Required:** Define a **capability-by-capability** School OS core vs Assess premium matrix. Preserve basic marks/report cards and agreed basic exam actions for every School OS plan. Define product-level Assess entitlement and specific gated workflows. Decide subscription representation without conflating Assess purchase with an unrelated upgrade from Starter to Growth/Enterprise.

### P0 — Entitlement enforcement consistency must be audited

* `src/lib/subscriptions/guards.ts` short-circuits feature checks unless **both** `SUBSCRIPTION_ENFORCEMENT_ENABLED` and `SUBSCRIPTION_API_GATES_ENABLED` are `true`.
* `src/lib/subscriptions/require-page-feature.ts` has a separate `SUBSCRIPTION_FRONTEND_GATES_ENABLED` switch. This may be an intentional staged rollout mechanism, but production expectations require explicit verification.
* `src/app/api/question-bank/route.ts` calls `requireQuestionBankActor()` (school membership authorization) but has no explicit `requireSchoolFeature(ASSESSMENT_QUESTION_BANK)` invocation. `src/lib/examinations/question-bank-service.ts` requires membership and validates school refs; it does not itself perform a subscription entitlement check.
* `src/lib/subscriptions/api-registry.ts` lists `/api/admin/question-bank` whereas the actual examined route is `/api/question-bank`. `src/lib/subscriptions/route-registry.ts` lists `/admin/assessments/examinations`, whereas an actual screen is `/admin/examinations`. Registry drift means the documentation/audit registry cannot automatically be assumed complete.

**Required:** Map **every** protected page, API method, server action and mobile route to its correct role permissions and premium capability; prove gating server-side under configured flags with tests for Starter, Growth, Enterprise, standalone Assess, expired Assess and no Assess.

### P0 — Potential scanner asset-retirement scope problem under concurrency

In `src/lib/konect/script-submission-service.ts`, `initializePage` presigns an asset and attempts an atomic page insertion. If the insertion fails, it calls `retireSubmissionAssets(schoolId, submissionId)`. That helper marks **all** matching `assess_script_page` assets for the submission deleted, not only the uncommitted asset. In a concurrent duplicate page request, this could retire the valid winning page(s). A similar broad cleanup occurs when `completePage` detects a closed submission.

**Required:** Limit failure cleanup to the specific asset attempted; implement reconcile/sweeper logic separately, with concurrent page initialization/finalization/retry tests against Mongo and mock+real R2 appropriately. Do not change or deploy this without controlled tests and backup/rollback planning.

### P0 — Potential mark-lock race during bulk updates

`src/lib/academics/assessment-engine/assessment-score-service.ts` reads existing score statuses and rejects edits to `locked` scores **before** `AssessmentScore.bulkWrite(...)`. The subsequent update filter uses schoolId, assessmentItemId and studentId but not existing status/version. A concurrent lock after precheck could permit a stale update unless a further invariant outside this service prevents it.

**Required:** Test concurrent edit-vs-lock, duplicate student IDs in one batch, retry semantics and partial bulk-write error handling. Consider conditionally versioned updates, DB-enforced state transitions, or an equivalent robust design before Assess relies on this score ledger for official marks.

### P1 — Auth model for scanner roles is initially narrower than planned

`scannerContext()` in `src/lib/konect/script-submission-service.ts` currently calls `requireSchoolAdmin()` and gates on broad examinations entitlement; scanners/teachers as independent Assess roles are not represented here. This may be appropriate for current admin-only mobile groundwork but not the target premium Assess scanner role model.

### P1 — UI/theme modernization still in progress

`src/providers/theme-provider.tsx` sets default light mode and stores `edusentrix-theme`. The theme master tracker shows **130/310 pages complete**, with major teacher/parent/student/platform areas still pending in the tracker. Treat this as the uploaded snapshot's **documented** state, not validated screen-by-screen correctness. New Assess UI should reuse tokens/components and avoid a second design framework.

## 4. Target product boundary (proposed, needs approval)

**EduSentrix School OS core, regardless of Assess subscription:**
- Basic exam management and a simple method to define/record examination marks.
- Classwork and continuous-assessment item and mark entry.
- Grading policies necessary for ordinary academic records, subject results and basic report cards.
- Access to legitimate historical academic data and ordinary correction/release policies.

**Premium EduSentrix Assess:**
- Advanced bank/blueprints/approval/variants; CBT runtime and invigilation; signed paper identity and OMR; Konect scan workflows; digital marking/moderation; advanced item analysis and AI-assisted workflows; standalone integration APIs where contracted.

**Shared canonical services:**
- Identity/tenant/school/roster/academic-period/subjects, rubric/scoring/result contracts, audit, private storage, report-card contribution. Premium Assess returns finalized results to the same canonical result/gradebook pipeline as core marks, never directly into report-card snapshots.

Avoid classifying every existing `ExamPaper`/question bank feature as premium until user-level core examination behaviours have been precisely mapped: we must avoid unintentionally paywalling a pre-existing operation a school relies on.

## 5. Proposed REA-driven implementation sequence

1. **REA-00A Source-of-truth inventory:** map existing models, routes, services, permissions, subscriptions, background jobs, storage, tests; record exact implementation status as implemented / incomplete / unverified / absent.
2. **REA-00B Commercial capability and entitlement matrix:** map core vs premium UI and API operations; upgrade, downgrade, expiry, standalone and no-subscription behaviour. Add regression matrix for School OS academic continuity.
3. **REA-00C Hardening investigations:** reproduce and correct scan-cleanup concurrency, score-lock races and route/entitlement drift in isolated test environments; avoid unrelated refactors.
4. **REA-00D Domain contracts:** approved question/paper versioning, immutable delivery snapshot, candidate assignment, attempt/timing, response versioning, mark ledger, result handoff, audit and interoperability contracts.
5. **REA-01 Reference studies:** study permitted competitor workflows (CBT, paper, scanning, marking), QTI/accessible assessment standards, error recovery and performance expectations; label evidence as observed/documented/inferred.
6. **First sellable vertical release:** author/approve → deliver a CBT or approved paper exam → mark deterministically/manually → finalize and hand off to the canonical result pipeline; preserve basic School OS pathways throughout.
7. **Advanced paper delivery release:** QR/OMR/scan review, multi-page written scripts, digital marking/moderation, operational reliability on real devices.
8. **Advanced insight/AI:** analytics and governed AI after human marking, evidence and moderation work reliably.

## 6. Verification status and limitations

**Performed in this audit:** ZIP extraction and source inspection; repository inventory and keyword searches; reading targeted models, services, subscription guards/registries, route handlers, theme plan, agent instructions and documented implementation history.

**Not performed:** `npm ci`, TypeScript compile, ESLint, test suite, Next build, database migrations, Mongo transaction tests, R2 integration, Clerk auth integration, security penetration testing, production environment flags validation, device tests, user acceptance tests, latency/load benchmarks, or native Konect inspection. The ZIP has no `node_modules`; no installed dependencies were assumed. Static review findings need executable verification and must not be described as proven incidents.

## 7. Source paths checked / evidence index

* `AGENTS.md`
* `package.json`
* `src/lib/subscriptions/{feature-keys,plan-codes,plan-entitlements,guards,resolve-school-entitlements,require-page-feature,api-registry,route-registry}.ts`
* `src/models/{SubscriptionAddOn,ExamPaper,QuestionBankItem,AssessmentPlan,AssessmentScore,SubjectResult,StudentReportCard,ScriptSubmission}.ts`
* `src/lib/examinations/{question-bank-service,builder-service,exam-paper-pdf}.ts`
* `src/lib/academics/assessment-engine/{assessment-score-service,subject-result-service,teacher-gradebook-service}.ts`
* `src/lib/academics/reporting/{report-card-run-service,report-card-approval-service}.ts`
* `src/lib/konect/script-submission-service.ts`
* `src/app/api/{question-bank,admin/examinations,teacher/marks/scores/bulk,teacher/marks/subject-results/submit}/route.ts`
* `src/app/api/konect/v1/admin/assess/scanner/*`
* `src/lib/storage/{kinds,access-policy,key-builder,service}.ts`
* `src/middleware.ts`, `src/providers/theme-provider.tsx`
* `docs/{ASSESSMENT_ENGINE_IMPLEMENTATION_MAP,EXAM_ENGINE_INTEGRATION_NOTES,EDUSENTRIX_LIGHT_DARK_THEME_MIGRATION_MASTER_SPEC}.md`

## 8. Recommended next action

In the **real Cursor repository**, execute a read-only REA-00A fact-finding audit with Codex, comparing actual branch/commit and installed environment to this archived snapshot. Do not install ECC/REA into production blindly, refactor score or scan code, change plan entitlements, or start the Assess shell before the entitlement contract and remediation plan are approved. Return a source-linked implementation ledger and executable verification results to ChatGPT for independent review.
