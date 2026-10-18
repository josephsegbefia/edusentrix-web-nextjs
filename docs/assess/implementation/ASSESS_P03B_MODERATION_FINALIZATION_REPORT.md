# ASSESS-P03B — Moderation, Marking Integrity and Approved Result Finalization

**Repository:** `edusentrix-web-nextjs`  
**Branch:** `feat/assess-rea-foundation`  
**Status:** bounded implementation complete; independent review required  
**Observation date:** 2026-10-16

## 1. Scope and authorization

P03B was implemented as the continuation of P03A. It uses **R02A-PD-009**, recorded as approved by the product owner on 2026-10-15 through ChatGPT and relayed in the authorized P03A implementation instruction. That approval covers scoped marking assignments, independent moderation, append-only evaluation history and controlled correction decisions.

This slice does not authorize Core score writes, report-card changes, production handling of real scripts, double-mark averaging, AI/OMR/CBT, or a commercial change to subscription packaging. It does not represent independent security certification or production approval.

## 2. Implemented changes

### Reviewer authority and independence

Added `AssessmentMarkingReviewerAssignment` as an additive, school-scoped contract. It binds an active reviewer to one marking assignment, delivery, definition, packet and packet-assignment identity. The service now requires:

- an active same-school `UserMembership` with the `school_admin` role;
- an active same-school `User` record;
- an explicit active reviewer assignment for the script;
- a reviewer identity different from the submitting marker, including when a person holds multiple roles;
- matching delivery, definition and candidate-assignment identities.

Reviewer assignment and revocation are transactionally audited. Revocation prevents new moderation actions; an already committed idempotent decision may still be safely replayed. An active reviewer assignment is completed only after approval and remains active through a return/correction cycle.

Added routes:

- `POST /api/admin/assess/marking-review-assignments`
- `POST /api/admin/assess/marking-review-assignments/:reviewerAssignmentId/revoke`

### Lifecycle and consistency

`reviewMarkingEvaluation` now performs the following inside the same transaction as the revision, evaluation transition, approved outcome and Tier 0 audit write:

1. Reconciles a prior idempotency record before authorizing a new action.
2. Rejects a mismatched idempotency key, actor, decision or reason.
3. Requires `submitted` state for a new moderation decision.
4. Requires active explicit reviewer authority and active membership.
5. Revalidates the published definition, delivery, issued packet, authoritative active candidate assignment, assignment identity and question catalog.
6. Recomputes and verifies the question-level total; null/unmarked scores cannot be silently treated as zero.
7. Creates an append-only `returned` or `approved` revision.
8. Creates an approved outcome only for approval.
9. Transitions the evaluation and writes the complete audit event in the same transaction.

Concurrent approval/return therefore has one legal winner; a losing transaction observes the newer lifecycle state and fails with a conflict. Unknown commit results retry through the existing transaction helper and reconcile through the revision idempotency record.

The evaluation model now prevents approved score mutation and approved lifecycle reopening through document saves and guarded update paths. Revision and outcome records remain append-only. Raw MongoDB collection access is outside application middleware guarantees and remains an operational trust boundary; application code must continue using the service contract.

### Immutable approved Premium outcome

Added `AssessmentApprovedMarkingOutcome`. It stores a stable snapshot containing:

- school, definition and delivery version IDs and content hashes;
- paper packet, authoritative candidate assignment and student IDs;
- marking assignment, evaluation, reviewer assignment and approved revision IDs;
- ordered question scores, published maxima, server-computed total and unmarked count;
- question-catalog digest;
- verified evidence page IDs, page identities, page numbers, private asset IDs, confirmed receipt IDs, SHA-256 digests and byte sizes;
- evidence provenance digest and deterministic integrity reference;
- approving reviewer and approval time;
- `coreResultStatus: not_written` and `scoreHandoffStatus: not_authorized`.

Named unique indexes prevent duplicate outcome keys, duplicate approved revisions and more than one `current` outcome per marking assignment. The approved outcome is retrieved through the school-scoped service and route:

- `GET /api/admin/assess/marking-evaluations/:evaluationId/approved-outcome`

The existing admin evaluation projection also includes reviewer history and a read-only approved-outcome projection. No `AssessmentScore`, canonical academic result or report-card write is performed.

### Evidence and candidate consistency

Approval now fails closed unless every packet-manifest page is accepted, verified and integrity-verified; every page has a confirmed receipt; every receipt has a ready private `StoredAsset`; the asset belongs to the same school, is associated with the exact evidence page and has matching size; and the page verified digest equals the receipt digest. Pending candidate correction, inactive/replaced packet assignment, delivery drift, definition hash drift or assignment identity drift blocks approval.

This establishes structural and recorded digest provenance. It does not perform a new provider read or claim a fresh byte-level storage verification during approval.

### Audit policy

Registered Tier 0 policies were added for reviewer assignment and revocation. Approval and return now require before/after lifecycle data. Approval/return metadata includes the school, definition, delivery, packet, authoritative assignment, marking assignment, evaluation, revision, reviewer assignment, actor, previous/resulting status, total/max/unmarked values, evidence provenance digest and integrity reference. Prohibited answer-key and marking-guide payload patterns remain excluded from audit payloads.

### Administrator experience

`AssessmentMarkingAssignmentPanel` now exposes active school-admin reviewer candidates, assignment state, reviewer identity/status, and a wired reviewer-assignment action before review. The existing script preview, question marks, feedback, reasoned approve/return controls and evidence navigation remain in place. Approved outcome totals and integrity references are displayed read-only when an approved evaluation is opened.

Double marking was inspected but not implemented. A second marker would require a different uniqueness/evaluation model and an explicit adjudication policy; no averaging, tolerance or automatic adjudication was introduced.

## 3. Verification evidence

All database-backed tests used disposable `MongoMemoryReplSet` instances and synthetic evidence with the fake R2 port. No live database, Clerk account, R2 provider, production index or real student script was used.

| Check | Result |
|---|---|
| `node --test --import tsx tests/assessment-marking.test.ts tests/assessment-marking-route.test.ts` | exit 0; 12 passed, 0 failed |
| P03B moderation scenarios | reviewer authority, self-review, wrong school, revoked membership, duplicate/idempotent approval, concurrent approve/return, stale evidence, pending correction, immutable outcome, audit rollback and unknown-commit retry covered |
| `node --test --import tsx tests/assessment-evidence.test.ts tests/assessment-paper-assignment.test.ts tests/assessment-paper-assignment-route.test.ts tests/assessment-engine.assessment-mutations.test.ts tests/assessment-engine.score-atomicity.integration.test.ts tests/assessment-engine.score-writer-closure.integration.test.ts tests/subscription.plan-map.test.ts` | exit 0; 64 passed, 0 failed |
| Scoped `npx eslint` over P03B models, service, routes, panel, audit policy and tests | exit 0 |
| P03B-filtered `npx tsc --noEmit --pretty false` diagnostics | no matching diagnostics for P03B paths; the filter returned 1 because `rg` found no matching lines |
| Full `npx tsc --noEmit --pretty false` | exit 1 with 736 diagnostic lines; repository-wide diagnostics remain outside this slice and include pre-existing proposal, academic DTO, scripts and unrelated route/test issues |
| Sanitized `npm run build -- --experimental-build-mode compile --debug` with `MONGODB_URI=mongodb://127.0.0.1:1/isolated-build-verification` and isolated DB name | first controlled run exit 0; compile completed successfully and P03B routes appeared in the route manifest; no persistent database connection was permitted |
| Repeated sanitized compile with output captured for exit-code confirmation | stalled after `Creating an optimized production build ...` without a MongoDB connection line; bounded run was terminated after no progress, exit 143; this is recorded as an unresolved local build-environment limitation, not a pass |
| `git diff --check` | exit 0; no whitespace errors |

The compile verification was intentionally Next `compile` mode. Next reported that a separate `generate` or `generate-env` mode is needed to finalize the build. The first run is local compile evidence only; the repeated run demonstrates that the compile phase is not consistently bounded in this environment. This is not full production-build, signed-in browser, provider, deployment or runtime evidence.

## 4. Changed-file summary

P03B touched or added:

- `src/models/AssessmentMarkingReviewerAssignment.ts`
- `src/models/AssessmentApprovedMarkingOutcome.ts`
- `src/models/AssessmentMarkingEvaluation.ts`
- `src/lib/assess/assessment-marking-service.ts`
- `src/lib/audit/policy.ts`
- `src/app/api/admin/assess/marking-review-assignments/route.ts`
- `src/app/api/admin/assess/marking-review-assignments/[reviewerAssignmentId]/revoke/route.ts`
- `src/app/api/admin/assess/marking-evaluations/[evaluationId]/approved-outcome/route.ts`
- `src/app/api/admin/assess/marking-evaluations/[evaluationId]/review/route.ts`
- `src/components/admin/assess/AssessmentMarkingAssignmentPanel.tsx`
- `tests/assessment-marking.test.ts`
- `tests/assessment-marking-route.test.ts`
- this report

The worktree contains substantial earlier REA/P01–P03A and unrelated user changes. They were preserved and not reverted. No commit, push, deployment or production index operation was performed.

## 5. Future Core handoff contract — proposal only

The future handoff slice should expose a read-only retrieval contract first:

```text
getApprovedMarkingOutcomeForHandoff(
  schoolId,
  outcomeId,
  expectedDeliveryId,
  expectedDefinitionId,
  expectedStudentId,
  expectedIntegrityReference
) -> current approved outcome or typed stale/superseded/conflict error
```

The writer must require a score-bearing published delivery, an immutable published definition, one authoritative student/packet assignment, approved revision and current outcome status, exact `AssessmentPlan`/`AssessmentItem` binding, total/max marks, stable handoff identity, approval/audit provenance and an idempotency key. It must implement a durable receipt, atomicity/retry semantics and stale/supersession detection before any Core write is authorized. The eventual writer must use the existing canonical Core score engine; it must not create a second result engine.

That slice requires separate product-owner and security authorization, completion of the deferred durable score-writer/receipt design in `REA_00C1B_A_SCORE_WRITER_CLOSURE_REPORT.md`, and a migration/rollback review. P03B deliberately does not implement it.

## 6. Remaining release blockers and P02B/P03B limitations

- Production index rollout has not occurred. Before deployment, inspect for duplicate/conflicting records, build the named reviewer/outcome indexes through the approved migration path, verify index readiness and rollback by dropping only the new named indexes if necessary. No migration was executed here.
- The current subscription mapping remains provisional Enterprise-only for Premium publication; no Starter, Growth or Pilot access was added and no commercial packaging decision was made.
- Double marking/adjudication remains deferred.
- Approved-outcome supersession for a later authorized correction is represented as a future contract, not an implemented correction writer. The original approved record is never destructively edited.
- No full generate-mode production build, signed-in browser moderation walkthrough, live storage verification or deployed-runtime verification was performed.
- The repeated compile stall remains a release-environment blocker until its resource/process cause is diagnosed; it did not emit a persistent-database connection and was not attributed to the database guard.
- Core score handoff, report-card contribution and official academic-result writes remain outside P03B.

## 7. Readiness assessment

The bounded Premium marking workflow is locally ready for independent code/security review: a complete synthetic marking can be assigned, submitted, independently assigned to an authorized reviewer, returned or approved, and represented as one immutable Premium outcome without a Core write. It is not approved for production use or Core handoff until the blockers above are independently reviewed and explicitly authorized.

Stop boundary respected: ASSESS-P02/P03B verification is complete and ASSESS Core handoff has not been started.
