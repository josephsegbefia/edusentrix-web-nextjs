# EduSentrix Assess — ASSESS-P01A3
## Atomic Publication and Failure-Recovery Report

**Date:** 2026-10-15 (Africa/Accra)
**Branch:** `feat/assess-rea-foundation`
**Status:** Local atomicity correction implemented and verified; production approval remains gated

## 1. Scope and outcome

This bounded correction closes the P01A2 publication-atomicity defect. The immutable publication model and existing unique indexes were preserved. Publication now requires a MongoDB transaction-capable deployment and performs version creation plus predecessor supersession in one transaction.

No CBT, OMR, paper packet runtime, digital marking, score handoff, entitlement packaging, migration, deployment, commit or push was performed. Core examination authoring, academic scoring, report cards, candidate access rules and attachment fail-closed behavior were preserved.

The local result is **ready for independent review of the bounded P01A3 change**, but not production approval or automatic P02 commencement.

## 2. Original defect and corrected invariant

P01A2 reproduced this sequence:

1. Version 1 was `published`.
2. A new version 2 was inserted as `published`.
3. Predecessor supersession failed.
4. Compensation of version 2 also failed.
5. The database retained two `published` rows.

The old implementation used separate `create()` and `updateOne()` calls and could therefore leave this contradictory state. The previous P01A2 report recorded the test as an unresolved blocker.

P01A3 now establishes this invariant for the publication operation:

> For a school and definition key, a successful publication commits the new version and the predecessor supersession together; an aborted or failed transaction commits neither write.

The current persisted publication is the highest-numbered row with `status: "published"`. Version allocation still uses the highest historical version, preserving monotonicity across superseded and archived history. The existing unique indexes remain the database uniqueness boundary:

- `(schoolId, definitionKey, version)`;
- `(schoolId, definitionKey, contentHash)`; and
- the existing school-scoped retrieval/history indexes.

No new index or collection was added.

## 3. Chosen atomicity mechanism

`publishAssessmentDefinition()` now uses `mongoose.startSession()` and `session.withTransaction()` around:

- the school/definition-key latest-version read;
- the school/definition-key current-published predecessor read;
- creation of the immutable published snapshot; and
- the conditional predecessor transition from `published` to `superseded`.

The transaction uses:

```text
readConcern:  { level: "snapshot" }
writeConcern: { w: "majority" }
maxCommitTimeMS: 10000
```

The service does not fall back to separate writes if transactions are unavailable. A standalone MongoDB returns a 503-style `AssessmentDefinitionError` and creates no publication row.

Concurrent retry behavior is bounded to five attempts. Duplicate-key outcomes, stale predecessor transitions and labeled transient transaction errors are retried or reconciled. An ambiguous commit acknowledgement is reconciled only through the existing school-scoped `(definitionKey, contentHash)` identity. A successful result is returned only after `withTransaction()` resolves, or after a post-acknowledgement identity lookup proves the committed row exists.

## 4. Changed files

P01A3 changes are limited to:

- `src/lib/assess/assessment-definition-service.ts` — transactional publication boundary, transaction-unavailable failure, bounded retry and ambiguous-commit reconciliation.
- `tests/assessment-publication-foundation.test.ts` — replica-set fixture and corrected rollback expectations for the existing publication coverage.
- `tests/assessment-publication-route.test.ts` — replica-set fixture so the authorized route exercises the real transactional service.
- `tests/assessment-publication-atomicity.test.ts` — disposable replica-set failure-injection and atomicity suite.
- `tests/assessment-publication-transaction-unavailable.test.ts` — standalone-topology refusal test.
- `docs/assess/implementation/ASSESS_P01A3_ATOMIC_PUBLICATION_REPORT.md` — this report.

The `AssessmentDefinitionVersion` schema and its existing indexes were not changed in this slice. No entitlement helper, route contract, academic score writer or report-card code was changed.

The worktree already contained unrelated user changes and earlier Assess/REA artifacts. They were preserved and not reverted.

## 5. Isolated transaction topology and evidence

The integration suite uses `MongoMemoryReplSet` 11.1.0 with one member named `rs0`, backed by disposable local storage. The test setup connects Mongoose to the generated replica-set URI, creates the existing model indexes, and executes a write/delete transaction probe before transaction-dependent tests. The probe completed successfully.

The standalone test uses `MongoMemoryServer` separately and verifies that publication fails closed with the transaction-capable-deployment error and zero `AssessmentDefinitionVersion` rows.

No persistent development, demo, staging or production MongoDB was contacted. No R2 or other storage provider was contacted.

## 6. Failure-injection outcomes

| Scenario | Local result |
|---|---|
| Failure before publication creation | No publication row committed |
| Failure after insertion but before predecessor supersession | Insert rolled back; predecessor remained published |
| Failure during predecessor supersession | Both transaction writes rolled back; one published predecessor remained |
| Explicit transaction abort after insertion | No publication row committed |
| Ambiguous acknowledgement after successful commit | Existing committed row reconciled by content identity; no duplicate |
| Concurrent same-content publication | One immutable row; competing calls replay the same identity |
| Concurrent different-content publication | Versions 1 and 2 allocated; exactly one published current version |
| Duplicate version allocation | Duplicate outcome retried; no duplicate version persisted |
| Historical immutability | Superseded snapshot content remained immutable |
| Cross-school publication request | Source lookup rejected before publication |
| Standalone/nontransactional topology | 503-style failure; no nontransactional fallback and no row |
| Retry after aborted operation | Retry safely allocated version 1 from unchanged state |

The combined publication suite passed **26/26** tests. The separate files intentionally use disposable databases per process and do not rely on mocks as the evidence for transaction capability. Failure injection is limited to deterministic in-process method/session seams around real MongoDB transactions.

## 7. Security and compatibility preservation

The existing route and service boundaries remain in force:

- school ownership and active-school scope are required;
- school-admin authorization is required;
- `assessment.premium_publication` remains the dedicated capability;
- the provisional Enterprise-only mapping was not changed;
- ordinary Core examinations remain available;
- answer keys, marking guides, correct-option flags and private resource manifests remain excluded from the default projection; and
- attachment-bearing publication remains rejected until verified private asset metadata and a stable digest are available.

The route suite passed **4/4** using synthetic identity and entitlement fixtures against a disposable replica set. This is route-boundary evidence, not signed-in Clerk, provider or deployed-runtime proof.

No model migration or production index operation was performed. Existing production deployments must be checked for a replica set or sharded `mongos` topology before enabling this publication operation.

## 8. Deployment compatibility and recovery gates

The repository connection helper accepts the topology supplied by `MONGODB_URI`; it does not force a replica-set option. Production transaction support therefore depends on the actual deployment topology and driver/server compatibility. Before production enablement, operations must verify:

1. the deployment is a replica set or sharded cluster accessed through `mongos`;
2. the configured MongoDB version and driver support multi-document transactions with snapshot reads and majority writes;
3. the existing named unique indexes are present and duplicate-free;
4. transaction commit/abort, retry and unknown-commit telemetry is observable without logging question content or answer keys; and
5. an operational procedure exists for a transaction-capability outage, including fail-closed publication behavior and safe retry guidance.

Those checks were not performed against external infrastructure. The local replica-set evidence does not prove production topology readiness.

Performance implications are bounded to an additional session and transaction round trip, snapshot reads and majority acknowledgement for each new publication. The five-attempt bound prevents unbounded application retries. Publication should remain an administrative operation rather than a candidate-runtime hot path.

## 9. Verification evidence

| Command | Result |
|---|---:|
| `node --test --import tsx tests/assessment-publication-foundation.test.ts tests/assessment-publication-route.test.ts tests/assessment-publication-atomicity.test.ts tests/assessment-publication-transaction-unavailable.test.ts` | exit 0; 26 passed, 0 failed |
| `npx --no-install eslint src/lib/assess/assessment-definition-service.ts tests/assessment-publication-foundation.test.ts tests/assessment-publication-route.test.ts tests/assessment-publication-atomicity.test.ts tests/assessment-publication-transaction-unavailable.test.ts` | exit 0 |
| `node --test --import tsx tests/database-build-isolation.test.ts` | exit 0; 2 passed, 0 failed |
| `npm run test:subscriptions` | exit 0; 155 passed, 0 failed |
| Focused Core academic regression command from P01A2 | exit 0; 38 passed, 0 failed |
| `npx --no-install tsc --noEmit --pretty false` | exit 2; 736 diagnostic lines; none referenced P01A3 publication paths |
| Sanitized `npm run build -- --debug` | **not a pass**; stalled at optimized compilation and was interrupted after no further progress |
| `git diff --check` | exit 0; no whitespace diagnostics |

The sanitized build used:

```text
MONGODB_URI=mongodb://127.0.0.1:1/isolated-build-verification
MONGO_DB_NAME=isolated-build-verification
```

Its log reached `Creating an optimized production build ...` and contained no `Connected to MongoDB` or `MongoDB connection error` line. The verification process was manually interrupted after the silent stall; the tool session did not expose a final shell exit code, so the build is recorded as incomplete rather than successful. The earlier P01A2 sanitized build had completed, but that historical result is not reused as a P01A3 build pass.

The TypeScript failure is a repository-wide baseline limitation involving generated Next validator diagnostics and unrelated files. Targeted ESLint and all focused runtime tests for this slice passed.

## 10. Remaining release blockers

1. Production MongoDB topology, transaction support and named index presence require independent operational verification.
2. The sanitized full build needs a reproducible completion or a separately diagnosed resource/compile stall before release approval.
3. The repository-wide TypeScript gate remains non-green independently of P01A3.
4. The provisional Enterprise-only Premium mapping still awaits final product packaging approval.
5. Resource-bearing publication remains blocked pending verified private `StoredAsset` ownership, readiness and stable digest support.
6. Signed-in deployed-runtime verification for Clerk, subscription, storage and candidate-facing confidentiality remains unperformed.

These are release/production gates, not unresolved local transaction-atomicity defects.

## 11. P02 local-development readiness

**Recommendation: conditionally ready for P02 local planning after independent review, not automatic implementation.** The P01A publication foundation no longer has the confirmed local double-publication failure under a transaction-capable test topology, and Core/entitlement/route boundaries remain green. P02 should remain separately authorized and should not begin until the reviewer accepts the transaction contract and records the production topology/build gates above.

No P02 or REA-00C1B-B work was started.
