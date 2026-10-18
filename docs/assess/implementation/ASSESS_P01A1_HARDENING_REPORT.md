# EduSentrix Assess — ASSESS-P01A1
## Publication Foundation Safety and Integration Hardening Report

**Date:** 2026-10-15 (Africa/Accra)
**Status:** Hardening implemented; production safety and release approval remain pending
**Branch:** `feat/assess-rea-foundation`
**Repository:** `edusentrix-web-nextjs`

## 1. Scope and review basis

This correction pass was limited to the implemented ASSESS-P01A publication foundation. It used the ECC change-impact, security-review, regression-testing and verification guidance, together with the P01A implementation report, the R02A product decision register, the actual publication model/service/routes/tests, subscription helpers, storage infrastructure and build configuration.

No CBT, paper scanner, OMR, digital marking, moderation, score handoff, report-card change, deployment, commit, push, production operation, persistent school database access or live storage-provider access was performed.

The R02A product-owner approvals remain limited to PD-001, PD-002 and PD-003. They are not security or production approvals.

## 2. Build-time database access

### Root cause

The earlier `npm run build` loaded `.env.local` and logged a connection to the persistent `edusentrix-dev` MongoDB during static generation. The source path was verified as follows:

1. `src/app/(app)/platform/proposals/page.tsx` was an async server page that directly called `connectToDatabase()` to calculate proposal metrics, but did not declare `dynamic = "force-dynamic"`.
2. The proposal detail and preview pages had the same direct runtime database dependency without a dynamic declaration:
   - `src/app/(app)/platform/proposals/[proposalId]/page.tsx`
   - `src/app/(app)/platform/proposals/[proposalId]/preview/page.tsx`
3. During Next static generation, those page paths were eligible for execution. `connectToDatabase()` read `MONGODB_URI` and `MONGO_DB_NAME` from the environment loaded by Next, so the build reached the configured development cluster.
4. The database initializer had no build-phase refusal, so an accidental static-generation database call was allowed to proceed.

This was a build-environment and route-boundary defect, not an Assess publication data dependency.

### Implemented correction

- Added `export const dynamic = "force-dynamic"` to all three proposal pages so their legitimate database work remains runtime-only.
- Added a central `NEXT_PHASE === "phase-production-build"` refusal in `src/db/connectToDatabase.ts`. It runs before URI parsing, database-name resolution or Mongoose connection and fails closed with an actionable error.
- Added `tests/database-build-isolation.test.ts` proving that a build-phase call refuses a configured-looking MongoDB URI before any network connection, while ordinary runtime execution is not classified as a build.

The central guard is defense in depth for future server components that accidentally omit a dynamic declaration. Runtime database access is unchanged outside the Next production build phase.

### Build verification result

The safe build command was:

```text
MONGODB_URI='' MONGO_DB_NAME='' npm run build
```

The run emitted no MongoDB connection log and did not reach a database. It stalled silently in the compile phase and was stopped with exit code **130**. It is therefore **not a build pass**. The prior successful-looking build remains invalid as disposable-database evidence because it connected to `edusentrix-dev`.

## 3. Resource-integrity policy

### Evidence from existing infrastructure

The legacy `ExamQuestion.attachments` shape contains presentation/reference fields such as `id`, `url`, `uploadKey`, file name and MIME type. It does not carry a `StoredAsset` identifier or a source-owned digest.

The existing `StoredAsset` model can establish useful facts for storage operations:

- school ownership through `schoolId`;
- provider key and private/public visibility;
- lifecycle status, including `ready` and deleted/failed states;
- association and uploader metadata; and
- object size, MIME type and an `etag` recorded from the provider.

The current storage completion path does not persist a cryptographic SHA-256 digest. An `etag` is not treated as a byte-level SHA-256 proof. The storage read policy does enforce school/private access for the supported asset routes, and the existing storage tests cover those authorization boundaries.

No R2 or other provider was contacted during this review.

### Implemented policy

`src/lib/assess/assessment-definition-service.ts` now validates the structural attachment reference and then fails closed for every resource-bearing publication with:

> Resource-bearing publication requires verified private asset metadata and a stable resource digest

Consequences:

- attachment-free assessments continue to publish;
- missing and structurally invalid references continue to fail;
- a plausible HTTPS URL or upload key is not treated as proof of ownership, existence, private access or historical byte integrity;
- no unverified resource manifest is persisted as if it were a safe immutable delivery contract.

Future resource-bearing publication requires an explicit source-to-`StoredAsset` identity, same-school ownership check, `ready` status, private visibility, safe historical retention semantics and a stable digest captured through approved storage infrastructure.

## 4. Premium entitlement verification

The dedicated capability remains:

```text
FEATURE_KEYS.ASSESSMENT_PREMIUM_PUBLICATION = "assessment.premium_publication"
```

The current plan map remains explicit: Pilot, Starter and Growth are `NO`; Enterprise is `YES`. This mapping is **provisional engineering policy**, not final commercial packaging approval.

The new pure policy evaluator checks all of the following:

- subscription enforcement is explicitly enabled;
- API gates are explicitly enabled;
- the school status is exactly `active`;
- the plan is exactly `enterprise`;
- the subscription access mode permits creation; and
- the dedicated feature is enabled.

The DB-backed helper preserves a DB-free fail-closed result when either enforcement switch is disabled. API routes still obtain the school and user from the active school context through `requireSchoolAdmin`; client-provided school identity is not trusted.

Automated policy coverage verifies:

- valid explicitly enabled Enterprise/active/full access is allowed by the policy evaluator;
- either disabled switch denies;
- deactivated school denies;
- Growth denies;
- a missing feature denies; and
- read-only access mode denies.

Ordinary Core examinations remain outside this gate and were not changed. No Starter, Growth or Pilot publication grant was added.

An end-to-end signed-in route test against a seeded subscription record was not run in this pass; the resolver/provider boundary remains a release verification item.

## 5. Versioning and persistence safety

The existing additive model retains its declared unique indexes for:

- `(schoolId, definitionKey, version)`; and
- `(schoolId, definitionKey, contentHash)`.

The review confirms:

- same-content publication is idempotent through the content-hash uniqueness boundary;
- concurrent version allocation retries after a duplicate version key;
- published snapshots remain independent of later source-paper edits;
- published content projections exclude answer keys, marking guides, correct-option flags and private resource manifests by default;
- retrieval and history queries are school-scoped; and
- no production index creation or migration was executed.

### Concurrency correction

The prior supersession write updated every other published version. Under a particular interleaving, an older concurrent publisher could supersede a newer version. The service now updates only the version read as the immediate predecessor, identified by its `_id`, school and definition key. This preserves the newest publication as the current published version under the reviewed concurrent allocation pattern.

### Incomplete publication recovery

Creation and predecessor supersession are separate MongoDB writes. If predecessor supersession fails after the new version is created, the service returns the original error and makes a best-effort lifecycle-only update to mark the new version superseded, leaving the predecessor usable when the recovery write succeeds. If both writes fail, operational reconciliation is still required. A production transaction/replica-set recovery design and fault-injection test remain outstanding; this pass did not claim atomic publication.

No destructive recovery, index migration or persistent-database repair was attempted.

## 6. Changed files

Hardening changes made in this pass:

- `src/db/connectToDatabase.ts`
- `src/app/(app)/platform/proposals/page.tsx`
- `src/app/(app)/platform/proposals/[proposalId]/page.tsx`
- `src/app/(app)/platform/proposals/[proposalId]/preview/page.tsx`
- `src/lib/assess/assessment-definition-service.ts`
- `src/lib/subscriptions/assess-premium.ts`
- `src/lib/subscriptions/assess-premium-policy.ts`
- `tests/database-build-isolation.test.ts`
- `tests/assessment-publication-foundation.test.ts`
- `tests/subscription.plan-map.test.ts`
- `docs/assess/implementation/ASSESS_P01A_PUBLICATION_FOUNDATION_REPORT.md` (corrected historical build-root-cause wording)
- `docs/assess/implementation/ASSESS_P01A1_HARDENING_REPORT.md`

Pre-existing working-tree changes and unrelated REA artifacts were preserved and are not attributed to this pass.

## 7. Verification evidence

All database-backed feature/storage tests used disposable local MongoDB memory-server infrastructure. No persistent school database was used by these commands.

| Check | Result |
|---|---:|
| `node --test --import tsx tests/database-build-isolation.test.ts` | 2 passed, 0 failed |
| `node --test --import tsx tests/assessment-publication-foundation.test.ts` | 8 passed, 0 failed |
| `npm run test:subscriptions` | 155 passed, 0 failed |
| Focused Core academic regression command | 38 passed, 0 failed |
| Focused storage/config/private-access/lifecycle command | 98 passed, 0 failed |
| Targeted ESLint over changed source/tests | passed |
| `MONGODB_URI='' MONGO_DB_NAME='' npm run build` | stopped, exit 130; no DB connection observed |
| `npx --no-install tsc --noEmit --pretty false` | exit 2; 384 diagnostic lines, baseline errors outside hardened Assess files |

The first post-change publication rerun encountered the sandbox local-port restriction (`EPERM` from `mongodb-memory-server`); the same disposable test was rerun with the permitted local-port escalation and passed 8/8. No production authority was granted or used.

`git diff --check` is required as the final workspace hygiene check after this report is written.

## 8. Remaining release blockers

1. Independent security review of the resource-bearing publication contract, provider digest capture, retention/deletion behavior and candidate-facing exposure remains required.
2. Product-owner approval is still required for Enterprise-only Premium Assess packaging; the current map is provisional engineering policy.
3. Production index rollout, monitoring, compatibility window and rollback/recovery runbook have not been executed and must be approved before deployment.
4. Atomic or fault-injected publication recovery in the production MongoDB topology remains unverified.
5. The repository-wide TypeScript baseline is red, and the isolated build did not complete successfully; neither is a release-quality build gate.
6. Signed-in browser/provider/runtime verification of the new admin routes was not performed.

## 9. Recommended next action

Obtain independent review of this hardening report and close the resource-integrity and production-persistence blockers before advancing to the next Premium Assess slice. Keep attachment-bearing publication disabled until the verified storage identity and digest contract is approved.

No commits, pushes or deployments were performed.
