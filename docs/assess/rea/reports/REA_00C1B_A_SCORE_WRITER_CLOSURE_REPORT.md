# EduSentrix Assess — REA-00C1B-A Score-Writer Closure Report

**Date:** 2026-10-15 (Africa/Accra)
**Status:** Bounded implementation completed; independent review required
**Branch:** `feat/assess-rea-foundation`
**Scope:** Existing School OS score-writer reliability only
**Excluded:** Premium Assess delivery, publication, handoff receipts, new indexes, migrations, entitlements and provider operations

## 1. Executive result

The Studio-to-gradebook score writer was hardened against stale locked-score overwrites and ambiguous bulk-write completion. SubjectResult lifecycle predicates were verified with deterministic disposable MongoDB concurrency tests; no new SubjectResult production logic was required because the existing conditional predicates rejected the tested stale transitions.

The implementation does not provide durable exactly-once effects. The Studio path has no durable handoff receipt, so duplicate-key or ambiguous writes are surfaced as conflicts rather than silently retried. Future receipt architecture remains deferred to REA-00C1B-B.

## 2. Production AssessmentScore writer inventory

Inventory command:

```text
rg -n -g '*.ts' -g '*.tsx' "AssessmentScore\\.(create|insertMany|updateOne|updateMany|findOneAndUpdate|findOneAndReplace|replaceOne|bulkWrite|deleteOne|deleteMany)|new AssessmentScore|bulkUpsertAssessmentScores|buildConditionalAssessmentScoreFilter" src tests
```

| Writer/consumer | Entry point | Write behavior | Authorization/scope | Lock/concurrency | Result |
|---|---|---|---|---|---|
| Teacher gradebook score writer | `src/app/api/teacher/marks/scores/bulk/route.ts` -> `bulkUpsertAssessmentScores` in `assessment-score-service.ts` | Per-record conditional `updateOne`, optional upsert; duplicate-key fallback | Active teacher/admin context, item ownership, active class/subject/period scope, student school/class/status validation | Existing conditional filter excludes locked scores; unique item/student identity; partial failures return 409 | Existing guarded path; regression-tested |
| Studio gradebook-link writer | `src/app/api/teacher/studio/assignments/[id]/gradebook-link/route.ts` -> `addStudioHomeworkToGradebook` | **Before:** unordered `AssessmentScore.bulkWrite` upserts without locked predicate. **After:** per-score conditional writer | Homework ownership, school, linked class group, active assessment plan and contribution rules | **Before:** stale lock pre-read could be bypassed. **After:** database filter excludes locked scores; duplicate/ambiguous writes conflict | Hardened in this slice |
| Exam analytics/teacher gradebook/profile reads | `exam-analytics-service.ts`, `exam-teacher-service.ts`, `teacher-gradebook-service.ts`, profile builders | Aggregation/find reads only | Read scope follows caller/service context | Not writers | No change |
| Other direct score writers | Source inventory found no additional `AssessmentScore` create/update/upsert/bulk-write/delete paths | N/A | N/A | N/A | No unclassified production writer found |

SubjectResult writes were separately inventoried in `subject-result-service.ts` and report-card approval/release services. They use identity/status predicates and report-card lifecycle transitions; no new score/result authority was added.

## 3. Original failure reproduction

The original Studio filter was equivalent to:

```text
filter: { schoolId, assessmentItemId, studentId }
update: { score: 2, status: "recorded" }
upsert: true
```

It did not include `status: { $ne: "locked" }`. A disposable MongoMemoryServer reproduction produced:

```text
database: assessment_score_writer_repro
before: { status: "locked", score: 8 }
after:  { status: "recorded", score: 2 }
```

This confirmed a real lock-bypass defect in the original write shape. No persistent database or `.env.local` database was used.

## 4. Implementation changes

### Modified

[studio-to-gradebook-service.ts](/Users/josephelormsegbefia/Desktop/elorm/appsentrix/edusentrix-web-nextjs/src/lib/academics/assessment-engine/studio-to-gradebook-service.ts)

- Added `writeStudioAssessmentScore` as a shared per-score conditional write boundary for Studio.
- Requires school, item and student identity plus `status != locked` at database write time.
- Preserves score bounds, max-score snapshot, source submission, teacher, class, subject and period context.
- Removes the unsafe unordered `AssessmentScore.bulkWrite` path.
- Treats locked races as skipped scores.
- Treats duplicate-key and ambiguous writes as conflicts; it does not silently retry without durable idempotency.
- Returns HTTP-style `409` partial-failure results when some prior scores were written and another score could not be safely applied.
- Keeps existing Studio homework ownership, active-plan, contribution and authorization checks.

### Added

[assessment-engine.score-writer-closure.integration.test.ts](/Users/josephelormsegbefia/Desktop/elorm/appsentrix/edusentrix-web-nextjs/tests/assessment-engine.score-writer-closure.integration.test.ts)

The test uses an ephemeral `MongoMemoryServer` database named `assessment_score_writer_closure` and covers Studio lock races, concurrent first score identity, cross-school isolation, stale SubjectResult writes, approval/locking races and concurrent first SubjectResult inserts.

No model, schema, index, migration, receipt collection, entitlement or Premium delivery file was added.

## 5. SubjectResult concurrency findings

The existing `submitSubjectResults` write filter excludes `submitted`, `approved` and `locked` states and uses the existing unique student/subject/period identity. Report-card approval/release transitions also use explicit lifecycle predicates. Disposable Mongo tests established:

- stale recalculation cannot overwrite a submitted result;
- stale approval cannot overwrite a locked result;
- cross-school update predicates match zero documents;
- concurrent first inserts converge on one unique identity;
- submission/approval races do not regress a result to `draft`.

No production SubjectResult change was necessary in this bounded slice. This is verification of current guards, not proof of all possible result-service or report-card races.

## 6. Test-first evidence

### RED

The new test initially failed to reach application behavior inside the sandbox because MongoMemoryServer could not bind its ephemeral port (`listen EPERM`). The same isolated test was rerun outside the sandbox and reached the intended RED state: three Studio tests failed because `writeStudioAssessmentScore` did not exist; two existing SubjectResult predicate tests passed.

### GREEN

Final isolated closure test:

```text
node --test --import tsx tests/assessment-engine.score-writer-closure.integration.test.ts
```

Result: **7 tests passed, 0 failed**, using disposable MongoMemoryServer database `assessment_score_writer_closure`.

Focused academic regression command:

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

Result: **36 tests passed, 0 failed**.

## 7. Database isolation and transaction capability

- `.env.local` was not loaded and its persistent database was not used.
- Mongo-backed tests used disposable local MongoMemoryServer instances with test-specific database names and teardown.
- The transaction probe used disposable database `assessment_transaction_probe`.
- Transaction result: **unsupported** because the standalone test server reported `Transaction numbers are only allowed on a replica set member or mongos`.
- No topology was changed and no transaction-dependent implementation was claimed.

Therefore this slice proves conditional single-document writes and concurrency behavior on an isolated Mongo server, not multi-document transaction atomicity.

## 8. Security and tenant findings

- Studio homework, class, student, assessment plan and score queries remain school-scoped.
- The score write filter includes `schoolId`, `assessmentItemId` and `studentId`; cross-school mutation test matched zero documents.
- Existing teacher/admin and active scope authorization remains unchanged.
- Locked scores cannot be overwritten by stale Studio writes.
- Error responses expose student IDs as conflict references only within the authorized mutation result; no secret or stack trace is returned by the new path.
- No rate-limit, provider, entitlement or new authentication boundary was introduced.

## 9. Guarantees established

Established by code and disposable Mongo evidence:

- Studio stale writes cannot overwrite a score that became locked after a pre-read.
- The existing unique `(assessmentItemId, studentId)` score identity remains enforced.
- Concurrent first Studio writes do not create duplicate score documents.
- Cross-school score and SubjectResult filters do not mutate another school’s record.
- SubjectResult stale lifecycle updates are rejected by current status predicates.
- Partial/ambiguous Studio writes return a conflict instead of reporting complete success.
- Network exactly-once delivery and durable exactly-once application effects are **not** established.

## 10. Remaining risks and REA-00C1B-B dependencies

- Studio has no durable idempotency receipt; a caller retry after an unknown non-duplicate write outcome receives conflict/reconciliation pressure rather than a durable prior result.
- The current per-score Studio loop is safer but less batch-efficient than the removed unordered bulk write.
- Mongo transactions are unsupported in the disposable standalone test server; transaction behavior requires a separately authorized replica-set test lane.
- Audit logging remains the existing best-effort `recordAssessmentMarksAudit` mechanism; this slice did not add durable operation receipts or audit transactions.
- The complete asynchronous/worker inventory remains limited to source-visible repository paths; no deployed runtime or external job system was inspected.
- SubjectResult tests exercise current predicates and model uniqueness, not every report-card approval/release interleaving.

REA-00C1B-B should decide and implement, only after approval:

1. durable operation receipt/idempotency model;
2. transaction-capable isolated test topology and retry semantics;
3. common score-writer boundary for all future adapters;
4. durable audit/receipt consistency and reconciliation UI/worker behavior;
5. broader report-card lifecycle concurrency coverage.

## 11. Verification summary

| Check | Result |
|---|---|
| Focused closure tests | PASS — 7/7 |
| Focused academic regression suite | PASS — 36/36 |
| Scoped ESLint | PASS |
| Modified-file TypeScript diagnostics | PASS — no matches in full-check output |
| Full repository TypeScript check | FAIL — pre-existing diagnostics across unrelated app/scripts/tests; exit 2 |
| `git diff --check` | PASS |
| Database isolation | PASS — disposable MongoMemoryServer only |
| Mongo transaction support | NOT AVAILABLE in standalone disposable server |
| Premium/entitlement/schema/migration/provider changes | NONE |

## 12. Changed-file boundary

Task changes:

- `src/lib/academics/assessment-engine/studio-to-gradebook-service.ts`
- `tests/assessment-engine.score-writer-closure.integration.test.ts`
- this report

Pre-existing modified/untracked source, tests and REA documents were preserved and are not attributed to this slice.

Stop here for independent review. Do not begin REA-00C1B-B, R02B or Premium Assess implementation automatically.
