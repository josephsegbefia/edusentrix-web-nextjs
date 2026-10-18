# ASSESS-P02B Candidate Assignment and Identity Reconciliation Report

Date: 2026-10-15

Status: bounded implementation complete; local disposable-database verification passed. Production release approval is not implied.

## Product-owner decision

R02A-PD-005 — Candidate Reconciliation Authority — is recorded as approved in `docs/assess/rea/reports/REA_R02A_PRODUCT_DECISION_REGISTER.md`.

The approval was explicitly communicated by the EduSentrix product owner through ChatGPT and relayed in the ASSESS-P02B authorized implementation instruction on 2026-10-15. It authorizes school-admin candidate assignment and controlled two-person correction. It does not represent independent security approval, production approval, or approval of PD-008 evidence/device work.

PD-008 remains unapproved and no scanning, captured-script storage, OMR, device evidence, marking, scoring, canonical score handoff, CBT, or report-card behavior was added.

## Implemented domain contract

The implementation uses two additive persistence models:

- `AssessmentPaperPacketAssignment` stores one immutable packet/student identity assertion and its current lifecycle (`active` or `replaced`). It records school, exact delivery and packet references, authoritative `Student` reference, academic period, grade/class context, actor, timestamp, and assignment idempotency key.
- `AssessmentPaperPacketCorrection` stores an immutable correction request history with original and proposed student references, reason, requesting actor, pending/approved/rejected status, independent reviewer, rationale, and resulting assignment reference.

Active uniqueness is enforced by MongoDB indexes:

- one active assignment per school and paper packet;
- one active packet assignment per school, delivery, and student;
- unique assignment and correction idempotency identities;
- one pending correction per assignment.

An approved correction marks the original assignment `replaced` and creates a new active assignment. The original student identity is never overwritten or deleted. A rejected request leaves the original active assignment unchanged. Packet identity and published delivery/definition content remain untouched.

The current repository does not contain a separate period-effective enrollment collection. Eligibility therefore fails closed unless the authoritative `Student` record is active, school-scoped, has a non-null `enrolledAt` date on or before the delivery date/academic-period end, and matches the delivery grade and class-group scope. This is an explicit limitation, not an inferred historical enrollment claim; a future period-effective enrollment source should replace or strengthen this predicate before production use.

## Services and protected APIs

Implemented in `src/lib/assess/assessment-paper-assignment-service.ts`:

- eligible candidate search with authorized school-scoped projections;
- assignment listing and assignment-history retrieval;
- transactional packet assignment with duplicate, void, scope, eligibility, entitlement and idempotency checks;
- transactional correction request creation;
- independent correction approval/rejection with stale-state revalidation;
- historical assignment/correction serialization without QR payloads or answer-key data.

Protected routes:

- `GET/POST /api/admin/assess/assignments`
- `GET /api/admin/assess/assignments/[assignmentId]`
- `POST /api/admin/assess/assignments/[assignmentId]/correction`
- `POST /api/admin/assess/corrections/[correctionId]/review`

All routes use the existing active-school and school-admin guards, the dedicated `assessment.premium_publication` entitlement, school-scoped queries, validated ObjectIds, and idempotency headers for mutations. No public candidate lookup or QR-resolution endpoint exists.

The existing `/admin/assessments` workspace now supports selecting an issued packet, searching eligible students, assigning the packet, requesting a correction with a reason, and reviewing pending corrections. The interface explains that QR/fallback markers do not prove identity and that a different authorized administrator must review a correction.

## Security and privacy verification

- Client-provided school identity is not trusted; actor school scope comes from active authenticated membership context.
- Student eligibility is reloaded server-side inside the transaction.
- Wrong-school, non-admin, missing-entitlement, void-packet, inactive/period-ineligible, grade/class-mismatch and duplicate assignments fail closed.
- A requesting administrator cannot approve their own correction.
- Approval revalidates packet status, assignment status, original identity, proposed-student eligibility, and active-student/delivery uniqueness.
- Audit writes use the existing Tier 0 transactional hash-chain facility. Assignment, correction-request, and correction-decision actions are registered in `src/lib/audit/policy.ts` and are in the same transaction as the corresponding mutation.
- Historical records retain student references and actor attribution; packet identity remains opaque and unchanged.
- No student identity is placed in QR payloads, fallback codes, PDFs, or public projections.

Independent security review, deployed signed-in browser review, rate-limit review, and production configuration review remain outstanding.

## P02A verification findings and corrections

The P02A packet generation path previously calculated a page count and persisted `issued` packets before the first final PDF render. The bounded correction now preflights `buildPaperPacketPdf` using the exact generated packet identity and manifest before `insertMany`. A renderer failure therefore aborts before issuance and retry preserves the caller's idempotency contract rather than creating a misleading issued packet.

The PDF renderer already performs a two-pass page-count check. Existing synthetic PDF verification confirms page-manifest/page-count agreement, QR/fallback placement, immutable snapshot content, and exclusion of expected answers, marking guides and explanations. The renderer's pagination paths remain covered at implementation level; a dedicated long-question golden-PDF fixture remains a release follow-up. No provider or live storage was contacted.

Packet generation, download, reprint and void actions remain durable Tier 0 audit operations. Transactional audit failure aborts the domain mutation. Existing P02A packet route and audit tests were rerun.

## Persistence, transaction and rollback strategy

Transactions use the same replica-set transaction policy as P02A: snapshot reads, majority writes, bounded commit time, transient-transaction retries, and no standalone fallback. Critical assignment/correction audit writes share the domain transaction.

Rollback is additive and recoverable: deployment rollback must leave the new collections unused and preserve packet/publication history. No production migration or index build was executed. Before production rollout, operators must preflight duplicate legacy data, create the declared indexes through the approved migration process, verify replica-set/majority-write support, observe duplicate-key and transaction metrics, and define a forward recovery procedure. Immutable assignment and correction history must not be deleted during rollback.

## Test evidence

All new model/service tests used synthetic records and disposable `MongoMemoryReplSet` instances.

- `node --test --import tsx tests/assessment-paper-assignment.test.ts tests/assessment-paper-assignment-route.test.ts` — exit 0; 8 passed, 0 failed.
- `node --test --import tsx tests/assessment-paper-packet-foundation.test.ts tests/assessment-paper-packet-route.test.ts tests/assessment-delivery-foundation.test.ts tests/assessment-delivery-route.test.ts` — exit 0; 22 passed, 0 failed.
- `node --test --import tsx tests/assessment-publication-foundation.test.ts tests/assessment-publication-route.test.ts tests/assessment-publication-atomicity.test.ts tests/assessment-publication-transaction-unavailable.test.ts` — exit 0; 26 passed, 0 failed.
- `node --test --import tsx tests/audit.policy.test.ts` — exit 0; 3 passed, 0 failed.
- `node --test --import tsx tests/assessment-engine.assessment-mutations.test.ts tests/assessment-engine.score-atomicity.integration.test.ts tests/assessment-engine.score-writer-closure.integration.test.ts` — exit 0; 26 passed, 0 failed.
- `npm run test:subscriptions` — exit 0; 155 passed, 0 failed.
- Targeted `npx --no-install eslint` over the new models, service, routes, P02A service, and assessment workspace — exit 0.
- `git diff --check` — exit 0.

Repository TypeScript diagnostic review:

- `npx --no-install tsc --noEmit --pretty false --incremental false` — exit 2 because of pre-existing/generated `.next` proposal-page diagnostics and unrelated repository diagnostics. A targeted scan of the captured log found no P02B model, service, route, or workspace diagnostics.

Sanitized build verification:

```text
NEXT_TELEMETRY_DISABLED=1 APP_RUNTIME_MODE=development APP_URL=http://localhost:3000 NEXT_PUBLIC_APP_URL=http://localhost:3000 MONGODB_URI=mongodb://127.0.0.1:1/isolated-p02b-build MONGO_DB_NAME=isolated-p02b-build npm run build -- --debug
```

The build reached `Creating an optimized production build ...` and reproduced the known Next.js optimized-compile stall. It emitted no MongoDB connection evidence, was boundedly interrupted, and exited 130. This is incomplete build evidence, not a pass. No persistent development, demo, staging or production database was accessed.

## Changed files

Added:

- `src/models/AssessmentPaperPacketAssignment.ts`
- `src/models/AssessmentPaperPacketCorrection.ts`
- `src/lib/assess/assessment-paper-assignment-service.ts`
- `src/app/api/admin/assess/assignments/route.ts`
- `src/app/api/admin/assess/assignments/[assignmentId]/route.ts`
- `src/app/api/admin/assess/assignments/[assignmentId]/correction/route.ts`
- `src/app/api/admin/assess/corrections/[correctionId]/review/route.ts`
- `tests/assessment-paper-assignment.test.ts`
- `tests/assessment-paper-assignment-route.test.ts`
- this report

Modified:

- `docs/assess/rea/reports/REA_R02A_PRODUCT_DECISION_REGISTER.md` — recorded only PD-005 approval.
- `src/lib/audit/policy.ts` — registered assignment/correction Tier 0 actions.
- `src/lib/assess/assessment-paper-packet-service.ts` — added issuance PDF preflight.
- `src/components/admin/assess/AssessmentDeliveryWorkspace.tsx` — added assignment and correction controls and P02A preflight messaging.

Unrelated working-tree changes were preserved. No package, lockfile, subscription packaging, provider, migration, production configuration, Core academic model, score writer, marking, scanner, or report-card file was changed.

## Remaining release blockers

1. Production index rollout and replica-set transaction verification have not been approved or executed.
2. The repository-wide TypeScript gate remains red on baseline/generated diagnostics.
3. The sanitized production build remains incomplete because of the known Next.js compile stall.
4. There is no period-effective enrollment history model; current eligibility is deliberately narrower and should receive product/architecture review before historical-period production use.
5. Signed-in browser verification, deployed authorization checks, operational rate limits, and independent security review remain outstanding.
6. Premium packaging remains provisional Enterprise-only under the existing fail-closed policy; this slice did not alter pricing or plan grants.

## P02C readiness

The local candidate-assignment and identity-reconciliation foundation is ready for independent review of this bounded slice. It is not production-ready and does not authorize P02C. Any future evidence/scanning work must separately address PD-008, period-effective enrollment authority, private evidence retention, device trust, and the unresolved build/typecheck/operational gates. No P02C implementation was started.
