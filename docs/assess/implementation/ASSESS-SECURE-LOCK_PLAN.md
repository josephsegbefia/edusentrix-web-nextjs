# ASSESS-SECURE-LOCK — Confidential Assessment Lock Plan

**Status:** Planned only; not implemented by ASSESS-UX04

**Scope:** Server-enforced confidential examination lock for a future bounded security slice

## Purpose

Protect confidential assessment content during a defined pre-release window. This plan is separate from the Premium UI overhaul because a client-side countdown, hidden control or CSS state would not provide an enforceable security boundary.

## Required contract

1. A school administrator creates or activates a lock against an immutable assessment definition or delivery version, never against mutable Core authoring records.
2. The server records `lockedAt`, `lockExpiresAt`, the actor, school, definition/delivery version, reason and an append-only audit reference.
3. Every confidential read, preview, export, packet generation and delivery mutation evaluates the lock using server time and the school-scoped immutable version.
4. Expiry is fail-closed for confidential content: the operation is denied until an authorized release or extension transition is recorded. A browser timer is informational only.
5. A lock must not expose answer keys, marking guides, private resources or candidate identity through error responses, metadata, URLs or client state.
6. Concurrent activation, extension, release and publication requests use idempotency keys and a write fence so only one legal current lock state exists.

## Implementation sequence

1. Confirm the product owner’s lock duration, timezone-independent server-time policy, permitted roles, release authority, extension policy and audit retention.
2. Define the state machine and persistence/index design, including school scope, immutable version reference, current-state uniqueness and rollback/recovery behavior.
3. Add a service-level authorization guard and apply it to every confidential read/export/mutation path. Keep ordinary Core examination access separate.
4. Add route and service tests for school isolation, unauthorized roles, expiry, replay, concurrent transitions, ambiguous outcomes, private projection safety and audit completeness.
5. Add operational observability without logging confidential content, answer keys, raw QR payloads or provider credentials.
6. Perform signed-in browser and deployed-runtime verification using synthetic school data before any pilot approval.

## Acceptance criteria

- No unauthorized actor can read or export locked confidential content.
- Client clock changes cannot extend or bypass the lock.
- All confidential routes agree on one server-authoritative current state.
- Historical immutable versions retain their original lock/audit provenance.
- Replay and ambiguous network outcomes do not create contradictory lock states.
- Expired, released and extended states are visible to authorized administrators without revealing protected content.
- Ordinary Core examinations, marks, grading and report cards remain unaffected.

## Explicit non-implementation boundary

ASSESS-UX04 does not add a lock timer, lock persistence, release endpoint, encryption key workflow or security enforcement. The current UI may communicate that publication freezes a version, but it does not claim to provide the confidential time-lock described here.
