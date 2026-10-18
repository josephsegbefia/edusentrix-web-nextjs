# ASSESS-P02A Paper Packet Generation Report

Date: 2026-10-15

Status: bounded implementation complete; local disposable-database verification passed for the packet slice. Production release approval is not implied.

## PD-004 approval record

R02A-PD-004 — Initial Paper Identity — was explicitly approved by the EduSentrix product owner on 2026-10-15 through ChatGPT and relayed in the ASSESS-P02A implementation instruction. The decision register was updated at:

`docs/assess/rea/reports/REA_R02A_PRODUCT_DECISION_REGISTER.md`

The approval covers opaque server-recorded packet/page identity, QR routing markers, human-readable fallback codes, audited issuance/reprint, and retry-controlled issuance. It does not approve candidate identity reconciliation, script capture, device evidence retention, scanning, PD-005, or PD-008. The register records product approval only, not independent security approval.

## Domain and identity model

`AssessmentPaperPacket` is an additive Mongoose model. Each packet stores:

- school scope;
- immutable assessment-definition and assessment-delivery version references;
- the delivery content hash;
- a cryptographically random opaque packet identifier;
- a human-readable fallback code;
- opaque batch identity, sequence, quantity, and an idempotency fingerprint;
- issued/voided lifecycle state and creation/issuance/void attribution;
- an immutable page manifest.

Packet generation is issuance for this slice: newly generated packets enter `issued`. The only later lifecycle transition is `issued -> voided`. Voided packets cannot be downloaded or reprinted. There is no candidate, student, answer, score, script, or evidence-capture association.

The idempotency contract is school-scoped. Only the batch leader carries the unique `(schoolId, generationIdempotencyKey)` index key; all packets retain the key for replay reconciliation. A request replay returns the original packet identities. A different request fingerprint under the same key is rejected.

Declared packet indexes are:

- unique school-scoped packet identity;
- unique school-scoped human-readable fallback code;
- unique school/batch/sequence allocation;
- unique school-scoped generation idempotency key on the batch leader;
- delivery history and status lookup indexes.

No production index creation or migration was executed.

## Page identity contract

Every generated PDF page has a random opaque page ID, page number, expected total page count, human-readable page fallback code, and a versioned QR payload. Page IDs are independent of database `_id` values and are not sequential secrets. The page manifest is stored with the packet and is immutable.

Generation calculates the page count from the immutable snapshot, persists the manifest, then performs final PDF rendering. Final rendering fails if the actual page count differs from the stored manifest. The test suite verifies that PDF page count and manifest count agree and that page IDs are unique across packets.

The footer explicitly says that the QR is a routing marker and that server records determine authenticity. No candidate identity is encoded or inferred.

## QR payload contract

Issued page payloads are versioned JSON containing only:

```json
{"v":1,"t":"paper-page","id":"opaque-page-id"}
```

The payload contains no school name or ID, student identity, question answer, marking guide, mark, score, or evidence. P02A does not expose a public QR-resolution or scanning endpoint. Any future resolution must authenticate and authorize server-side school/packet/page lookup separately; the human-readable fallback is an identification aid, not an authentication secret.

Previews use a separate `paper-preview` marker and `PREVIEW-NOT-ISSUED` label. Preview markers do not create packet records and cannot be mistaken for issued packet identity.

## PDF generation implementation

`src/lib/assess/paper-packet-pdf.ts` uses the repository's existing `pdf-lib` and `qrcode` dependencies. It renders an A4 candidate-safe examination paper from `AssessmentDefinitionVersion` and `AssessmentDeliveryVersion` snapshots only. It includes:

- school name;
- examination title, subject, grade, class context, duration, and maximum marks;
- candidate instructions;
- ordered sections and questions;
- multiple-choice options without correctness flags;
- structured subquestions and writing lines for non-option questions;
- page number/total, packet marker, QR, and fallback page code.

Expected answers, correct-option flags, marking guides, explanations, and private resource manifests are never rendered. Attachment-bearing definitions remain fail-closed because the existing P01A resource manifest is structurally private but not byte-integrity verified. P02A does not contact storage providers or add digest computation.

PDFs are regenerated deterministically from immutable database snapshots; binary PDF files are not persisted. The packet PDF route uses private no-store responses. The admin preview route is candidate-safe, school-scoped, Premium-gated, and creates no packet.

## Admin workflow

`/admin/assessments` now provides:

- published-delivery preview;
- bounded batch quantity from 1 to 100;
- optional batch label;
- packet generation with a client idempotency key;
- packet and batch history with issuance/void status;
- PDF download;
- reprint preserving the original packet identity;
- inline void workflow requiring an operator reason.

The interface states that packets are blank and unassigned, QR markers do not identify students, and scanning/candidate reconciliation are not available. No fake candidate statistics or capture controls were added.

## API contracts

Added routes:

- `GET/POST /api/admin/assess/packets`
- `GET /api/admin/assess/packets/[packetId]`
- `GET /api/admin/assess/packets/[packetId]/pdf?mode=download|reprint`
- `POST /api/admin/assess/packets/[packetId]/void`
- `GET /api/admin/assess/deliveries/[deliveryId]/preview`

Mutating generation and void operations require `x-idempotency-key`. All routes require active authenticated school-admin context and the existing dedicated `assessment.premium_publication` entitlement. All packet queries include the active school scope. The routes never return answer keys, marking guides, definition sections, question content, or raw QR payloads in administrator projections.

## Security safeguards

- Packet generation requires a published or active paper delivery and a published immutable definition whose content hash matches the delivery.
- Cross-school delivery, packet, source-definition, and related academic records are rejected or return empty school-scoped results.
- Missing identity, non-admin role, inactive/missing school, and missing Premium entitlement fail closed.
- Draft/unpublished delivery generation is rejected.
- Attachment-bearing publication is rejected under the existing unverified-resource policy.
- QR content is opaque routing data only.
- Void and reprint/download actions are recorded through the existing transactional audit event system with registered Tier 0 action policies and school stream keys.
- PDF responses are private and no-store; there is no public candidate or scan endpoint.
- Core examinations, canonical scores, grading, report cards, subscription packaging, and academic score writes are untouched.

## Test evidence

All new packet tests used disposable `MongoMemoryReplSet` databases and synthetic examination data.

- `node --test --import tsx tests/assessment-paper-packet-foundation.test.ts` — exit 0; 6 passed, 0 failed.
- `node --test --import tsx tests/assessment-paper-packet-route.test.ts` — exit 0; 3 passed, 0 failed. Includes unauthorized/role/Premium/tenant checks, generated PDF response, and non-persisting preview.
- Combined packet foundation and route run — exit 0; 9 passed, 0 failed.
- `node --test --import tsx tests/audit.policy.test.ts` — exit 0; 3 passed, 0 failed.
- P01A/P01B publication and delivery aggregate — exit 0; 39 passed, 0 failed.
- `npm run test:subscriptions` — exit 0; 155 passed, 0 failed.
- Core academic regression command — first parallel run had one nondeterministic pre-existing concurrency assertion in `assessment-engine.score-writer-closure.integration.test.ts`; the exact test rerun passed 13/13, and the full Core command rerun passed 26/26. No P02A file is involved in that assertion.
- Targeted ESLint over the P02A model, service, PDF renderer, routes, audit policy, workspace, and tests — exit 0.

## TypeScript and build verification

`npx --no-install tsc --noEmit --pretty false` completed with exit 2 because the repository contains broad existing/generated Next.js diagnostics, including `.next` route validator errors for platform proposal pages. The final diagnostic scan contained no P02A-specific references to the packet model, service, routes, workspace, or preview route. This is not reported as a repository-wide typecheck pass.

After database isolation was confirmed, the sanitized build command was attempted:

```text
NEXT_TELEMETRY_DISABLED=1 APP_RUNTIME_MODE=development APP_URL=http://localhost:3000 NEXT_PUBLIC_APP_URL=http://localhost:3000 MONGODB_URI=mongodb://127.0.0.1:1/isolated-p02a-build MONGO_DB_NAME=isolated-p02a-build npm run build -- --debug
```

The build reached `Creating an optimized production build ...`, emitted no MongoDB connection evidence, and stalled at the known Next.js compile phase. It was boundedly interrupted and exited 130. The result is incomplete, not a build pass. Existing build-time database refusal and dynamic-page protections were retained.

## Changed files

P02A added:

- `src/models/AssessmentPaperPacket.ts`
- `src/lib/assess/assessment-paper-packet-service.ts`
- `src/lib/assess/paper-packet-pdf.ts`
- `src/app/api/admin/assess/packets/route.ts`
- `src/app/api/admin/assess/packets/[packetId]/route.ts`
- `src/app/api/admin/assess/packets/[packetId]/pdf/route.ts`
- `src/app/api/admin/assess/packets/[packetId]/void/route.ts`
- `src/app/api/admin/assess/deliveries/[deliveryId]/preview/route.ts`
- `tests/assessment-paper-packet-foundation.test.ts`
- `tests/assessment-paper-packet-route.test.ts`
- this report

P02A modified:

- `docs/assess/rea/reports/REA_R02A_PRODUCT_DECISION_REGISTER.md`
- `src/lib/audit/policy.ts`
- `src/components/admin/assess/AssessmentDeliveryWorkspace.tsx`

Unrelated dirty worktree changes were preserved. No package, lockfile, existing Core model, production configuration, provider, or migration file was changed.

## Production and index release gates

Before production use, an approved operational change must:

1. preflight duplicate packet identifiers, fallback codes, batch leaders, and idempotency data;
2. review and roll out the declared packet indexes through the supported MongoDB migration process;
3. verify replica-set transaction support and majority write behavior;
4. define observation, retry, and rollback procedures without deleting immutable packet history;
5. verify private PDF responses, audit stream integrity, and rate/volume controls in the deployed environment;
6. complete independent security review and signed-in browser verification.

No production or persistent development database was accessed and no index migration was executed.

## Known limitations

- Attachments remain unsupported until verified private `StoredAsset` ownership, access, stable version/digest, and historical retrieval are separately approved and implemented.
- P02A does not resolve QR scans, identify candidates, assign packets, capture scripts, retain device evidence, or reconcile paper identity.
- PDF rendering supports the immutable snapshot's text/options/subquestions and does not implement rich-media attachment rendering.
- The repository-wide typecheck and full build remain blocked by baseline/generated diagnostics and the compile stall.
- Final Premium plan packaging remains provisional Enterprise-only under the existing P01A policy.

## P02B readiness

P02A is ready for independent review of the bounded local packet implementation, not for production release and not for automatic progression. P02B should require the production index/transaction gate, closure or accepted triage of build/typecheck limitations, and a separately approved candidate-assignment and paper-capture contract. PD-005 and PD-008 remain unapproved. No CBT, OMR, scanning, digital marking, canonical score handoff, report-card change, or real-student evidence workflow was started.
