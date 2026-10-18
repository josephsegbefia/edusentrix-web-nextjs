# EduSentrix Assess — ASSESS-P01A2
## Publication Consistency and Build Verification Closure Report

**Date:** 2026-10-15 (Africa/Accra)
**Status:** Local consistency hardening complete; production safety and P02 entry remain blocked
**Branch:** `feat/assess-rea-foundation`
**Repository:** `edusentrix-web-nextjs`

## 1. Scope and evidence basis

This was a bounded corrective continuation of ASSESS-P01A and P01A1. The review inspected:

- `docs/assess/implementation/ASSESS_P01A_PUBLICATION_FOUNDATION_REPORT.md`;
- `docs/assess/implementation/ASSESS_P01A1_HARDENING_REPORT.md`;
- `src/models/AssessmentDefinitionVersion.ts`;
- `src/lib/assess/assessment-definition-service.ts`;
- the three Assess definition API routes;
- `src/lib/subscriptions/assess-premium.ts` and `assess-premium-policy.ts`;
- the build configuration and database initializer; and
- the publication, route, build-isolation, subscription, storage and Core regression tests.

The ECC change-impact, security-review, TDD, verification-loop and module-regression guidance was applied. No CBT, OMR, paper packet runtime, digital marking, score handoff, production operation, provider operation, commit or push was performed.

## 2. Build-stall diagnosis and verification outcome

### Previously observed exit 130

The P01A1 safe-build command was:

```text
MONGODB_URI='' MONGO_DB_NAME='' npm run build
```

It printed the Next/Turbopack build start and then stopped before a `Compiled successfully` message. It was manually interrupted after the silent compile-period stall and exited **130**. The retained output does not contain a process profile, worker trace or resource-exhaustion error, so the exact cause of that historical stall cannot be proven retrospectively.

The observed phase was therefore the production compilation phase, not a confirmed database wait. A cold or resource-sensitive compilation of this repository is plausible: the current build enumerates 696 pages and uses seven workers, but this remains an inference from observed build characteristics rather than a confirmed root cause.

### Database isolation retained and proven

The P01A1 protections remain in place:

- the three platform proposal pages that perform runtime database work declare `dynamic = "force-dynamic"`; and
- `src/db/connectToDatabase.ts` refuses before URI parsing or Mongoose connection when `NEXT_PHASE === "phase-production-build"`.

The dedicated isolation test passed **2/2**. The final build used only this sanitized loopback URI, which is not a school database:

```text
MONGODB_URI=mongodb://127.0.0.1:1/isolated-build-verification
MONGO_DB_NAME=isolated-build-verification
```

There was no `Connected to MongoDB` or `MongoDB connection error` line in the build log. The build could not connect to `edusentrix-dev` or another persistent school database.

### Controlled build results

The compile-only diagnostic completed with exit **0** and reported:

```text
Compiled successfully in 39.7s
```

The final full command, run after the P01A2 service correction, completed with exit **0**:

```text
NEXT_TELEMETRY_DISABLED=1 APP_RUNTIME_MODE=development \
APP_URL=http://localhost:3000 NEXT_PUBLIC_APP_URL=http://localhost:3000 \
MONGODB_URI=mongodb://127.0.0.1:1/isolated-build-verification \
MONGO_DB_NAME=isolated-build-verification \
npm run build -- --debug
```

The final log showed successful compilation, page-data collection and static-page generation for 696 pages. It also printed 179 existing dynamic-usage diagnostics for authenticated pages using request headers. They did not produce a non-zero build exit and did not reference the Assess definition routes. Those repository-wide diagnostics are not treated as P01A2 fixes or passes.

Conclusion: the prior exit-130 build is not reproducible under the controlled environment. The build isolation correction is effective. A future release gate should still retain the sanitized build command and investigate the repository-wide dynamic-page diagnostics separately.

## 3. Publication consistency changes

`src/lib/assess/assessment-definition-service.ts` was corrected within the existing model and index scope.

### Current-version invariant

For a school and definition key, the current usable publication is defined as the highest-numbered version whose status is `published`. `getCurrentAssessmentDefinitionVersion()` makes that ordering explicit and applies the school and definition-key scope.

Version allocation still uses the highest historical version, including compensated or archived rows, so version numbers remain unique and monotonic. Supersession targets the highest currently published version, not merely the highest historical row. The supersession update must match exactly one current row; a stale predecessor is treated as a failed publication and is not reported as success.

The model’s existing unique indexes remain the safety boundary:

- `(schoolId, definitionKey, version)`;
- `(schoolId, definitionKey, contentHash)`; and
- existing school-scoped retrieval/history indexes.

No new index was added and no production index creation or migration was executed.

### Ambiguous create recovery

If `AssessmentDefinitionVersion.create()` throws after the write may have committed, the service performs one school-scoped lookup by the unique content identity. If the row exists, it returns it as a replay. It does not blindly create again. If the row cannot be found, the original error remains authoritative.

### Failure-injection results

The publication integration suite now has **13/13** passing tests:

| Scenario | Result |
|---|---|
| Four concurrent same-content publications | One version; remaining calls replay the same row |
| Concurrent different-content publications | Versions 1 and 2; version 1 superseded and version 2 published |
| Unique version allocation and supersession ordering | Passed through the ordered-version assertions |
| Source mutation after publication | Historical snapshot and hash remain unchanged |
| Create throws after persistence | Content-identity reconciliation returns one row without a duplicate |
| Predecessor supersession fails | Operation fails; compensation marks the new row superseded and leaves the prior publication usable |
| Retry after compensated failure with new content | Version 3 advances from the still-published current version |
| Predecessor and compensation both fail | Operation fails, but two rows remain `published`; current selection resolves to the higher version |

The last case is an explicit remaining blocker, not a hidden pass. The current-version query prevents an older row from being selected as current because version order is total, but the database can still contain two published statuses after both independent writes fail. Guaranteed status convergence requires a MongoDB transaction/replica-set design or a durable reconciliation workflow beyond the approved additive P01A scope. No unsafe compensation logic was added.

## 4. Premium and security boundary verification

The dedicated capability remains:

```text
assessment.premium_publication
```

The provisional Enterprise-only mapping was not changed. Starter, Growth and Pilot were not granted publication. Disabled enforcement switches remain fail-closed. School status, active membership context, school-admin role, tenant scope and private projections remain enforced by the existing route/service boundary.

The real POST route was exercised with synthetic active-school identity and entitlement fixtures against a local disposable MongoDB:

- unauthenticated request: **401** before publication lookup;
- signed-in member without the capability: **403**;
- non-admin identity: **401**, matching the existing `gateSchoolAdminRoles` contract; and
- authorized school admin: **201**, with a school-scoped immutable definition.

A second school could not publish the first school’s source paper and did not create a second definition. The route suite passed **4/4**.

The suite used synthetic fixtures, not live Clerk, subscription, storage or deployment infrastructure. It is therefore route-boundary evidence, not signed-in production verification.

Private answer keys, marking guides, correct-option flags and resource manifests remain excluded from the default candidate projection. The attachment-bearing publication restriction remains fail-closed.

## 5. Resource-integrity readiness interface

No provider-backed digest computation was added. The minimum future interface should be:

1. The source question carries a `storedAssetId`, not only a URL or upload key.
2. Publication resolves `StoredAsset` by `_id` and `schoolId`, requiring `status: "ready"` and private visibility.
3. The asset association must identify the source question or an approved owning entity.
4. The storage completion path must provide a stable SHA-256 digest, validated as a 64-character hexadecimal value; `etag` alone is not sufficient.
5. The immutable manifest stores the asset identity, digest, provider/storage reference and retention/provenance metadata. Candidate delivery obtains an authorization-scoped private URL separately.

Until that interface exists and is independently approved, attachment-free publication remains supported and resource-bearing publication remains rejected.

## 6. Index, persistence and operational findings

The additive model’s declared indexes were created only in disposable test databases. No production index migration was implicitly performed.

Before production use, the index rollout must:

- scan for duplicate `(schoolId, definitionKey, version)` and content-hash rows;
- create the named unique indexes in a controlled maintenance window or equivalent online procedure;
- verify index definitions and duplicate-free counts;
- monitor publication errors and duplicate-key rates; and
- retain a documented rollback plan that removes only the new named indexes after publication writes are disabled or otherwise safely drained.

The rollout and rollback were not executed in this task.

The separate-write publication flow is locally deterministic under normal concurrent writes and safe compensation success. It is not transactionally atomic under simultaneous predecessor and compensation failure. Production approval must not be inferred from the passing normal-path tests.

## 7. Changed files in P01A2

P01A/P01A1 model, routes, entitlement policy and build-protection files were inspected and preserved. P01A2 changes are:

- `src/lib/assess/assessment-definition-service.ts` — current published predecessor selection, exact supersession-match check, ambiguous-create reconciliation, and explicit current-version query;
- `tests/assessment-publication-foundation.test.ts` — concurrency, recovery, ambiguity and failure-injection coverage;
- `tests/assessment-publication-route.test.ts` — route-level synthetic identity, entitlement and school-scope coverage;
- `tests/assessment-route/helpers/stub-assessment-route-deps.ts` — test-only module-hook harness;
- `tests/assessment-route/helpers/stubs/active-school-context.cjs` — synthetic active-school resolver;
- `tests/assessment-route/helpers/stubs/assess-premium.cjs` — synthetic Premium decision fixture; and
- `docs/assess/implementation/ASSESS_P01A2_VERIFICATION_CLOSURE_REPORT.md` — this report.

No unrelated working-tree changes were reverted.

## 8. Verification evidence

| Command | Result |
|---|---:|
| `node --test --import tsx tests/assessment-publication-foundation.test.ts` | exit 0; 13 passed, 0 failed |
| `node --test --import tsx tests/assessment-publication-route.test.ts` | exit 0; 4 passed, 0 failed |
| `node --test --import tsx tests/database-build-isolation.test.ts` | exit 0; 2 passed, 0 failed |
| `npm run test:subscriptions` | exit 0; 155 passed, 0 failed |
| Focused Core academic regression command | exit 0; 38 passed, 0 failed |
| Focused storage/security command | exit 0; 98 passed, 0 failed |
| Targeted ESLint over P01A2 source, route and test files | exit 0 |
| `npx --no-install tsc --noEmit --pretty false` | exit 2; 736 diagnostic lines, none referencing P01A2 Assess files |
| Final sanitized `npm run build -- --debug` | exit 0; no MongoDB connection log |
| `git diff --check` | exit 0; no whitespace diagnostics |

The database-backed tests used disposable `MongoMemoryServer` instances. Storage tests used local/fake storage ports and did not contact R2. No persistent school database was used.

The final tracked diff check exited 0. The newly created P01A2 files were also checked with `git diff --no-index --check`; they produced no whitespace diagnostics.

The TypeScript failure is a repository-wide baseline limitation. It includes generated Next validator diagnostics for existing proposal page contracts and unrelated scripts, application pages and tests. Next production build type validation is already configured to be ignored in `next.config.ts`; this report does not claim a repository-wide TypeScript pass.

## 9. Remaining release blockers

1. Atomic publication or durable reconciliation is required before production approval. The double-failure test proves that independent writes can leave two `published` rows.
2. The additive production index rollout and rollback plan must be reviewed and executed through the approved operational process.
3. Resource-bearing publication remains unavailable until `StoredAsset` ownership, private readiness, stable SHA-256 digest and retention semantics are available.
4. The Enterprise-only Premium mapping remains provisional pending product-owner packaging approval.
5. Signed-in deployed-runtime, Clerk, subscription-provider and storage-provider verification remains unperformed.
6. The repository-wide TypeScript gate remains non-green independently of this slice.

## 10. P02 readiness

**Not ready for P02 implementation handoff or production approval.** The local normal-path consistency and build-isolation checks are materially stronger, but the unresolved double-failure publication state and unexecuted production index rollout are persistence/reliability blockers. No ASSESS-P02 or REA-00C1B-B work was started.

Recommended next action is an independent review of the transaction/reconciliation decision and production index plan, followed by a separately authorized correction or release gate. Do not treat this report as security approval or production readiness.
