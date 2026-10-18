# EduSentrix Assess — REA-00C1 Foundation Reliability Report

**Scope:** Shared academic foundation reliability hardening  
**Branch:** `feat/assess-rea-foundation`  
**Baseline HEAD:** `9da217565eda468c12a106517b4f7a21d1881b0c` (`revamp bulk uploads`)  
**Verification date:** 2026-10-15 (Africa/Accra)  
**Status:** Locally verified with explicit follow-up and environment limitations

## 1. Git baseline and scope

At the start of REA-00C1, the active branch was `feat/assess-rea-foundation` at the baseline HEAD above. The working tree already contained untracked REA reports and the protocol document:

- `docs/assess/rea/REA_ENGINEERING_PROTOCOL.md`
- `docs/assess/rea/reports/REA_00A_REPOSITORY_VERIFICATION.md`
- `docs/assess/rea/reports/REA_00B_CAPABILITY_ENTITLEMENT_ARCHITECTURE.md`

Those files were preserved. No commits, pushes, migrations, subscription changes, deployment actions, global configuration changes, or production-provider operations were performed.

## 2. Confirmed root causes

### Workstream A — scanner assets

`initializePage()` created a private storage asset before conditionally registering the page in `ScriptSubmission`. When two operations attempted the same page number, the losing database update called `retireSubmissionAssets()`, which marked every pending/ready/failed asset for the submission as deleted. A losing operation could therefore retire a valid sibling page or the winning operation's asset.

The same submission-wide cleanup was also used from a non-lifecycle page-completion failure path. Submission-wide retirement is appropriate for explicit cancellation and expiry, but not for a failed individual page operation.

### Workstream B — score writes

`bulkUpsertAssessmentScores()` read existing status and rejected locked rows before constructing an unordered, unconditional upsert. A concurrent lock could be written after that read and before the bulk write, allowing a stale writer to overwrite the locked score. Conditional upserts could also collide with the unique item/student index when a locked row already existed or another writer inserted the row concurrently.

Subject-result submission had the same read-before-write shape: it precomputed locked students, then used an unconditional upsert. Report-card approval and release already use state-filtered transitions and were not changed.

## 3. Files changed

Application code:

- `src/lib/konect/script-submission-service.ts`
  - Added school/submission/asset-scoped retirement.
  - Non-lifecycle page failures now retire only the asset created by that operation.
  - Kept submission-wide retirement for explicit cancellation and expiry.
  - Added test-only dependency seams without changing route behavior.
- `src/lib/storage/service.ts`
  - A failed presign provider operation now marks its owned pending asset `failed` with `presign_failed`.
  - If reconciliation itself fails, an `AggregateError` is raised rather than silently leaving the operation apparently successful.
- `src/lib/academics/assessment-engine/assessment-score-service.ts`
  - Added a conditional unlocked-write predicate.
  - Rejects duplicate student IDs before writes.
  - Performs conditional per-record writes, retries concurrent non-locked duplicate-key races without upsert, and reports partial/locked failures explicitly.
- `src/lib/academics/assessment-engine/subject-result-service.ts`
  - Added school-scoped conditional status predicates to subject-result submission.
  - Handles concurrent insert duplicate keys and reports a stale lock as a `409` conflict.

Tests added or updated:

- `tests/konect/admin-integration-persistence.test.ts`
- `tests/assessment-engine.assessment-mutations.test.ts`
- `tests/assessment-engine.score-atomicity.integration.test.ts`

## 4. Regression tests demonstrating the original failures

The new tests demonstrate the previously unsafe boundaries:

- Two concurrent initializations for one page result in one persisted page, one deleted losing asset, and preservation of an existing sibling asset.
- Asset retirement with the wrong school does not modify the asset.
- A failed presign provider call marks only its owned asset failed instead of leaving it pending.
- A stale score writer receives zero matched writes after the score is locked and cannot change the score.
- The unique item/student identity index rejects duplicate score records.
- Duplicate student IDs in one bulk request are rejected before database writes.
- Existing scanner finalization, cancellation, expiry, ownership, and private-asset isolation remain covered.

## 5. Corrections and guarantees

### Scanner guarantees

- Failed page registration retires only the operation-owned asset.
- Valid sibling pages are not selected by failed-operation cleanup.
- Cancellation and expiry retain explicit submission-wide retirement behavior.
- Cleanup queries require school, asset kind, script-submission association, and asset ID where operation-scoped.
- Storage presign failures reconcile the created asset to `failed` and surface reconciliation failure.
- Submission and asset reads/writes retain school scoping.
- The existing private-storage abstraction remains the only storage boundary; no direct R2 shortcut was introduced.

### Academic score guarantees

- A score update must match the expected score identity and remain unlocked at the database write.
- A stale writer cannot overwrite a score locked after its pre-read.
- Duplicate student IDs are rejected before any bulk mutation.
- Concurrent insert duplicate-key races retry as non-upsert conditional updates.
- Locked or unmatched writes return an explicit conflict and state how many earlier records may already have been written.
- Existing score validation, teacher scope resolution, school scope, and audit call sites remain in place.
- The existing unique `(assessmentItemId, studentId)` index remains authoritative against duplicate score records.

### Subject-result guarantee

- Subject-result submission now uses the active school/period/class/subject/student identity plus an allowed lifecycle status as its conditional write predicate.
- A result that becomes submitted, approved, or locked after the read is not overwritten.
- A concurrent first insert is reconciled through a non-upsert retry.
- Report-card approval/release behavior was inspected and not broadened.

## 6. Verification commands and actual results

| Command | Result |
|---|---|
| `npx eslint src/lib/storage/service.ts src/lib/konect/script-submission-service.ts src/lib/academics/assessment-engine/assessment-score-service.ts src/lib/academics/assessment-engine/subject-result-service.ts tests/konect/admin-integration-persistence.test.ts tests/assessment-engine.assessment-mutations.test.ts tests/assessment-engine.score-atomicity.integration.test.ts` | PASS |
| `node --test --import tsx tests/assessment-engine.assessment-mutations.test.ts` | PASS — 11/11 |
| `node --test --import tsx tests/assessment-engine.score-atomicity.integration.test.ts` | PASS — 2/2 Mongo-backed tests |
| `node --test --import tsx tests/konect/admin-integration-persistence.test.ts` | PASS — 11/11 Mongo-backed tests |
| `node --test --import tsx tests/assessment-engine.*.test.ts` | PASS — 83/83 tests, 41 suites |
| `npm run build` | PASS — production build compiled and generated all routes. Existing baseline-browser-mapping and middleware deprecation warnings remained. The build connected to the configured `edusentrix-dev` MongoDB runtime while generating pages; this is not production verification. |
| `npx tsc --noEmit --pretty false` | FAIL — pre-existing repository diagnostics remain in assessment fixtures and other unrelated files. No diagnostics matched the changed application source files; changed test fixtures still expose existing `AssessmentPlanDTO`/visibility typing drift. |
| `git diff --check` | PASS |

An initial package-script test attempt using `npm test -- --test-name-pattern=...` expanded the repository-wide test glob instead of isolating the requested files. It encountered the sandbox's MongoMemoryServer `listen EPERM` restriction and unrelated failures. The direct focused commands above were then run with the required elevated local test boundary and are the authoritative results for this slice.

## 7. Security and tenant-isolation findings

- Scanner submission ownership remains checked by `schoolId` and `submittedByUserId`.
- Scanner asset retirement requires the correct school, storage kind, script-submission association, and asset ID.
- Score reads, writes, student validation, and audit metadata retain `context.schoolId` and teacher/class/subject scope.
- Subject-result submission retains school-scoped identity in its conditional predicate.
- No direct provider operation or production storage operation was executed.
- No cross-school access was observed in the focused scanner integration suite.

## 8. Remaining risks and unverified scenarios

1. `src/lib/academics/assessment-engine/studio-to-gradebook-service.ts` remains a separate `AssessmentScore.bulkWrite()` writer. It still needs a follow-up shared conditional-write hardening pass before every School OS score ingress can claim the same atomicity guarantee.
2. Subject-result submission has conditional coverage in source and existing pure suite coverage, but a dedicated real-database concurrent subject-result integration test is still outstanding.
3. R2/provider behavior was tested through the existing abstraction with a failing fake port, not against a live provider. Actual object deletion, recovery, credentials, and provider outage behavior remain unverified.
4. Signed-in browser, native-device, deployed-runtime, production database, and production storage verification were not performed.
5. Repository-wide TypeScript remains red from pre-existing diagnostics and should be separated from this slice's focused validation in any release decision.
6. The build used the local `.env.local` runtime configuration and connected to `edusentrix-dev`; environment isolation should be confirmed before any provider or database smoke test.

## 9. Regression status

**Focused REA-00C1 regression status: PASS.** Scanner persistence/isolation, storage-failure reconciliation, score atomicity, duplicate identity protection, and the existing academic assessment suite passed locally.

**Repository-wide delivery status: NOT CLEAN.** TypeScript has pre-existing failures, the Studio-to-gradebook writer remains a follow-up atomicity surface, and provider/deployed-runtime evidence is absent.

## 10. Readiness recommendation

Recommend **local engineering review and independent ChatGPT review**, not production or release approval. The bounded scanner and primary assessment-score corrections are locally verified and preserve the School OS result path. Before the next reliability slice or any premium Assess reliance, review the Studio-to-gradebook writer, add subject-result concurrency coverage, and separately authorize provider/storage and signed-in runtime verification.

REA-00C1 stops here. REA-00C2 and premium feature development were not started.
