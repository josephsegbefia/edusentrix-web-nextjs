# EduSentrix Assess — REA-00C1B-A1
## Studio Gradebook Consistency and Regression Corrections

**Date:** 2026-10-15 (Africa/Accra)
**Status:** Bounded corrective implementation complete; independent review required
**Branch:** `feat/assess-rea-foundation`
**Scope:** Existing School OS Studio-to-gradebook consistency only
**Excluded:** Premium Assess delivery, publication, handoff receipts, entitlement changes, migrations, new indexes and provider operations

## 1. Result

The reviewed Studio gradebook-link path now protects the linked `AssessmentItem` lifecycle at the database write boundary, validates the complete selected graded-submission set before score mutation, preserves the existing conditional locked-score writer, and records partial score-write outcomes with an explicit audit action and operation metadata.

The correction preserves the existing Core rule that one `Submission` exists per homework/student. The current unique `{ homeworkId, studentId }` index was verified; no alternate grading or aggregation policy was introduced.

This slice does not provide durable exactly-once effects or transactional multi-document consistency. Those remain REA-00C1B-B concerns.

## 2. Confirmed findings

### 2.1 AssessmentItem race

`addStudioHomeworkToGradebook()` performed a mutability pre-read, then updated an existing item with an `_id`-only `AssessmentItem.updateOne()` filter. If the item transitioned to `locked` or `archived` after the pre-read, the stale Studio operation could still update it.

### 2.2 Late score validation

Score bounds were checked inside the score-write loop. A later invalid submission could therefore return HTTP 400 after earlier scores had already been saved, creating a misleading ordinary validation failure and a partial mutation without a conflict response.

### 2.3 Partial audit ambiguity

The previous partial-write branch returned HTTP 409 without recording a corresponding Studio audit event. The only success action, `studio.gradebook_linked`, was emitted only after all writes succeeded, but there was no explicit audit representation for a partial conflict.

### 2.4 Duplicate graded submissions

`Submission` already enforces one record per `{ homeworkId, studentId }` with a unique index. Studio import selects the existing record when it is `status: "graded"` and has a non-null score. A disposable Mongo test confirmed a second record for the same homework/student is rejected with duplicate-key error `11000`.

### 2.5 Score status compatibility

`canMutateAssessmentScore()` permits every current score status except `locked`. The Studio conditional Mongo predicate remains `status: { $ne: "locked" }`, so legitimate teacher edits to `draft`, `recorded`, `missing`, `excused` and `submitted` remain allowed while locked scores remain protected.

## 3. Corrections

### 3.1 Atomic AssessmentItem lifecycle update

`updateStudioAssessmentItem()` is now the production helper used by the Studio importer. Its update filter requires:

- the authoritative `_id`;
- the caller’s `schoolId`; and
- a status in the existing mutable lifecycle set: `draft`, `open`, `completed` or `submitted`.

If the update no longer matches, the helper re-reads the school-scoped item and distinguishes `not_found` from a lifecycle `conflict`. The importer returns HTTP 409 for the latter and does not proceed to score mutation.

The existing `canMutateAssessmentItem()` predicate now derives from the same mutable status set, preventing drift between pre-read authorization and the database write predicate.

### 3.2 Complete-set prevalidation

`validateStudioSubmissionSet()` runs after the selected graded submissions are loaded and before linked-item creation/update or score writes. It validates:

- every selected score against the homework’s authoritative max score;
- duplicate student IDs in the selected set, returning an explicit 409 ambiguity response; and
- the complete set before the first score mutation.

The score loop no longer returns an ordinary 400 for a late invalid record.

### 3.3 Partial-write audit

Partial Studio score conflicts now call `recordAssessmentMarksAudit()` with the new `studio.gradebook_link_conflict` action. Metadata includes:

- operation and outcome (`partial_failure`);
- homework and assessment-item context;
- selected submission count;
- written score count;
- skipped locked-score count;
- conflict count and conflict references; and
- report-contribution/component context.

Successful imports continue to use `studio.gradebook_linked`, now with explicit completed outcome metadata. The audit helper remains best effort: it catches persistence errors and logs them, so audit durability is not claimed.

## 4. Test-first evidence

The new regressions were added before the corrective implementation. The initial isolated run reached the intended RED state: the existing score tests passed, while the new AssessmentItem, complete-set validation and audit-metadata tests failed because the requested production helpers did not yet exist. A sandbox run could not bind MongoMemoryServer’s ephemeral port (`listen EPERM`); that is an environment restriction, not an application assertion.

Final closure suite:

```text
node --test --import tsx tests/assessment-engine.score-writer-closure.integration.test.ts
```

Result: **13 passed, 0 failed**, using disposable MongoMemoryServer database `assessment_score_writer_closure`.

Coverage includes:

- deterministic AssessmentItem transition between pre-read and update;
- preservation of all currently mutable AssessmentItem statuses;
- score lock race and all current AssessmentScore statuses;
- concurrent first score conflict with one unique identity;
- complete-set late invalid-score rejection before score mutation;
- existing one-submission-per-homework/student uniqueness;
- partial Studio conflict audit metadata;
- cross-school score isolation; and
- the existing SubjectResult lifecycle/concurrency regressions.

Focused academic/report-card regression suite:

```text
node --test --import tsx \
  tests/assessment-engine.score-writer-closure.integration.test.ts \
  tests/assessment-engine.score-atomicity.integration.test.ts \
  tests/assessment-engine.studio-to-gradebook.test.ts \
  tests/assessment-engine.assessment-mutations.test.ts \
  tests/assessment-engine.subject-result-service.test.ts \
  tests/assessment-engine.report-card-run-service.test.ts \
  tests/assessment-engine.report-card-approval-service.test.ts
```

Result: **42 passed, 0 failed**.

## 5. Verification and isolation

| Check | Result |
|---|---|
| Scoped ESLint | PASS |
| Closure integration suite | PASS — 13/13 |
| Academic/report-card regressions | PASS — 42/42 |
| Full TypeScript check | Exit 2 from pre-existing unrelated diagnostics; no diagnostics matched modified files |
| `git diff --check` | PASS |
| Persistent `.env.local` database | Not loaded or used |
| Mongo test topology | Disposable MongoMemoryServer only |
| Production/provider/entitlement operations | Not performed |

The tests do not claim Mongo transaction behavior. The prior disposable standalone transaction probe reported that transactions require a replica-set member or mongos. No topology or transaction infrastructure was added.

## 6. Changed-file boundary

Changes for this corrective slice:

- `src/lib/academics/assessment-engine/studio-to-gradebook-service.ts`
- `src/lib/academics/assessment-engine/assessment-item-service.ts`
- `src/models/AssessmentMarksAuditLog.ts`
- `tests/assessment-engine.score-writer-closure.integration.test.ts`
- `docs/assess/rea/reports/REA_00C1B_A1_STUDIO_CORRECTIVE_REPORT.md`

Existing unrelated source, test and REA documentation changes were preserved. No Premium feature, handoff receipt collection, migration, index, entitlement or provider change was made.

## 7. Remaining risks and readiness

Remaining limitations:

- The audit helper is best effort and is not transactionally coupled to score writes.
- The Studio loop remains per-score and can produce a partial result if a later write conflicts.
- No durable idempotency receipt exists for retry reconciliation or unknown network outcomes.
- The deterministic interleaving tests establish conditional single-document behavior, not multi-document transaction atomicity or deployed-runtime behavior.
- The duplicate-submission test verifies the current database uniqueness contract; it does not migrate or repair legacy duplicate data.

This slice is ready for independent review of the bounded Core reliability correction. It is not approval to begin REA-00C1B-B, R02B or Premium Assess publication development automatically.
