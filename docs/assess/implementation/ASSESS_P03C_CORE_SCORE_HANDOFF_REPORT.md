# EduSentrix Assess — ASSESS-P03C Core Score Handoff Report

**Date:** 2026-10-16 (Africa/Accra)  
**Status:** Bounded local implementation complete; independent security and release review required  
**Repository:** `edusentrix-web-nextjs`  
**Branch:** `feat/assess-rea-foundation`

## 1. Authorization and boundary

The product owner explicitly authorized the bounded P03C policy on 2026-10-16 through ChatGPT, as relayed in the implementation instruction. The authorization permits local implementation and synthetic/disposable verification of a guarded handoff from a current immutable independently approved Premium marking outcome into the existing canonical Core `AssessmentScore` writer.

The three P03C policy decisions are recorded in [REA_R02A_PRODUCT_DECISION_REGISTER.md](../rea/reports/REA_R02A_PRODUCT_DECISION_REGISTER.md) under `ASSESS-P03C-AUTH`. The register records product authorization only. It does not approve production use, live student score writes, deployment, report-card release, correction workflows, subscription packaging, or R02A-PD-007 entitlement-expiry continuity.

No CBT, OMR, scanner, digital-marking redesign, parallel result engine, report-card publication, production operation, provider access, commit, or push was performed.

## 2. Implemented outcome

P03C now provides an explicit `handoffApprovedMarkingOutcome` service and admin route. The service writes one canonical `AssessmentScore`, one durable handoff receipt, and one Tier 0 audit event inside the same MongoDB transaction.

The handoff is accepted only when all of the following remain true inside the transaction:

- the actor is an active same-school school administrator with the dedicated `assessment.premium_publication` capability;
- the source is one current `AssessmentApprovedMarkingOutcome` with an immutable approved revision;
- the published definition and delivery remain the exact hash identities approved by the outcome;
- the delivery is explicitly `score_bearing` and binds to the same-school `AssessmentPlan` and `AssessmentItem`;
- the plan, item, period, subject, grade, class group, active student and delivery class group still agree;
- the issued packet, candidate assignment, marking assignment and independent reviewer assignment still point to the same candidate and delivery;
- there is no pending candidate correction, stale assignment, superseded outcome or ambiguous second current outcome;
- all evidence pages, confirmed evidence receipts and private ready assets remain school-scoped, associated, accepted, verified and digest/size-consistent;
- the approved question scores are complete, bounded, finite and at most two decimal places;
- the recomputed total equals both the immutable outcome and approved revision totals;
- the source maximum, definition maximum and Core item maximum are identical.

Only identity raw-mark mapping is supported. There is no silent scaling, rounding, averaging or conversion. Unsupported maxima fail closed before any Core score write.

The canonical writer creates a recorded `AssessmentScore` with the existing Core identity `(schoolId, assessmentItemId, studentId)`, the item’s academic binding, score, maximum snapshot, percentage, actor and timestamps. It refuses to overwrite an existing score and converts a concurrent duplicate into a conflict.

P03C does not write `SubjectResult`, `ReportCardRun`, `StudentReportCard` or any report-card release state. A successful handoff is a canonical raw-score write only.

## 3. Durable receipt and idempotency contract

`AssessmentScoreHandoffReceipt` is an additive model. It records:

- source approved outcome and approved revision;
- immutable definition and delivery identities;
- student, plan, item and canonical Core score identities;
- source and applied totals/maxima plus the explicit identity scaling record;
- stable source operation identity and request idempotency key;
- source outcome integrity reference;
- school-admin actor, entitlement key, Tier 0 audit identity and lifecycle timestamps.

The receipt model has named indexes for:

- one source operation per school;
- one request idempotency key per school;
- one completed handoff per school/item/student;
- reconciliation lookup by school/outcome/status.

Provenance fields are protected by Mongoose save/update/delete hooks. A completed receipt is replayed by either the request idempotency key or stable source operation identity. A different request key for the same source outcome is safe; a key already bound to another outcome conflicts. A pre-existing Core score or completed target receipt never gets overwritten.

Successful receipts are created as `completed` only after the Core score and Tier 0 audit event have been prepared in the transaction. The receipt schema also reserves `pending` and `failed` states, but this slice deliberately does not persist a failed receipt after a transaction abort: injected failures roll back the score, receipt and audit together rather than creating a misleading partial academic state.

## 4. API and administrator experience

Added:

- `POST /api/admin/assess/approved-outcomes/[outcomeId]/handoff`
  - requires the existing school-admin gate, Premium capability gate and `x-idempotency-key`;
  - returns `201` for a new handoff, `200` for an idempotent replay, and fail-closed `400/403/404/409/503` errors.
- `GET /api/admin/assess/approved-outcomes/[outcomeId]/handoff`
  - returns the school-scoped completed receipt status for an authorized administrator.

The marking administrator panel now shows approved totals and a guarded “Transfer to Core” action. After completion it displays the canonical score and receipt identity. The control is not shown as a report-card publication or as an automatic correction mechanism.

## 5. Security and tenant controls

- School scope is present on every source, academic, evidence, receipt and Core-score lookup.
- The service rechecks active `User` and `UserMembership` records rather than trusting only route-provided identity.
- The dedicated Premium capability is required; ordinary Core examinations and existing Core score entry remain available independently.
- Entitlement packaging remains provisional Enterprise-only under the existing policy. Starter, Growth and Pilot are not granted this capability.
- Answer keys, marking guides and private evidence content are not copied into the receipt or audit payload.
- The Tier 0 audit event records source, binding, score and provenance identifiers without sensitive answer content and uses the existing transactional audit mechanism.
- Same-school identity, delivery, packet and evidence relationships are revalidated immediately before the write.

## 6. Failure, concurrency and recovery behavior

The handoff transaction uses snapshot reads, majority writes and bounded transient/unknown-commit retry through MongoDB `withTransaction`. The canonical score writer performs an in-transaction existing-score check and relies on the existing unique score identity to reject concurrent first writes.

Verified behaviors include:

- same request replay returns the original receipt and does not create a second score;
- concurrent different request keys produce one canonical score and one completed receipt, with the losing request either conflicting or replaying the committed receipt;
- an existing Core score is never overwritten;
- failure after Core score creation rolls back the Core score, receipt and audit;
- failure after receipt save also rolls back all three effects;
- non-reporting delivery, unsupported maximum mapping, wrong school, missing membership and expired/missing capability fail closed;
- no report-card or `SubjectResult` record is created by handoff.

The P03C adapter closes the deferred durable receipt boundary for this Premium-to-Core handoff. The earlier ordinary teacher/Studio writers retain their separately hardened conditional-write behavior; this slice does not claim that every legacy writer has durable exactly-once receipts or that a production reconciliation worker exists.

## 7. Verification evidence

All database-backed P03C and related Assess tests used synthetic data and disposable local MongoDB instances. No persistent school, demo or production database was accessed. Storage tests used their disposable local fixture; no live R2/provider was contacted.

| Check | Result |
|---|---|
| `npx tsx --test tests/assessment-score-handoff.integration.test.ts` | **exit 0; 8 passed, 0 failed** |
| `node --test --import tsx tests/assessment-score-handoff-route.test.ts` | **exit 0; 5 passed, 0 failed** |
| Assess publication, delivery and marking regression group | **exit 0; 51 passed, 0 failed** |
| Core score atomicity/writer closure, assessment mutations, evidence, paper packet and entitlement group | **exit 0; 62 passed, 0 failed** |
| `npm run test:subscriptions` | **exit 0; 155 passed, 0 failed** |
| `node --test --import tsx tests/storage/signed-url-route.test.ts` | Initial sandbox attempt was blocked by disposable Mongo port-bind `EPERM`; the same test was rerun with local sandbox escalation and **exited 0 with 11 passed, 0 failed** |
| Scoped ESLint over P03C model, service, route, Core writer, audit policy, marking panel and tests | **exit 0** |
| `npx tsc --noEmit --pretty false` | **exit 2; 384 repository diagnostics**. No diagnostics matched the P03C model, service, route, Core writer, audit policy, panel or P03C test paths. Existing diagnostics include generated Next proposal validators and unrelated academic-profile, storage-helper and teacher-import tests. |
| Sanitized `npm run build -- --experimental-build-mode compile --debug` with `MONGODB_URI=mongodb://127.0.0.1:1/isolated-p03c-build-verification` | Reached optimized-build creation without a MongoDB connection line, then stalled with no progress and was bounded with Ctrl-C; **exit 130**. This is not reported as a build pass. |
| `git diff --check` | **exit 0; no whitespace errors** |

The sanitized build used an unroutable local MongoDB port and isolated database name. The observed output showed `.env.local` as an environment source in Next, but no persistent MongoDB connection was made by the bounded attempt. Full production build completion, signed-in browser behavior, deployed runtime behavior and provider verification remain unperformed.

## 8. Changed-file summary

P03C changes are limited to the following files; unrelated dirty-worktree changes were preserved:

- `docs/assess/rea/reports/REA_R02A_PRODUCT_DECISION_REGISTER.md`
- `src/models/AssessmentScoreHandoffReceipt.ts`
- `src/lib/assess/assessment-score-handoff-service.ts`
- `src/lib/academics/assessment-engine/assessment-score-service.ts`
- `src/lib/audit/policy.ts`
- `src/app/api/admin/assess/approved-outcomes/[outcomeId]/handoff/route.ts`
- `src/lib/assess/assessment-marking-service.ts`
- `src/components/admin/assess/AssessmentMarkingAssignmentPanel.tsx`
- `tests/assessment-score-handoff.integration.test.ts`
- `tests/assessment-score-handoff-route.test.ts`
- this report

No production index migration was executed. The new receipt indexes exist in the model definition only. A future rollout must inspect duplicate data, create the named indexes through the approved migration path, verify readiness, and define a rollback that removes only those new indexes.

## 9. Remaining release blockers and readiness

P03C is ready for independent code and security review in the synthetic local environment. It is not approved for production or live student academic use.

Remaining blockers are:

1. The repository-wide TypeScript gate remains red for unrelated existing diagnostics.
2. The sanitized Next compile did not complete in this environment; no full build pass is claimed.
3. Deployment topology must prove replica-set transaction support, retry/unknown-commit behavior and operational receipt reconciliation.
4. Production index rollout, duplicate-data preflight, monitoring, alerting and rollback are not executed.
5. No signed-in browser/admin workflow, deployed route, live storage/provider or production-like tenant test was performed.
6. Entitlement-expiry continuity remains unresolved under R02A-PD-007, and Enterprise-only packaging remains provisional.
7. Correction/reversal workflows, report-card contribution/release and downstream recalculation remain intentionally outside P03C.

The implementation stops at the P03C boundary for independent review. It does not begin P04, R02B or another research/implementation phase automatically.
