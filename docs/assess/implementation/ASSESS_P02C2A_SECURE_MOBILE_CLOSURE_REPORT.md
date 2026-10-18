# ASSESS-P02C2A — Secure Mobile Evidence and Device Verification

**Date:** 2026-10-15 (Africa/Accra)
**Repositories:** `edusentrix-konect`, `edusentrix-web-nextjs`
**Status:** Synthetic integration closure complete; production approval remains blocked

## Outcome

This bounded continuation closes the confirmed P02C2 local gaps without adding marking, OMR, CBT, candidate-answer, score-handoff, or subscription-continuity behavior.

The Konect scanner now encrypts captured bytes before discarding the camera URI, persists encrypted records across normal process termination, scopes keys and authenticated data to account and school, recovers records into a new capture session, and retains encrypted bytes through upload failure or pending reconciliation. The Web evidence service now verifies the digest of the final stored object before issuing a receipt.

## Encryption mechanism and compatibility

No dependency or native configuration change was required. The existing Expo SDK `~57.0.27` installation includes `expo-crypto ~57.0.3`, whose installed API exposes native `AESEncryptionKey`, `aesEncryptAsync`, `aesDecryptAsync`, and AES-GCM sealed-data handling on iOS and Android. The queue uses AES-256-GCM, SecureStore for the small key value, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, authenticated account/school-plus-record data, and an app-owned document directory for ciphertext.

The queue is disabled on web. It has an 8 MiB per-page limit, a 64 MiB per-scope limit, an available-disk-space check, temporary encrypted-file write followed by move, and cleanup of incomplete encrypted temporary files. Key loss or authentication failure raises a fail-closed error; no plaintext fallback is attempted.

The current Expo FileSystem API does not expose an explicit no-backup attribute for document files. Device-only SecureStore keys prevent a restored ciphertext from being opened on another device, but ciphertext backup exclusion is not claimed. A native/platform backup review remains required.

Primary references:

- https://docs.expo.dev/versions/latest/sdk/crypto/
- https://docs.expo.dev/versions/v54.0.0/sdk/securestore/
- https://docs.expo.dev/versions/latest/sdk/filesystem/

## Temporary-file lifecycle

`CameraView.takePictureAsync` returns the camera-created local URI. P02C2A reads the bytes and encrypts them immediately. A cache preview is created only for the review surface and is tracked separately.

Cleanup coverage:

- successful verified receipt: encrypted record and preview cleanup;
- retake: encrypted record and preview cleanup before recapture;
- explicit cancellation: tracked preview cleanup, with encrypted records retained for recovery;
- navigation/unmount: tracked preview cleanup;
- upload failure/pending reconciliation: encrypted record retained, no plaintext upload file retained;
- account/school switch/logout: component remount and scope-bound access prevent cross-tenant reads;
- process restart: queue records are listed and recoverable; stale controlled previews are removed;
- application termination before callback handling: not fully observable through the standard Expo camera API and remains an explicit limitation.

Filesystem deletion is best effort. No secure filesystem-block erasure claim is made.

## Restart and synchronization recovery

Encrypted record metadata preserves the delivery, prior session, packet/page marker, stable client upload id, capture order, dimensions, MIME type, size, and creation time. Recovery resolves the page against a currently issued packet manifest and creates a fresh authenticated capture session. Upload retries reuse the stable client upload id. A recovered page remains `captured` until a new server reservation, upload, completion, receipt, and reconciliation result succeed.

`verified` is shown only after the server reports a verified page and confirmed receipt. `pending_reconciliation` and `failed` are distinct states; neither is presented as candidate association or completed evidence.

## Immutable storage invariant

The Web completion path now performs:

1. reads the private reservation object;
2. calculates the server-side SHA-256 digest over the bytes read;
3. writes those bytes to a server-owned digest-addressed key;
4. checks final existence, size, MIME type, and reads the final object again;
5. calculates the final-object SHA-256 digest; and
6. only then commits evidence state and the durable receipt.

The required invariant is:

`SHA-256(final stored bytes) = receipt.digest = SHA-256(server-read bytes)`.

If final verification fails, the page is rejected, the pending asset is failed, cleanup is attempted, and no receipt is issued. A source overwrite after the server read cannot change the bytes used for the final key or receipt.

## Verification evidence

Konect:

- `npm run typecheck` — exit 0.
- Targeted scanner ESLint — exit 0.
- `npm run lint` — exit 0.
- `npm run test:scanner` — 4/4 passed.
- Scanner contracts, encrypted queue, and temporary-file tests — 10/10 passed.
- `npm run test:session` — 130/130 passed.
- `npm run export` — exit 0; iOS, Android and web bundles plus 49 static routes exported. Existing Clerk deprecation and Expo force-exit warnings remain.
- `git diff --check` — exit 0.

Web:

- `node --test --import tsx tests/assessment-evidence.test.ts tests/storage/lifecycle.test.ts` — 16/16 passed.
- Coverage includes school/account isolation, revoked-session denial, private storage, duplicate/replay behavior, source overwrite race, final-object corruption, and receipt suppression on final-integrity failure.
- Targeted ESLint — exit 0.
- Changed-file TypeScript diagnostic filter — no diagnostics for the changed service/test files.
- `git diff --check` — exit 0.

The earlier sanitized Web production build reached optimized compilation without a persistent MongoDB connection but stalled and was stopped with exit 130. P02C2A did not repeat it after a short silent interval; it is not a pass.

No live R2, provider, production database, persistent school database, deployment, commit, or push was used.

## Changed-file summary

Konect:

- `src/features/admin/scanner/api.ts`
- `src/features/admin/scanner/scanner-screen.tsx`
- `src/features/admin/scanner/secure-queue.ts`
- `src/features/admin/scanner/secure-queue.test.ts`
- `src/features/admin/scanner/temporary-files.ts`
- `src/features/admin/scanner/temporary-files.test.ts`
- `docs/reports/P2C2_ASSESS_SCANNER_IMPLEMENTATION_REPORT.md`

Web:

- `src/lib/assess/assessment-evidence-service.ts`
- `tests/assessment-evidence.test.ts`
- `docs/assess/implementation/ASSESS_P02C2A_SECURE_MOBILE_CLOSURE_REPORT.md`

All other worktree changes predate or are unrelated to this bounded slice and were preserved.

## Physical-device and production blockers

No physical iOS/Android device or simulator was available. Not performed: real camera permission, QR/fallback capture, multi-page capture, backgrounding, network interruption, restart recovery, account switch, offline ciphertext inspection, receipt recovery, signed-in API behavior, live storage behavior, and deployment verification.

Executable device checklist for the next isolated-device run:

1. On iOS and Android, sign in as a synthetic school administrator, select the isolated paper delivery, deny camera permission once, then grant it and confirm the first capture reaches review.
2. Capture one page through the exact QR marker and one through the visible fallback code; confirm both resolve only to the issued packet manifest.
3. Capture at least three pages, include one low-resolution image, and confirm review shows page order, quality warning, and retake behavior.
4. Enable airplane mode after capture; confirm the page remains represented only by encrypted local storage and is not shown as verified.
5. Force-stop/terminate and relaunch the app; confirm the encrypted record is listed for the same account and school and can be recovered into a new capture session.
6. Restore connectivity; complete upload and verify that the receipt is shown only after server completion, then confirm the encrypted record and preview cleanup attempt.
7. Interrupt connectivity during upload and retry; confirm the stable client upload id is reused and duplicate server acknowledgement is reconciled without a second receipt.
8. Background and foreground the app during review and synchronization; confirm no stale account/school data appears and pending reconciliation remains distinct from completion.
9. Switch to another account or school and sign out; confirm the previous encrypted record cannot be opened or listed under the new scope. Sign back into the original scope and verify controlled recovery remains possible.
10. Inspect only synthetic test artifacts and device logs; record OS, device model, app build, permission result, network transitions, receipt id, cleanup outcome, and any manual observation. Do not treat export or automated tests as physical-device proof.

Additional release conditions remain: explicit backup-exclusion treatment, provider-side controlled integration, production additive index migration/rollback review, device-loss/key-loss behavior, and independent security review.

## Readiness

P02C2A is ready for independent review and physical-device validation. It is not production-approved. Digital-marking development should remain gated until the device, provider, backup, and release-index conditions are closed.
