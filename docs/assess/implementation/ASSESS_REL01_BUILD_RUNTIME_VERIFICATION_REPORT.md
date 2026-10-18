# ASSESS-REL01 — Build and Runtime Verification Report

**Repository:** `edusentrix-web-nextjs`
**Date:** 2026-10-16
**Predecessor:** ASSESS-UI02
**Scope:** Build reliability, TypeScript baseline, sanitized local runtime verification

## 1. Executive result

REL01 made two bounded corrections:

1. Removed the root `next/font/google` dependency. The existing CSS still declares `Inter` followed by system fallbacks, so the application does not require a Google Fonts request to compile.
2. Added `npm run build:sanitized`, an allowlisted build launcher that supplies a loopback-only unreachable MongoDB URI, local application origins, and no provider credentials. It sets Next's processed-environment marker so `.env.local` values are not merged into the build process.

The work improved build safety, but it did not produce a complete production build or authenticated browser acceptance. The remaining full-build gate is open.

## 2. Original problem and evidence

Prior UI reports repeatedly observed `next build --experimental-build-mode compile --debug` reaching `Creating an optimized production build ...` and being interrupted with exit 130. Exit 130 demonstrated interruption, not a compiler diagnosis.

The REL01 investigation established these separate facts:

- Installed versions are Next.js `16.0.10`, TypeScript `5.9.3`, ESLint `9.38.0`, Node `24.13.0`, and npm `11.6.2`.
- The repository contains 313 page modules and 1,123 route modules under `src/app` (1,436 page/route files total).
- The machine reported arm64 macOS, 8 available CPU cores, approximately 24 GB available memory, approximately 166 GiB free disk space, and a 1,048,575 file-descriptor limit. No disk or descriptor exhaustion was observed.
- Existing `.next` was approximately 223 MB and contained an active `.next/dev/lock` owned by another `next dev` process from this same checkout. It was not deleted.
- `tests/database-build-isolation.test.ts` passed and confirmed that `connectToDatabase()` rejects during `NEXT_PHASE=phase-production-build` before URI parsing or network connection.
- The build implementation loads dotenv before loading `next.config`. A production-phase `@next/env` probe reported `.env.local` as loaded and detected configured MongoDB, R2 and Paystack variables. A `NODE_ENV=test` probe did not load `.env.local`; production builds do not use that mode.
- The installed Next font loader performs Google CSS and font-file requests, retries three times, and has no production timeout. The root layout imported `Inter` from `next/font/google`.
- Before the correction, the supported webpack comparison reached the font loader and failed with `getaddrinfo ENOTFOUND fonts.googleapis.com`, followed by `Failed to fetch Inter from Google Fonts`.

The recurring interruption therefore had a confirmed external-build dependency and an unsafe environment-loading procedure. The exact cause of the remaining Turbopack no-output interval is not established.

## 3. Implemented corrections

### 3.1 Remove build-time Google Fonts dependency

Changed `src/app/layout.tsx` to remove `next/font/google` and its generated class. `src/app/globals.css` already contains the intended `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", ...` fallback stack, so no font-provider request is required for build or runtime CSS.

This is a build-reliability correction, not a UI redesign. It trades a self-hosted build artifact generated from Google Fonts for the existing browser/system font stack.

### 3.2 Sanitized build launcher

Added `scripts/run-sanitized-next-build.mjs` and the package script:

```text
npm run build:sanitized
```

The launcher passes only the following environment classes:

- local application origins;
- `MONGODB_URI=mongodb://127.0.0.1:1/isolated-build-verification`;
- `MONGO_DB_NAME=isolated-build-verification`;
- telemetry disabled;
- basic process/runtime variables required to execute Node.

It does not pass Clerk, R2, Paystack, Resend, LiveKit, Inngest, SMTP, IMAP or other provider credentials. `__NEXT_PROCESSED_ENV=1` prevents the Next env loader from merging `.env.local` values into the child build process. Next may still print `.env.local` in its environment summary because the loader records the file; that line is not evidence that its values were injected.

### 3.3 Tests

Added `tests/build-sanitized-environment.test.ts` covering isolated database/application values and provider/arbitrary-variable exclusion. The existing database build-isolation tests were rerun unchanged.

## 4. Build-stage diagnostics

| Command or observation | Result | Interpretation |
|---|---:|---|
| `node --test --import tsx tests/database-build-isolation.test.ts` | exit 0, 2 passed | Existing DB build refusal remains active. |
| Unwrapped sanitized default compile, prior UI02 procedure | exit 130 after bounded observation | Reproduces the prior interruption; not a compiler failure proof. |
| Temporary root-font removal A/B with Turbopack | still no progress after 90 seconds; manually interrupted | Font was not the sole cause of the Turbopack pause. |
| Temporary `reactCompiler: false` A/B with Turbopack | still no progress after 60 seconds; manually interrupted | React Compiler flag was not isolated as the cause; config restored. |
| Pre-correction webpack compile | exit 1 | Confirmed `fonts.googleapis.com` failure from `next/font/google`. |
| Corrected `npm run build:sanitized -- --webpack --experimental-build-mode compile --debug` | exit 1 | Passed the font stage, then failed on an existing `node:crypto` webpack boundary. |
| Corrected default `npm run build:sanitized -- --experimental-build-mode compile --debug` | bounded after 90 seconds; manually interrupted | Still no completion or compiler diagnostic; not a pass. |
| Corrected selective Assess compile with `--debug-build-paths` | bounded after 90 seconds; manually interrupted | No Assess-specific compiler diagnostic; not a pass. |
| Full generate/default build | not run to completion | Compile-stage blockers make a later stage non-actionable. |

The corrected webpack failure was:

```text
node:crypto
Module build failed: UnhandledSchemeError
Import trace:
node:crypto
./src/lib/academics/reporting/report-card-approval-service.ts
./src/components/admin/reports/AdminReportRunDetailClient.tsx
./src/app/(app)/admin/reports/report-runs/[id]/page.tsx
```

This is outside the REL01 build-wrapper/layout scope and was not changed. The repository's existing `typescript.ignoreBuildErrors: true` setting also remains unchanged; it is not treated as a TypeScript baseline pass.

## 5. TypeScript baseline

Command:

```text
npx tsc --noEmit --pretty false --incremental false
```

Result on 2026-10-16: **exit 2**, 369 diagnostic headers across 179 files.

| Classification | Diagnostic headers | Files |
|---|---:|---:|
| Application source | 308 | 152 |
| Generated Next output | 2 | 1 |
| Scripts/tooling | 12 | 5 |
| Tests | 47 | 21 |

No diagnostic header matched the REL01 changed paths (`src/app/layout.tsx`, `scripts/run-sanitized-next-build.mjs`, or `tests/build-sanitized-environment.test.ts`). The repository-wide gate remains red because of existing/generated proposal, academic-profile, academic-engine, storage-helper, script and test diagnostics. This classification is evidence for triage, not an assertion that every individual error is independently fixed or dated.

## 6. Database and provider isolation

All database-backed regression runs used disposable MongoMemoryServer/MongoMemoryReplSet instances. Build verification used the loopback port `127.0.0.1:1` and the isolated database name. No persistent, demo or production MongoDB was contacted. No Clerk, R2, Paystack, Resend, LiveKit, Inngest, SMTP or IMAP provider was contacted.

The build launcher is safer than command-level MongoDB overrides alone because it does not inherit arbitrary provider variables and prevents `.env.local` values from being merged.

During an early variable-name inspection, `.env.demo` was found to contain a malformed value line and a value was printed by that diagnostic command. No credential value is included in this report or in the new source files. If that value is a live credential, it should be rotated by an authorized operator; no rotation was performed in this slice.

## 7. Local runtime and browser verification

The sanitized development-server attempt reached Next startup but the sandbox denied local listening with `EPERM`. The escalated localhost-only retry was then blocked by the existing `.next/dev/lock`. Read-only inspection identified:

- `npm run dev` PID 64623;
- its Next child PID 64636;
- `next-server` PID 97667;
- all using this repository's working directory.

No process was terminated, no lock was deleted, and no request was sent through that potentially persistent `.env.local` runtime. Consequently:

- no authenticated Clerk session was used;
- `/admin/assessments`, `/admin/assessments/paper`, and `/teacher/assess/marking` were not browser-tested;
- no screenshots, keyboard traversal, responsive inspection, or visual acceptance is claimed;
- no deployed route, storage preview, device, provider or signed-in role behavior was verified.

## 8. Regression and hygiene evidence

| Check | Result |
|---|---:|
| `node --test --import tsx tests/build-sanitized-environment.test.ts tests/database-build-isolation.test.ts` | exit 0, 4 passed |
| `node --test --import tsx tests/assessment-*.test.ts` | exit 0, 189 passed |
| `npm run test:subscriptions` | exit 0, 155 passed |
| Scoped ESLint over REL01 changed files | exit 0 |
| `node --check scripts/run-sanitized-next-build.mjs` | exit 0 |
| `git diff --check` | exit 0 |
| Repository TypeScript | exit 2; baseline above |

The Assess suite covered the existing publication, delivery, packet, assignment, evidence, marking, moderation, approved-result, Core handoff and route contracts. No assessment feature, entitlement policy, academic score behavior, database model or migration was changed by REL01.

## 9. Changed files

- `src/app/layout.tsx` — remove build-time Google font fetch; preserve CSS fallback stack.
- `scripts/run-sanitized-next-build.mjs` — allowlisted sanitized Next build launcher.
- `tests/build-sanitized-environment.test.ts` — environment isolation regression tests.
- `package.json` — add `build:sanitized` script.
- `docs/assess/implementation/ASSESS_REL01_BUILD_RUNTIME_VERIFICATION_REPORT.md` — this report.

Existing unrelated working-tree changes were preserved. No production configuration, database schema, migration, provider integration, entitlement mapping or assessment workflow was altered.

## 10. Repeatable local procedures

### Safe sanitized compile

From the repository root:

```text
npm run build:sanitized -- --experimental-build-mode compile --debug
```

For the supported webpack comparison:

```text
npm run build:sanitized -- --webpack --experimental-build-mode compile --debug
```

The command is safe for database/provider isolation, but it is not a complete production-build gate until the existing module-boundary and Turbopack completion issues are resolved.

### Safe local development attempt

Use an isolated environment and a free port only after confirming that no other Next process owns the checkout's `.next` lock:

```text
env -i PATH="<node-bin-dir>:/usr/bin:/bin" HOME="<safe-local-home>" TMPDIR=/tmp \
  NEXT_TELEMETRY_DISABLED=1 __NEXT_PROCESSED_ENV=1 \
  APP_RUNTIME_MODE=development APP_URL=http://127.0.0.1:4013 \
  NEXT_PUBLIC_APP_URL=http://127.0.0.1:4013 \
  MONGODB_URI=mongodb://127.0.0.1:1/isolated-rel01-dev-runtime \
  MONGO_DB_NAME=isolated-rel01-dev-runtime \
  npm run dev -- --hostname 127.0.0.1 --port 4013
```

Do not delete `.next/dev/lock` or terminate another process unless its ownership and purpose have been confirmed and that action is separately authorized.

## 11. Readiness and remaining blockers

REL01 is locally accepted as a build-safety correction, not as release approval. Remaining blockers are:

1. Resolve the existing `node:crypto` client/server import boundary or explicitly record an approved alternative.
2. Diagnose and bound the default Turbopack full-graph compile; a manual interruption is not a pass.
3. Reduce or formally baseline the 369 repository TypeScript diagnostics without disabling strictness or hiding source directories.
4. Run a complete sanitized build/generate sequence after compile is clean.
5. Start a clean isolated local runtime and perform authenticated browser verification for the three Assess routes.
6. Complete the previously documented provider, storage, deployment, device, production-index, migration/rollback and independent security gates.

### ASSESS-UI03 readiness

**Not ready for visual acceptance.** UI03 should wait for a clean isolated runtime and authenticated browser evidence. Static UI work may be reviewed independently, but REL01 does not establish rendered, responsive, keyboard, Clerk-session or deployed-route acceptance.

### Production-release requirements

No production release is approved by this report. The production gate still requires a clean supported build, TypeScript disposition, signed-in browser evidence, independent security review, provider/storage verification, operational index and rollback readiness, and explicit pilot acceptance of the remaining paper-assessment boundaries.

## 12. Completion boundary

REL01 stops after the bounded build-safety correction, TypeScript baseline, disposable regression verification and local runtime investigation. ASSESS-UI03 and deployment work were not started.
