# ASSESS-P02C1 — Secure Examination Evidence Backend Report

**Date:** 2026-10-15 (Africa/Accra)  
**Repository:** `edusentrix-web-nextjs`  
**Branch:** `feat/assess-rea-foundation`  
**Status:** Bounded implementation complete; independent security and production review required

## Outcome

Implemented the bounded backend foundation for receiving paper examination evidence from an authenticated EduSentrix Konect operator. The slice is school-scoped, Premium-gated, private by default, server-digest verified, receipt-producing, and reconciliation-first.

No candidate answers, marks, scores, report-card writes, digital marking, OMR recognition, or automatic candidate reassignment were implemented.

## Product authorization

Updated `docs/assess/rea/reports/REA_R02A_PRODUCT_DECISION_REGISTER.md` to record only **R02A-PD-008 — Evidence retention and device security** as approved by the EduSentrix product owner on **2026-10-15**, with the source recorded as explicit authorization communicated through ChatGPT and relayed in the ASSESS-P02C1 instruction.

PD-006, PD-007, PD-009, and the remaining unrelated decisions remain unapproved. The register explicitly distinguishes product authorization from independent security verification.

## Implemented contract

### Capture sessions

`AssessmentEvidenceCaptureSession` provides:

- school and immutable delivery binding;
- authenticated operator binding;
- device-session identifier and idempotency key;
- `active`, `revoked`, `expired`, and `closed` lifecycle states;
- expiry and revocation timestamps, actor, and reason;
- a 500-page session volume ceiling.

The session must belong to the current authenticated school administrator. Revoked, expired, cross-school, and cross-operator sessions fail closed.

### Page reservations and verification

`AssessmentEvidencePage` records:

- delivery, capture session, observed packet and page identifiers;
- resolved packet/page references only when the school and delivery match;
- expected page number/count, capture order, and current assignment snapshot;
- private `StoredAsset` reference;
- optional client digest as a comparison hint only;
- server-computed SHA-256 digest, integrity state, lifecycle, and reconciliation outcome;
- retention-policy reference, retention date, legal hold, deletion status, and history fields.

Reservations use the new `assessmentEvidencePage` storage association and the existing private `assess_script_page` storage kind. They do not reuse the weaker legacy `ScriptSubmission` completion contract.

The evidence service streams the stored object through the injected storage port, checks existence, MIME type, byte count, maximum size, and computes SHA-256 over the bytes. Client digests, URLs, ETags, and provider metadata are never treated as byte-integrity proof. A mismatch, missing object, invalid MIME, or invalid size produces no confirmed receipt.

### Reconciliation invariant

For one school, delivery, packet, and page, at most one evidence page can have `accepted: true`. The partial unique index prevents two concurrent uploads from becoming the current verified image.

The accepted current image must have:

- a valid packet/page manifest match;
- an issued packet;
- an active packet assignment;
- no pending assignment correction;
- successful server-side byte verification.

Other server-verified evidence remains private with a durable receipt and an explicit `duplicate`, `conflict`, `unknown_packet`, `wrong_delivery`, `unknown_page`, `voided_packet`, `out_of_order`, `unassigned_packet`, or `assignment_correction_pending` outcome. QR and fallback identifiers are routing hints only.

The reconciliation query reports expected pages, received pages, accepted pages, missing pages, and warnings. Missing expected pages are derived from the immutable packet manifest; no automatic identity reassignment occurs.

### Receipts and recovery

`AssessmentEvidenceReceipt` is created in the same transaction as the verified evidence state. Completion retries return the existing receipt after an ambiguous response, preventing duplicate receipt issuance. Concurrent same-page uploads are resolved by the accepted-page uniqueness boundary and classified rather than overwritten.

### Retention and legal hold

`AssessmentEvidenceDeletionRequest` records an authorized school-admin request, reason, idempotency key, and decision. Active legal holds deny deletion requests and create an auditable failed decision. This slice does not automatically delete provider objects or cascade-delete evidence. Production purge requires a separately reviewed retention worker and migration/rollback plan.

## Authorization and confidentiality

- All implemented routes require an authenticated active school administrator.
- All implemented routes call the dedicated `assessment.premium_publication` entitlement guard.
- Existing Core examinations and the legacy scanner contract remain available and were not broadened or removed.
- Evidence assets are private and tenant-scoped in both database lookup and storage-key layout.
- The admin preview route checks school, entitlement, evidence association, and asset readiness before returning a short-lived private redirect.
- Answer keys, marking guides, candidate answers, and score fields are not present in the evidence responses.
- No route accepts a candidate identity as proof from a QR or fallback marker.

The current entitlement packaging remains the existing provisional Enterprise-only mapping. This implementation does not treat that mapping as final commercial approval.

## Routes

Konect capture contract:

- `POST /api/konect/v1/admin/assess/evidence/sessions`
- `POST /api/konect/v1/admin/assess/evidence/sessions/:sessionId/pages`
- `POST /api/konect/v1/admin/assess/evidence/pages/:pageId/complete`
- `POST /api/konect/v1/admin/assess/evidence/sessions/:sessionId/revoke`

Admin reconciliation and retention contract:

- `GET /api/admin/assess/evidence`
- `GET /api/admin/assess/evidence/:evidencePageId/preview`
- `POST /api/admin/assess/evidence/:evidencePageId/legal-hold`
- `POST /api/admin/assess/evidence/:evidencePageId/deletion-request`

## Changed files

P02C1-specific changes:

- `docs/assess/rea/reports/REA_R02A_PRODUCT_DECISION_REGISTER.md`
- `src/lib/assess/assessment-evidence-service.ts`
- `src/models/AssessmentEvidenceCaptureSession.ts`
- `src/models/AssessmentEvidencePage.ts`
- `src/models/AssessmentEvidenceReceipt.ts`
- `src/models/AssessmentEvidenceDeletionRequest.ts`
- `src/lib/storage/types.ts`
- `src/lib/storage/key-builder.ts`
- `src/lib/storage/access-policy.ts`
- `src/lib/audit/policy.ts`
- `src/app/api/konect/v1/admin/assess/evidence/sessions/route.ts`
- `src/app/api/konect/v1/admin/assess/evidence/sessions/[sessionId]/pages/route.ts`
- `src/app/api/konect/v1/admin/assess/evidence/pages/[pageId]/complete/route.ts`
- `src/app/api/konect/v1/admin/assess/evidence/sessions/[sessionId]/revoke/route.ts`
- `src/app/api/admin/assess/evidence/route.ts`
- `src/app/api/admin/assess/evidence/[evidencePageId]/preview/route.ts`
- `src/app/api/admin/assess/evidence/[evidencePageId]/legal-hold/route.ts`
- `src/app/api/admin/assess/evidence/[evidencePageId]/deletion-request/route.ts`
- `src/components/admin/assess/AssessmentEvidenceReconciliationPanel.tsx`
- `src/components/admin/assess/AssessmentDeliveryWorkspace.tsx`
- `tests/assessment-evidence.test.ts`

No dependency, configuration, deployment, production database, provider, commit, or push was performed.

## Verification evidence

All database-backed tests used a disposable `MongoMemoryReplSet`. Storage tests used the existing injectable fake R2 port. No live R2 or persistent school database was contacted.

Focused evidence suite:

```text
node --test --import tsx tests/assessment-evidence.test.ts
5 passed, 0 failed
```

Combined Assess publication/delivery/packet/assignment/evidence suite:

```text
node --test --import tsx \
  tests/assessment-evidence.test.ts \
  tests/assessment-delivery-foundation.test.ts \
  tests/assessment-delivery-route.test.ts \
  tests/assessment-paper-packet-foundation.test.ts \
  tests/assessment-paper-packet-route.test.ts \
  tests/assessment-paper-assignment.test.ts \
  tests/assessment-paper-assignment-route.test.ts \
  tests/assessment-publication-foundation.test.ts \
  tests/assessment-publication-route.test.ts \
  tests/assessment-publication-atomicity.test.ts \
  tests/assessment-publication-transaction-unavailable.test.ts
61 passed, 0 failed
```

Subscription and Core academic regression selection:

```text
node --test --import tsx \
  tests/subscription.access-mode-extended.test.ts \
  tests/subscription.access-mode.test.ts \
  tests/subscription.feature-keys.test.ts \
  tests/subscription.limit-keys.test.ts \
  tests/subscription.plan-map.test.ts \
  tests/subscription.pricing.test.ts \
  tests/subscription.role-entitlements.test.ts \
  tests/assessment-engine.score-atomicity.integration.test.ts \
  tests/assessment-engine.score-writer-closure.integration.test.ts \
  tests/assessment-engine.studio-to-gradebook.test.ts \
  tests/assessment-engine.teacher-gradebook-service.test.ts \
  tests/exam-engine.hardening.test.ts
185 passed, 0 failed
```

Targeted ESLint:

```text
npx eslint src/lib/assess/assessment-evidence-service.ts src/models/AssessmentEvidenceCaptureSession.ts src/models/AssessmentEvidencePage.ts src/models/AssessmentEvidenceReceipt.ts src/models/AssessmentEvidenceDeletionRequest.ts src/lib/storage/types.ts src/lib/storage/key-builder.ts src/lib/storage/access-policy.ts src/lib/audit/policy.ts src/components/admin/assess/AssessmentEvidenceReconciliationPanel.tsx src/components/admin/assess/AssessmentDeliveryWorkspace.tsx tests/assessment-evidence.test.ts 'src/app/api/konect/v1/admin/assess/evidence/sessions/route.ts' 'src/app/api/konect/v1/admin/assess/evidence/sessions/[sessionId]/pages/route.ts' 'src/app/api/konect/v1/admin/assess/evidence/pages/[pageId]/complete/route.ts' 'src/app/api/konect/v1/admin/assess/evidence/sessions/[sessionId]/revoke/route.ts' 'src/app/api/admin/assess/evidence/route.ts' 'src/app/api/admin/assess/evidence/[evidencePageId]/preview/route.ts' 'src/app/api/admin/assess/evidence/[evidencePageId]/legal-hold/route.ts' 'src/app/api/admin/assess/evidence/[evidencePageId]/deletion-request/route.ts'
exit 0
```

Whitespace verification:

```text
git diff --check
exit 0
```

Sanitized build attempt:

```text
NEXT_TELEMETRY_DISABLED=1 \
APP_RUNTIME_MODE=development \
APP_URL=http://localhost:3000 \
NEXT_PUBLIC_APP_URL=http://localhost:3000 \
MONGODB_URI=mongodb://127.0.0.1:1/isolated-p02c1-build \
MONGO_DB_NAME=isolated-p02c1-build \
npm run build -- --debug
```

The build loaded `.env.local`, reached `Creating an optimized production build ...`, produced no persistent MongoDB connection evidence, and was stopped after 30 seconds with exit **130**. This is not reported as a build pass. The unresolved stall affects full production-build verification, not the passing focused test suites. The full repository TypeScript gate also retains pre-existing/generated diagnostics outside this slice; no P02C1-specific diagnostics were found in the targeted scan.

## Index and rollout safety

The new Mongoose models define indexes for session idempotency, page reservation idempotency, school/delivery/page reconciliation, accepted-current uniqueness, receipts, deletion requests, and retention lookup. Indexes were created only inside disposable test databases during verification. No production index migration or implicit production rollout was executed.

Before production use, the operations owner must run a reviewed additive index migration against a backup/rollback plan, verify duplicate data before creating unique indexes, monitor build impact, and retain a reversal plan. Existing `StoredAsset` indexes were not changed destructively.

## Remaining release blockers and limitations

1. The full Next.js build remains unresolved because the repository build stalls during optimized compilation. No production release claim is made.
2. The storage provider contract does not expose a provider-side digest. P02C1 safely compensates by reading the private object through the server-side testable stream interface, but live R2 byte-stream verification still requires a controlled provider integration test.
3. The capture session is account-bound through the authenticated school-admin request and a database session record. A signed offline device token, encrypted mobile queue, account-bound local cleanup, and remote lost-device handling remain P02C2/device work. Remote erase of offline copies is not claimed.
4. The implementation has a per-session volume ceiling but no distributed rate limiter or provider quota monitor. Production rate/volume controls require operations design.
5. Deletion requests are recorded and legal holds deny unsafe deletion; automatic retention execution and provider purge are intentionally not implemented.
6. The existing legacy `ScriptSubmission` scanner route still uses its older head-metadata completion behavior. It was not silently converted into the new evidence contract. Konect migration to P02C1 must be an explicit follow-up.
7. No independent penetration test, signed-in device test, live provider test, or deployed-runtime verification was performed.

## Readiness assessment

The bounded backend is suitable for independent review and synthetic integration continuation. It is not production-approved. The next authorized slice must resolve the build verification blocker and separately review live storage digest behavior, offline-device security, distributed limits, and production index rollout before enabling real school evidence capture.

No automatic movement into P02C2 or digital marking was made.
