# EduSentrix Assess — ASSESS-P02C2 Konect Scanner Report

**Date:** 2026-10-15 (Africa/Accra)  
**Status:** Synthetic local scanner integration implemented; production/device approval remains blocked  
**Repositories:** `edusentrix-konect` client and `edusentrix-web-nextjs` backend  
**Branch:** `feat/assess-rea-foundation`

## Scope and authorization

R02A-PD-008 was recorded as product-owner approved on 2026-10-15. This slice implements only school-administrator Premium paper-page capture against the P02C1 evidence boundary. It does not authorize teacher capture, real student evidence, remote erase, marking, OMR, score writes, report-card changes or entitlement-expiry exceptions.

No production database, provider, R2 bucket, deployment, commit or push was used.

## Contract checkpoint

The pre-existing Konect scanner used the older `/api/konect/v1/admin/assess/scanner/*` student-selection and `ScriptSubmission` flow. P02C1 instead requires:

- `POST /api/konect/v1/admin/assess/evidence/sessions` with `assessmentDeliveryVersionId`, `deviceSessionId` and `x-idempotency-key`;
- `POST /api/konect/v1/admin/assess/evidence/sessions/:sessionId/pages` with `packetId`, `pageId`, `fileName`, `mimeType`, `clientUploadId` and `captureOrder`;
- the returned private presigned PUT;
- `POST /api/konect/v1/admin/assess/evidence/pages/:pageId/complete`; and
- server-produced page and receipt status.

These shapes were verified directly in the P02C1 route schemas and `assessment-evidence-service.ts`. The client now uses those routes. Existing school-admin Premium routes provide the eligible paper deliveries and issued packet/page manifests:

- `GET /api/admin/assess/deliveries`;
- `GET /api/admin/assess/packets?assessmentDeliveryVersionId=...`.

Both server boundaries derive school and role from the authenticated Clerk request and retain the dedicated `assessment.premium_publication` check. The client never sends a school id as authority and never selects a student.

## Implemented client workflow

Konect now provides:

1. Eligible published/active paper-delivery selection.
2. Issued packet/page-manifest loading.
3. Account-bound P02C1 session creation with stable in-session idempotency.
4. Camera permission handling using the installed `expo-camera` SDK 57 module.
5. QR detection restricted to the exact payload `{"v":1,"t":"paper-page","id":"opaque-page-id"}`.
6. Human-readable fallback-code resolution against the server-returned issued manifest.
7. Page capture, resolution warning, review and retake.
8. P02C1 reservation, private presigned upload and server completion.
9. Distinct `verified`, `pending_reconciliation`, `failed` and upload-in-progress language.
10. Temporary-file deletion only after a confirmed verified receipt; reconciliation pages are retained in the active workspace.

The server remains authoritative for packet existence, delivery scope, assignment/candidate association, byte digest and receipt. A QR marker is only a routing hint. Unknown markers and invalid fallback codes are rejected locally without identity inference.

## Encrypted queue boundary

The current Expo configuration includes `expo-secure-store` and ordinary `expo-file-system`, but no reviewed encrypted-file/blob persistence mechanism. SecureStore metadata does not encrypt image bytes, and ordinary filesystem or AsyncStorage persistence would violate the P02C2 boundary.

Accordingly, the client fails closed for persistent offline evidence. Captures can remain in memory while this scanner screen is open and can be synchronized online, but the current build does not claim restart-safe offline retention, logout retention, background upload, or lost-device recovery. `secure-queue.ts` explicitly rejects persistent evidence-queue use and tests the account/school scope guard. A future native implementation requires a reviewed iOS/Android encrypted-file module, OS-secured key handling, backup exclusion, bounded quota, restart/termination recovery and device-revocation behavior before offline capture is enabled.

This is an intentional security limitation, not a plaintext fallback.

## Server integrity correction

P02C1 verified bytes at the reservation key, but that key could remain writable while a presigned PUT was valid. P02C2 now copies the verified bytes to a server-owned digest-addressed key before marking the asset ready and issuing a receipt. The `StoredAsset.storageKey` is updated to that key; the old reservation object is deleted best effort. Receipt replay and preview therefore use the verified key, not a still-reusable client upload key.

The correction is additive within the existing `StoredAsset` model and does not add an index or perform a migration. A provider-level immutable/object-lock guarantee is not claimed; the client-issued reservation URL cannot replace the receipt-addressed object through the implemented flow. Live R2 verification remains pending.

## Security and lifecycle boundaries

- Only `school_admin` access through the existing `AdminOnly` client gate and server `requireSchoolAdmin` boundary is exposed.
- Premium publication/evidence capability remains fail-closed and Enterprise-only mapping remains provisional; no plan mapping was changed.
- Session, reservation and completion requests use P02C1 server idempotency records; the client performs only the existing one-refresh authorization retry in `adminRequest`.
- Revoked or expired sessions are surfaced as blocked synchronization, not retried indefinitely.
- No raw evidence, signed URL or access token is logged by the scanner code.
- No automatic candidate identity guess or reconciliation replacement is performed.
- No teacher route, teacher UI, marking route, OMR path or canonical score handoff was added.

## Verification evidence

| Check | Result |
|---|---|
| Konect `npm run typecheck` | Passed, exit 0 |
| Konect `npm run lint` | Passed, exit 0 |
| Konect `npm run test:scanner` | 4 passed, 0 failed |
| Konect extra secure-queue tests | 2 passed, 0 failed |
| Konect `npm run export` | Passed, exit 0; Android/iOS/web bundles and 49 static routes; existing Clerk deprecation warning; Expo force-exit warning after export |
| Web `npx tsx --test tests/assessment-evidence.test.ts` | 5 passed, 0 failed; disposable MongoDB replica set and mock R2 only |
| Web targeted ESLint | Passed, exit 0 |
| Web focused assessment/subscription/Core-adjacent tests | 34 passed, 0 failed |
| Web changed-file TypeScript filter | No diagnostics for `assessment-evidence-service.ts` or `assessment-evidence.test.ts`; repository-wide `npx tsc --noEmit` still exits 2 on unrelated baseline diagnostics |
| Konect session regression | 130 passed, 0 failed |
| Web `npm run test:exams` | Not available: Web package has no `test:exams` script; direct focused assessment/subscription tests were run instead |
| Web sanitized build | Did not complete after 180 seconds in optimized production compilation; stopped with exit 130. No MongoDB connection log appeared. |
| `git diff --check` | Passed in both repositories |
| Physical/simulator camera capture | Not observed |

The first sandboxed Konect `tsx` and Expo attempts were blocked by local IPC/cache permissions; the commands were rerun with narrowly scoped local elevation. No external service was contacted.

## Changed files

### Konect

- `src/features/admin/scanner/contracts.ts` — P02C1 delivery, packet, marker and evidence parsers.
- `src/features/admin/scanner/api.ts` — delivery/packet reads, capture-session, reservation, upload, completion and revocation client calls.
- `src/features/admin/scanner/use-scanner.ts` — delivery and packet queries scoped by account/school/delivery.
- `src/features/admin/scanner/scanner-screen.tsx` — school-admin capture/review/sync/receipt workflow.
- `src/features/admin/scanner/secure-queue.ts` — explicit encrypted-offline fail-closed boundary.
- `src/features/admin/scanner/contracts.test.ts` — contract, QR, fallback and receipt tests.
- `src/features/admin/scanner/secure-queue.test.ts` — persistence and account/school isolation tests.

### Web

- `src/lib/assess/assessment-evidence-service.ts` — digest-addressed verified-object boundary.
- `tests/assessment-evidence.test.ts` — immutable receipt-key regression and stale reservation overwrite test.
- `docs/assess/rea/reports/REA_R02A_PRODUCT_DECISION_REGISTER.md` — header corrected to include only PD-008 among newly recorded approvals.
- `docs/assess/implementation/ASSESS_P02C2_KONECT_SCANNER_REPORT.md` — this report.

## Remaining blockers and next gate

P02C2 is not production-ready. Independent review must still require:

1. Reviewed native encrypted-file persistence before any restart-safe offline queue or logout retention claim.
2. Signed-in iOS and Android device validation for camera permission, QR scan, capture memory pressure, interruption and accessibility.
3. Shared non-production Clerk, MongoDB and isolated R2 verification, including real receipt recovery and stale-URL/object-replacement behavior.
4. Authorized production index/storage rollout review; no index migration was run here.
5. Sanitized Web build diagnosis/resource review because the 180-second compile attempt stalled again.

Digital marking, OMR, CBT and canonical score handoff remain outside this completion boundary.
