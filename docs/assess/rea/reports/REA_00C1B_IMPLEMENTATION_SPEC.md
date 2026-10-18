# EduSentrix Assess — REA-00C1B Implementation Specification

**Date:** 2026-10-15 (Africa/Accra)  
**Status:** Proposed first implementation slice; not executed  
**Slice:** Canonical Score-Writer and Subject-Result Concurrency Closure  
**Dependencies:** REA-00C1, REA-R01C-D, R02A architecture/product/security review

## 1. Objective and non-goals

Make every known `AssessmentScore` write path safe against tenant mismatch, unauthorized mutation, stale/locked overwrite, duplicate operation and partial failure, while proving subject-result concurrency behavior in isolated MongoDB.

Non-goals:

- no CBT, paper, OMR, marking, moderation or immutable publication feature;
- no new academic result engine or report-card writer;
- no subscription policy change;
- no provider/production/database operation;
- no migration or new index until separately approved;
- no silent rewrite of existing Core behavior.

## 2. Verified baseline

Current repository evidence:

- `AssessmentScore` requires `schoolId`, academic period, `assessmentItemId`, `assessmentPlanId`, class, subject, student and teacher; it has a unique `(assessmentItemId, studentId)` index and status/lock fields.
- `assessment-score-service.ts` already performs conditional update behavior for score mutation and is covered by existing assessment mutation tests.
- `studio-to-gradebook-service.ts` still builds `AssessmentScore.bulkWrite` operations, making it a separate writer that must be brought under equivalent validation/lock/idempotency rules.
- `SubjectResult` has a unique student/subject/period identity and conditional service paths, but dedicated real-database concurrency evidence remains incomplete.
- `sourceSubmissionId` exists on `AssessmentScore`; it is not a complete source-operation receipt or general idempotency ledger.
- Existing teacher authorization resolves active class/subject/period scope; preserve those checks rather than introducing new role assumptions.

Source paths: `src/models/AssessmentScore.ts`, `src/models/SubjectResult.ts`, `src/lib/academics/assessment-engine/assessment-score-service.ts`, `src/lib/academics/assessment-engine/subject-result-service.ts`, `src/lib/academics/assessment-engine/studio-to-gradebook-service.ts`, relevant assessment tests, REA-00C1.

## 3. Required writer inventory

Before source edits, search and record every direct or indirect writer:

1. `AssessmentScore.create`, `insertMany`, `updateOne`, `findOneAndUpdate`, `bulkWrite`, replacement writes and service wrappers.
2. Server actions, API routes, imports, gradebook/studio paths, CSV/app imports and test-only fixtures.
3. Subject-result writes and recalculation callers triggered by score changes.
4. Any worker/job retry or asynchronous path.

For each writer record: entry point, actor, school-scope proof, item/plan proof, lock predicate, idempotency key, transaction context, failure behavior, downstream recalculation and tests. Unknown writers are a blocker, not an assumption of safety.

## 4. Canonical write contract

The implementation should centralize or wrap score application behind one contract with:

- verified active school/membership/role and item scope;
- student/class/subject/period/plan consistency;
- score and maximum validation against the item snapshot;
- expected current score version/status predicate;
- stable `sourceOperationId` and proposal version;
- operation scope including school, item and student;
- source evidence hash/reference when applicable;
- explicit operation status: `proposed`, `validating`, `accepted`, `canonical_score_written`, `conflicted`, `corrected`, `rejected`;
- durable reconciliation outcome after ambiguous network/transaction result.

`AssessmentScore` remains the canonical score record. A handoff receipt/idempotency record is an implementation concept requiring schema/index approval; this specification does not create it.

## 5. MongoDB mechanism decision

### Preferred mechanism: conditional write plus durable idempotency receipt, with transaction where available

Use a transaction for the score effect and receipt when the deployment topology supports reliable MongoDB transactions. The score update must include school, item, student, expected revision/status and unlocked predicate. The receipt must be uniquely identified by operation scope. Commit outcome is reconciled by reading the receipt and score.

If a transaction is unavailable for a bounded development/test environment, the fallback must still use a conditional score write and durable operation state with explicit recovery; it cannot claim atomic multi-document behavior.

### Alternatives considered

- **Single `findOneAndUpdate` only:** good for one-document conditionality, but cannot atomically create a separate receipt or cover downstream result work.
- **Application read-then-write:** rejected; races allow stale overwrites and duplicate operations.
- **Unordered `bulkWrite`:** useful for batch throughput but insufficient alone for per-student lock/idempotency/audit guarantees; this is the risk in the current studio path.
- **Distributed lock:** adds lease/liveness complexity and does not replace durable conditional predicates; not preferred.

## 6. Required indexes, conceptually

No indexes are created in this task. The implementation review must evaluate:

- existing unique `(assessmentItemId, studentId)` score identity;
- unique operation receipt scoped by school, delivery/source operation, item and student;
- query index for reconciliation by school/operation status;
- subject-result unique `(schoolId, academicPeriodId, classGroupId, subjectId, studentId)` identity;
- supporting indexes needed by authorization and retry queries.

Index names, rollout order and duplicate-data handling require a separate migration review.

## 7. Failure and concurrency behavior

| Scenario | Required behavior |
|---|---|
| Duplicate same operation | Return/reconcile the original result; never create a second score effect. |
| Different operation, unlocked score | Apply only under expected revision/status; record a new operation. |
| Locked score | Conditional match fails; return conflict and preserve locked value. |
| Stale revision | Reject as conflict; do not last-writer-wins. |
| Transaction transient error | Retry only with same operation identity and bounded policy; reconcile before reporting failure/success. |
| Lost acknowledgement after commit | Read receipt/score by operation identity; return canonical outcome. |
| Partial write outside transaction | Durable ambiguous/reconciliation state; no false success and no learner zero. |
| Authorized correction | New proposal/version and audit reason; only approved unlocked/correction path may change score. |
| Subject-result recalculation failure | Preserve canonical score; queue/retry recalculation with visible/audited incomplete downstream state. |
| Concurrent subject-result submit/approve/lock | Conditional transition rejects stale actor; no state regression or lost calculation. |

## 8. Authorization and Core regression requirements

Preserve active-school membership, school status, role, teacher class/subject/period scope, report-run/homeroom checks and existing Core mutation semantics. Add negative tests for School A actor/records versus School B records, unauthorized teacher, wrong class/subject/period, locked score and released report data.

Required regression coverage includes ordinary exam marks, gradebook writes, subject-result calculation/submit/approve/lock, report-card compilation and release boundaries. Premium terminology must not appear as a prerequisite for ordinary Core marks.

## 9. Focused test plan

### Unit/service tests

- inventory each writer and route to the common contract;
- score bounds, item maximum and contribution validation;
- duplicate operation and idempotent response;
- stale revision and locked-score rejection;
- correction authorization and audit fields;
- partial/ambiguous outcome handling.

### Real Mongo integration tests

Run only against an isolated approved Mongo test database. Required cases:

1. Two concurrent first writes for one item/student.
2. Two concurrent different updates with one stale revision.
3. Lock racing with score write.
4. Duplicate operation retry after simulated lost acknowledgement.
5. Receipt/score transaction retry behavior.
6. Concurrent subject-result recalculation and submit/approve/lock transitions.
7. Two-school negative isolation.

The test must report database identity, setup/teardown scope, exit code and whether transactions were actually available. A unit mock is not sufficient evidence for transaction/concurrency claims.

## 10. Acceptance criteria

- Every discovered score writer is inventoried and either uses the common contract or is explicitly blocked.
- Existing unique score identity remains enforced.
- A locked score cannot be overwritten by stale or duplicate work.
- Same operation retry has one logical application effect and stable reconciliation outcome.
- Lost acknowledgement is resolved without guessing.
- Partial failure is durable/retryable and cannot become an academic zero.
- Authorized correction is append-only/audited and does not erase prior evidence.
- Subject-result concurrency tests prove no stale transition overwrites a newer state.
- Existing teacher/school authorization and Core exam/report-card regression tests pass.
- No source, schema, index, provider or subscription change exceeds the approved slice.

## 11. Security and release gates

Before implementation: independent ChatGPT review, product/security approval of operation identity/correction policy, isolated Mongo test authorization and change-impact inventory.

Before development completion: focused unit/integration evidence, diff review, security review and downstream regression.

Before release: deployment topology/transaction proof, migration/index review if needed, production-like authorization/tenant tests, recovery/rollback evidence and manual signed-in/runtime checks. R02A documentation cannot satisfy these release gates.

## 12. Stop condition

This is an implementation specification only. Do not execute REA-00C1B automatically. Stop for independent ChatGPT and product-owner review.
