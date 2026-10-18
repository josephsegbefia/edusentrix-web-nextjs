# ASSESS-P01B Delivery Foundation Report

Date: 2026-10-15

Status: bounded implementation complete; local verification passed for the implemented delivery slice. Production release approval is not implied.

## Scope

P01B adds the immutable delivery-configuration boundary that sits between a published `AssessmentDefinitionVersion` and any future candidate-delivery runtime. The implemented mode is paper configuration only. Candidate assignment, paper packet identity, printing, scanning, OMR, CBT runtime, digital marking, score handoff, and report-card behavior remain out of scope.

The implementation preserves the approved separation between mutable examination authoring, immutable assessment-definition publication, and the existing canonical academic result engine.

## Implemented contracts

### Delivery persistence model

`AssessmentDeliveryVersion` is an additive Mongoose model. It stores:

- school-scoped delivery identity and delivery-key versioning;
- the source published definition and its content hash;
- ordered delivery configuration for the current paper mode;
- academic context and optional scheduled-session/timetable references;
- immutable timing policy, including duration, late-entry allowance, and server-authoritative timing;
- `none` versus `score_bearing` result binding;
- exact `AssessmentPlan`/`AssessmentItem` references for score-bearing deliveries;
- review, publication, supersession, pause, closure, and archival lifecycle metadata;
- accessibility policy fields for extra time, large print, and reader/scribe support;
- answer-key access and candidate-access policy metadata.

Published content/configuration fields are protected by model update hooks. Lifecycle attribution and transition metadata remain mutable only through the lifecycle operations.

The model declares new, delivery-scoped indexes for school/delivery/version uniqueness, school/delivery/content-hash idempotency, source-definition history lookup, and school/status lookup. No production index migration was run.

### Publication service

`src/lib/assess/assessment-delivery-service.ts` provides:

- school-admin and Premium entitlement authorization;
- source-definition existence, publication, school, and academic-context validation;
- paper-mode configuration validation;
- explicit non-reporting and score-bearing binding validation;
- deterministic content hashing of the delivery configuration plus source-definition hash;
- transaction-backed draft creation with bounded transient retries;
- `draft -> review -> published` lifecycle enforcement;
- latest-version and expected-current-version checks;
- atomic publication and supersession of the current published/active/emergency-paused predecessor;
- same-content replay/idempotency handling;
- school-scoped retrieval and history listing;
- confidential administrator projections that do not include definition sections, questions, expected answers, marking guides, or resource manifests.

Transactions are required for creation and publication. The service fails closed with an unavailable response when transaction support is not available; it does not silently fall back to a non-atomic write path.

### API and admin surface

The following routes were added:

- `GET/POST /api/admin/assess/deliveries`
- `GET /api/admin/assess/deliveries/[deliveryId]`
- `POST /api/admin/assess/deliveries/[deliveryId]/review`
- `POST /api/admin/assess/deliveries/[deliveryId]/publish`

All routes require authenticated school-admin context, active school scope, and the dedicated `assessment.premium_publication` capability. Responses use delivery summaries/configuration only and do not expose answer-key material.

`/admin/assessments` provides a truthful administrative workspace for creating a paper delivery draft, submitting it for review, publishing it, and viewing version history. It explicitly identifies unavailable candidate-delivery and capture capabilities instead of presenting placeholder controls.

## Security and entitlement findings

- School ownership and tenant scope are enforced in source-definition, timetable/session, academic-plan/item, delivery, and history queries.
- Non-admin actors, missing identity, missing school scope, inactive school context, and missing/invalid Premium entitlement fail closed.
- Existing Core examination functionality and the ordinary examination entitlement are unchanged.
- Premium publication continues to use the dedicated `assessment.premium_publication` capability. The current Enterprise-only mapping remains provisional and is not commercial packaging approval; Starter, Growth, and Pilot are not granted this capability.
- Answer keys, marking guides, expected answers, private resource manifests, and definition question content are excluded from the delivery projections and route responses tested here.
- No live storage provider, persistent school database, or production environment was contacted.

## Versioning, concurrency, and recovery

The current invariant is: for a given school and delivery key, at most one delivery version may be in the current published-family state (`published`, `active`, or `emergency_paused`), and the latest successfully published version is the current version. A publication request must target the latest version and, when a predecessor exists, acknowledge the expected current version.

Publication updates the target and predecessor in one MongoDB transaction. Unique delivery/version and content-hash indexes support version allocation and same-content replay. Historical versions remain immutable after publication.

The focused suite verifies:

- concurrent publication of one reviewed draft is idempotent;
- corrected-version publication supersedes the predecessor atomically;
- stale current-version acknowledgements are rejected;
- failed predecessor supersession rolls back the target publication;
- historical delivery content remains unchanged;
- same-content and lifecycle replay behavior does not create contradictory current publications.

This is local disposable replica-set evidence, not proof of production MongoDB topology or operational recovery readiness. A future production rollout needs a reviewed index migration plan, replica-set/transaction prerequisites, rollout observation, duplicate-data preflight, and a rollback procedure that does not delete immutable history. No index migration was executed by P01B.

## Verification evidence

### Passed

- `node --test --import tsx tests/assessment-delivery-foundation.test.ts` — exit 0; 10 passed, 0 failed. Tests used a disposable `MongoMemoryReplSet`.
- `node --test --import tsx tests/assessment-delivery-route.test.ts` — exit 0; 3 passed, 0 failed. Tests used a disposable `MongoMemoryReplSet` and synthetic identity/subscription fixtures.
- Targeted ESLint over the P01B model, service, routes, page, workspace, navigation files, and focused tests — exit 0.
- Prior bounded regression run — publication/P01A aggregate 26 passed, subscription 155 passed, focused Core academic 38 passed, build-isolation 2 passed.
- `git diff --check` — exit 0.
- Additional trailing-whitespace scan over the P01B files and report — no matches.

### TypeScript limitation

`npx --no-install tsc --noEmit --pretty false` was run against the repository. It produced the repository's existing broad diagnostics and did not identify a direct P01B source error in the inspected log. Two generated `.next/dev/types/validator.ts` diagnostics referenced `/admin/assessments` as absent from stale generated route types; the full output also contains unrelated pre-existing proposal-page diagnostics. This is not reported as a repository-wide typecheck pass.

### Build limitation

After database isolation was verified, a controlled build was attempted with:

```text
NEXT_TELEMETRY_DISABLED=1 APP_RUNTIME_MODE=development APP_URL=http://localhost:3000 NEXT_PUBLIC_APP_URL=http://localhost:3000 MONGODB_URI=mongodb://127.0.0.1:1/isolated-build-verification MONGO_DB_NAME=isolated-build-verification npm run build -- --debug
```

The build loaded `.env.local` as reported by Next.js, reached `Creating an optimized production build ...`, emitted no MongoDB connection evidence, and made no persistent-database connection. It then stalled at the known compile phase and was stopped after a bounded wait. The command is therefore incomplete, not a pass. Existing build-time database refusal and dynamic-page protections remain in place.

## Changed-file summary

P01B-added files:

- `src/models/AssessmentDeliveryVersion.ts`
- `src/lib/assess/assessment-delivery-service.ts`
- `src/app/api/admin/assess/deliveries/route.ts`
- `src/app/api/admin/assess/deliveries/[deliveryId]/route.ts`
- `src/app/api/admin/assess/deliveries/[deliveryId]/review/route.ts`
- `src/app/api/admin/assess/deliveries/[deliveryId]/publish/route.ts`
- `src/app/(app)/admin/assessments/page.tsx`
- `src/app/(app)/admin/assessments/layout.tsx`
- `src/components/admin/assess/AssessmentDeliveryWorkspace.tsx`
- `tests/assessment-delivery-foundation.test.ts`
- `tests/assessment-delivery-route.test.ts`
- this report

P01B-touched existing files:

- `src/components/nav/sidebars/admin-main-content.tsx`
- `src/components/nav/sidebars/school-admin-sidebar.tsx`

The report intentionally does not list unrelated dirty files already present in the worktree. No existing model, database index migration, subscription plan map, or Core academic score engine was modified for P01B.

## Remaining operational gates

1. Resolve or separately triage the repository-wide/generated TypeScript diagnostics and reproduce the Next.js compile stall in an approved build environment.
2. Review and execute the delivery index rollout only through an approved production migration process with duplicate/conflict preflight and rollback evidence.
3. Validate transaction behavior, observability, retry limits, and recovery procedures against the supported production MongoDB topology without using school data in local tests.
4. Obtain explicit product approval for final Premium plan packaging; the current Enterprise-only mapping is provisional.
5. Complete independent security/release review, including deployed route checks and signed-in browser verification.
6. Define and separately approve paper packet identity, candidate assignment, printing, and capture contracts before implementing them. R02A-PD-004 remains unresolved.

## P02 readiness assessment

P01B is ready for independent review of the bounded local implementation, but not for production release or automatic progression to P02. P02 entry should require accepted delivery lifecycle semantics, approved production index/transaction operations, closure of the build/typecheck limitations, and an explicit decision on the next candidate-delivery boundary. No candidate attempt, packet, scanning, CBT, digital marking, canonical score write, or report-card integration was started.
