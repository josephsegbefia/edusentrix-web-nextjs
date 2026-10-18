# EduSentrix School OS — School Activation Onboarding Decoupling Report

**Corrective pass:** Allow Platform Administrators to activate schools before setup completion
**Date:** 2026-10-16
**Repository:** `edusentrix-web-nextjs`
**Status:** Implemented and locally verified; not production approval

## Scope and authorization

The product owner explicitly authorized this corrective pass on October 16, 2026. The implementation is limited to the school lifecycle activation boundary and the confirmed Platform Admin school-detail subscription projection defect. It does not implement or change Assess delivery, marking, score handoff, payment processing, subscription packaging, onboarding completion, role assignment, or production operations.

## Confirmed pre-change behavior

The existing `POST /api/platform/schools/[id]/activate` route only transitioned `deactivated` schools to `active`. It used the platform school-read authorization path, accepted no reason, and did not write a transactional lifecycle audit event. A pending school therefore could not be activated before setup completion.

The Platform Admin school-detail projection also returned `subscription: null` unconditionally, while the school subscription page read `SchoolSubscription` independently. This was a confirmed projection defect, not evidence that a subscription record was absent. No billing records were modified.

## Implemented lifecycle contract

### Pending-school activation

`POST /api/platform/schools/[id]/activate` now:

- requires the exact `platform.schools.activate` platform permission;
- validates a trimmed administrative reason of 8–1000 characters;
- transitions only `pending → active`;
- leaves setup, onboarding, payment, subscription, memberships, and roles unchanged;
- records the setup snapshot visible at activation time; and
- returns a structured success result with the school status, transition outcome, and setup progress.

Activation is deliberately independent of setup completion. It works for 0%, partially configured, and 100% setup states.

### Deactivated-school reactivation

The prior deactivated-school behavior is now a separate explicit endpoint:

`POST /api/platform/schools/[id]/reactivate`

It uses the same exact platform permission and reason requirement, but transitions only `deactivated → active`. Calling the pending activation endpoint for a deactivated school returns a conflict with a `REACTIVATION_REQUIRED` code. This preserves the distinction between initial activation and reactivation/restriction review.

The current `School` lifecycle model has no separate legal-hold field or policy engine. The existing `deactivated` state remains the gate for the separate reactivation action; future legal or suspension controls must be added to that policy boundary rather than bypassed through pending activation.

## Atomicity, audit, idempotency, and concurrency

`src/lib/platform/schools/transition-to-active.ts` is the shared transition service. It uses a MongoDB transaction and a status-conditional update so a transition and its audit record commit together or neither commits.

Each successful transition writes a Tier 0 audit event with:

- action code `school.lifecycle.activated` or `school.lifecycle.reactivated`;
- school scope and target school;
- actor identity and timestamp through the existing audit context/model;
- administrative reason;
- `before` and `after` status values;
- changed field `status`;
- setup percentage, completed/total counts, and remaining setup item keys/labels; and
- idempotency and hash-chain metadata through the existing transactional audit writer.

An already-active school returns an idempotent no-op and does not create a duplicate lifecycle audit event. A concurrent conditional-update conflict is re-read after the transaction; if another request has already made the school active, it is treated as the same idempotent no-op. Audit failure aborts the transaction and leaves the school pending/deactivated.

The current invariant is: `active` is the only current active lifecycle state; exactly one successful transition from the eligible predecessor is allowed, and historical audit events record each committed transition.

## Security and entitlement boundary

The route-level permission is `platform.schools.activate`, which already exists in the platform permission registry. The implementation does not broaden that registry or grant the permission to school administrators. A missing permission fails closed before any school read/write.

Activation does not grant Premium Assess. Existing Assess entitlement resolution still requires an active school plus the existing membership/role and subscription conditions. The current Premium policy remains Enterprise-only and feature-gated; Starter, Growth, Pilot, missing-subscription, and disabled-enforcement cases are not granted by this change. The Enterprise mapping remains a provisional product-packaging decision, not a new commercial approval.

Core examinations and ordinary academic behavior are untouched.

## Subscription projection correction

`getPlatformSchoolDetail` now reads `SchoolSubscription` by `schoolId` and exposes the authoritative tier name, lifecycle status, effective price, and the existing neutral discount-exposure field. The detail view therefore no longer contradicts the Growth/subscription page. The school-list projection remains unchanged because this pass did not broaden the platform billing list contract.

## Platform Admin user flow

1. Sign in as a Platform Administrator with `platform.schools.activate`.
2. Open `/platform/schools` and select the pending school.
3. Confirm the school name, current status, setup percentage, and remaining setup items.
4. Select **Activate school**.
5. Enter an administrative reason of at least eight characters.
6. Confirm the action.
7. Verify the status is `active`, setup items remain outstanding where applicable, and no payment/subscription/role state was changed.
8. For a `deactivated` school, use **Reactivate school** and provide a separate reason after reviewing the restriction.
9. Assign or change a subscription separately through the existing subscription workflow. Activation does not do this automatically.

## Changed files

- `src/lib/platform/schools/transition-to-active.ts` — transactional activation/reactivation service, idempotency, conflict handling, setup snapshot, and audit integration.
- `src/app/api/platform/schools/[id]/activate/route.ts` — pending-only, permissioned, reasoned activation route.
- `src/app/api/platform/schools/[id]/reactivate/route.ts` — separate reasoned reactivation route.
- `src/app/(app)/platform/schools/[id]/page.tsx` — pending activation action, setup/restriction explanation, reason confirmation, and route selection.
- `src/lib/audit/policy.ts` — audit policies for activation and reactivation actions.
- `src/lib/platform-billing/platform-schools.ts` — authoritative school-detail subscription projection.
- `tests/platform-school-activation-permission.cjs` — isolated permission-gate test stub.
- `tests/platform-school-activation.test.ts` — disposable integration and projection coverage.
- `docs/assess/implementation/SCHOOL_ACTIVATION_ONBOARDING_DECOUPLING_REPORT.md` — this report.

## Verification evidence

All database-backed tests used disposable local MongoDB/MongoMemoryReplSet instances. No persistent school, demo, provider, or production database was accessed.

| Command | Result |
| --- | --- |
| `npx eslint src/lib/audit/policy.ts src/lib/platform/schools/transition-to-active.ts 'src/app/api/platform/schools/[id]/activate/route.ts' 'src/app/api/platform/schools/[id]/reactivate/route.ts' src/lib/platform-billing/platform-schools.ts 'src/app/(app)/platform/schools/[id]/page.tsx' tests/platform-school-activation.test.ts` | Exit 0; clean |
| `node --test --import tsx tests/platform-school-activation.test.ts` | Exit 0; 13 passed, 0 failed |
| `npm run test:subscriptions` | Exit 0; 155 passed across 29 suites |
| `node --test --import tsx tests/invitations/issue-and-school-create.test.ts tests/background-engine/school-provisioning.test.ts` | Exit 0; 11 passed across 3 suites |
| `node --test --import tsx tests/assessment-*.test.ts` | Exit 0; 193 passed across 45 suites |
| `npx tsc --noEmit --pretty false --incremental false` | Exit 2; repository baseline diagnostics remain |
| `git diff --check` | Exit 0; no whitespace errors |

The full TypeScript run reported 716 diagnostic lines. The only diagnostics matching this slice were the pre-existing `shouldKeepBusy` errors at lines 410 and 415 of `src/app/(app)/platform/schools/[id]/page.tsx`, in the unrelated permanent-delete/assisted-access code path. No TypeScript diagnostics remained for the new transition service, API routes, audit policy, subscription projection, or activation test after the test-harness type correction.

The first Assess regression attempt was blocked by the sandbox refusing MongoMemoryReplSet loopback binding (`listen EPERM` on `0.0.0.0`). The same command was then run with the approved disposable in-memory MongoDB exception and passed 193/193 tests. This was not a persistent-database access.

## Remaining limitations and release blockers

- No signed-in browser verification was performed; the manual Platform Admin flow above remains required before release.
- No deployed-runtime, production configuration, real subscription-provider, or real school-data verification was performed.
- MongoDB transaction support and the relevant production indexes must be confirmed in the deployment environment before rollout. No production index migration was executed.
- The pre-existing repository-wide TypeScript errors remain a release-quality limitation and are not resolved by this bounded pass.
- Existing suspension/legal-control semantics are represented only by the current `deactivated` lifecycle state; a future explicit legal-hold or suspension-policy model should be integrated into the reactivation guard.

Accordingly, this pass is ready for independent review and local continuation, but it is not a production or pilot approval by itself.
