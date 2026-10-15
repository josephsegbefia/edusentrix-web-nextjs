# EduSentrix Intelligent Bulk Import V2

## BI.0 reuse map and migration boundaries

Status: discovery only. The classifications below are implementation guidance for BI.1+; they are not authorization to remove or rewrite the listed modules in BI.0.

## 1. Classification legend

- **REUSE** — keep as a trusted boundary and call it directly or through a thin adapter.
- **REFACTOR** — preserve behavior and persistence while extracting a clearer contract or reducing coupling.
- **REPLACE** — the current surface should become a secondary/compatibility path after parity is proven.
- **DEPRECATE** — quarantine and remove only after migration evidence, not during BI.0.

## 2. Shared architecture map

| Area | Current asset | BI.0 classification | Boundary to preserve |
| --- | --- | --- | --- |
| Domain draft | `src/models/TeacherImportJob.ts` | REUSE / REFACTOR | Existing staged job remains the teacher review aggregate. Additive fields only. |
| Domain draft | `src/models/StudentImportJob.ts` | REUSE / REFACTOR | Existing staged job remains the student review aggregate. Additive fields only. |
| Execution receipt | `src/models/BackgroundJob.ts` | REUSE | One transport record for queue, retry, heartbeat, cancellation, result, and notification metadata. |
| Dispatch | `src/lib/background/functions/bulk-import.ts` | REUSE / REFACTOR | Inngest remains the worker transport; phase routing must stay explicit. |
| Routing | `src/lib/imports/bulk-import-routing.ts` | REUSE | Reject inconsistent routing; never fall through to a legacy importer. |
| Worker wrapper | `src/lib/background/worker-wrapper.ts` | REUSE | Tenant/kind checks, progress, cancellation, terminal state, and notifications. |
| Recovery | `src/lib/background/reconciliation.ts` | REUSE / REFACTOR | Reconcile dispatch failures, stale workers, domain success, and orphan jobs. |
| Retry | `src/lib/background/retry-job.ts` | REUSE / REFACTOR | Retry by phase and persisted source/decision state; never rerun an unconfirmed commit. |
| Cancellation | `src/lib/background/cancellation.ts`, import cancel routes, `src/lib/background/state-machine.ts` | REUSE / REFACTOR | Cancellation is durable and wins races against late worker success/failure. |
| Notifications | `src/lib/background/notifications.ts` | REFACTOR | Copy and metadata must distinguish review-ready, completed, partial, failed, and cancelled. |
| Tenant authorization | existing admin import route guards and school-scoped queries | REUSE | Every read/write remains school-scoped and role/permission checked. |
| Legacy quarantine | `src/lib/imports/legacy-bulk-import-quarantine.ts` | REUSE / DEPRECATE later | Keep legacy transport from silently creating records until staged parity and cutover are proven. |

No row in this map authorizes a new MongoDB collection. The two domain import jobs and `BackgroundJob` remain the persistence model.

## 3. Teacher import map

| Current asset | Classification | Intended V2 use | Required caution |
| --- | --- | --- | --- |
| `src/app/api/admin/teachers/bulk-create/route.ts` | REFACTOR | Keep as a compatibility upload entry while delegating to the staged job workflow. | Do not let its name imply direct creation or bypass review. |
| `src/app/api/admin/teachers/imports/route.ts` | REUSE / REFACTOR | Staged list/create/status boundary. | Preserve tenant scoping and truthful status. |
| `src/app/api/admin/teachers/imports/[id]/route.ts` | REUSE / REFACTOR | Read the durable draft and serialized review state. | Serializer must tolerate missing/legacy Leo metadata. |
| `src/app/api/admin/teachers/imports/[id]/confirm/route.ts` | REUSE / REFACTOR | Approval boundary that enqueues commit only after blocking decisions are resolved. | Do not let Leo or a client-side flag approve the job. |
| `src/app/api/admin/teachers/imports/[id]/cancel/route.ts` | REUSE | Durable cancellation request. | Preserve audit and prevent late commit success. |
| `src/app/api/admin/teachers/imports/[id]/leo-retry/route.ts` | REFACTOR | Future provider retry action without file re-upload. | Later UI must show retry scope and preserve prior metadata. |
| `src/lib/teachers/parse-teacher-import.ts` | REUSE / REFACTOR | File type, sheet, header, and raw-row parser. | Preserve raw values and source row/sheet provenance; do not put domain mutations here. |
| `src/lib/teachers/analyze-teacher-import.ts` | REFACTOR | Deterministic canonicalization, catalog resolution, issue generation, and evidence. | Extract the common issue adapter; subject offering ids remain authoritative. |
| `src/lib/teachers/teacher-import-leo.ts` | REFACTOR | Leo suggestion adapter constrained by teacher catalogs and privacy rules. | Header suggestions currently have a direct provider path; BI.1 should route through the shared boundary. |
| `src/lib/teachers/teacher-import-review.ts` | REUSE / REFACTOR | Review DTO/action support. | Keep admin decisions explicit and serializable. |
| `src/lib/teachers/teacher-import-workflow.ts` | REUSE / REFACTOR | Durable analysis/commit/recovery orchestration. | Keep teacher profile, subject profile, homeroom, and future class assignment distinct. |
| `src/components/modals/ImportTeachersCSVModal.tsx` | REPLACE later | Keep as a compatibility/audit surface while migrating to issue-first review. | Do not delete until the new path covers sheet selection, mapping, issues, decisions, approval, and receipts. |
| `src/models/TeacherImportJob.ts` | REUSE / REFACTOR | Persist canonical rows, issue decisions, Leo metadata, approval, and result. | Additive migration only; existing staged jobs must remain readable. |

### Teacher domain reuse boundaries

Reuse existing school-scoped `SubjectOffering`, `Grade`, and `ClassGroup` catalogs. Do not reintroduce the legacy subject relationship system. The teacher import may store subject profile ids and homeroom decisions, but a later assignment workflow must explicitly create/update `TeacherAssignment` and validate grade/class applicability, contact hours, and timetable implications.

The teacher commit path's existing duplicate checks, invitation handling, and row-level result marking are valuable. They must remain idempotent and must be run again at commit because catalogs and users can change after analysis.

## 4. Student import map

| Current asset | Classification | Intended V2 use | Required caution |
| --- | --- | --- | --- |
| `src/app/api/admin/students/import/route.ts` | REUSE / REFACTOR | Staged upload entry with school-wide/class-scoped placement. | Keep placement mode and fixed target as explicit admin input. |
| `src/app/api/admin/students/imports/route.ts` | REUSE / REFACTOR | Staged list/create/status boundary. | Preserve school scoping and honest lifecycle states. |
| `src/app/api/admin/students/imports/[id]/route.ts` | REUSE / REFACTOR | Durable draft/read boundary. | Serializer must preserve resolution choices and missing Leo metadata. |
| `src/app/api/admin/students/imports/[id]/confirm/route.ts` | REUSE / REFACTOR | Approval and commit enqueue boundary. | Do not allow unresolved grade/class/capacity blockers through. |
| `src/app/api/admin/students/imports/[id]/cancel/route.ts` | REUSE | Durable cancellation. | Cancellation must not claim rollback of already-created students. |
| `src/app/api/admin/students/imports/[id]/leo-retry/route.ts` | REFACTOR | Future provider retry without source re-upload. | Keep prompt inputs minimized and metadata auditable. |
| `src/lib/students/student-import-parse.ts` | REUSE / REFACTOR | CSV/XLS/XLSX parsing, sheets, headers, and raw source provenance. | Do not infer tenant/domain mutations in the parser. |
| `src/lib/students/analyze-student-import.ts` | REFACTOR | Deterministic canonicalization, grade/class/date/status/sex resolution, duplicate and capacity issues. | Reuse current domain rules; adapt issue shape without weakening blockers. |
| `src/lib/students/student-import-leo.ts` | REFACTOR | Catalog-constrained structural suggestions. | Keep names, DOB, admission numbers, guardian data, and raw student rows out of prompts. |
| `src/lib/students/student-import-review.ts` | REUSE / REFACTOR | Review DTO/action support. | Persist admin decisions, not only client state. |
| `src/lib/students/student-import-workflow.ts` | REUSE / REFACTOR | Durable analysis/commit/recovery orchestration. | Run capacity, usage, duplicate, and authorization checks again at commit. |
| `src/components/admin/students/StudentsImportModal.tsx` | REPLACE later | Keep as compatibility/audit surface while migrating to issue-first review. | Do not remove until placement, dates, capacity, conflicts, approval, and receipts are covered. |
| `src/models/StudentImportJob.ts` | REUSE / REFACTOR | Persist canonical rows, issues, placement decisions, Leo metadata, approval, and result. | Additive migration only. |

### Student domain reuse boundaries

Reuse the existing `createStudentForSchool` service and its capacity/usage enforcement. The class-scoped target is a reviewed domain decision; Leo may explain or suggest a mapping, but cannot choose a target or override capacity. Existing duplicate rows remain visible and are skipped without overwriting.

## 5. Leo infrastructure map

| Current asset | Classification | V2 role | Boundary |
| --- | --- | --- | --- |
| `src/lib/leo/access.ts` | REUSE / REFACTOR | Central access decision. | Add `LEO_IMPORT_ASSIST` only in a later slice; retain runtime, platform, school, role, and entitlement gates. |
| `src/lib/leo/runtime.ts` | REUSE | Runtime/configuration flags. | Missing or disabled provider must degrade safely. |
| `src/lib/leo/platform-flag.ts` | REUSE / REFACTOR | Persisted platform default/override. | A synthetic default is not proof of production entitlement or provider readiness. |
| `src/lib/leo/import-completion.ts` | REUSE / REFACTOR | Shared structured import completion boundary. | Keep schema validation, timeout/error metadata, bounded inputs, and no direct mutation. |
| `src/lib/teachers/teacher-import-leo.ts` | REFACTOR | Teacher-specific prompt/schema adapter. | Remove remaining direct provider access in a later refactor. |
| `src/lib/students/student-import-leo.ts` | REUSE / REFACTOR | Student-specific prompt/schema adapter. | Keep privacy-minimized structural context. |
| `src/lib/leo/types.ts` and `src/lib/leo/import-types.ts` | REUSE / REFACTOR | Stable status/reason metadata. | Use explicit unavailable/disabled/invalid/timeout/provider reasons. |
| `src/components/leo/AdminLeoEntry.tsx` | HIDE now / REFACTOR later | Future global assistant shell. | Not mounted during BI.0; do not remove the underlying component or server infrastructure. |

Purpose-built Leo surfaces remain in scope for their own workflows, including exam scheduling, teacher assignments, student insights, and schedule guidance. Hiding the global entry must not be implemented as a broad removal of `Ask Leo` strings or domain panels.

## 6. Legacy and compatibility map

| Asset/boundary | Classification | Cutover condition |
| --- | --- | --- |
| `BulkImportJob` model | DEPRECATE later | No active legacy pending/processing work, staged parity verified, recovery runbook updated, and explicit migration approval. |
| `src/lib/imports/legacy-bulk-import-quarantine.ts` | REUSE now | Remains the safety gate while old transport exists. |
| `src/lib/imports/bulk-import-routing.ts` legacy branch | DEPRECATE later | Remove only after routing audit proves no legacy producers and rollback is documented. |
| direct/older importer runners | DEPRECATE later | No production references, no queued jobs, and a verified replacement receipt path. |
| giant teacher/student review modals | REPLACE later | Issue-first UX has parity and signed-in browser verification. |

The correct migration is additive: observe and quarantine, prove the staged path, migrate traffic, monitor receipts, then remove obsolete paths. BI.0 performs none of those destructive steps.

## 7. Test and verification reuse

Reuse and extend the existing focused suites around:

- bulk-import routing and Inngest dispatch;
- cancellation races and state-machine transitions;
- scheduled/reconciliation database connection behavior;
- teacher import serialization and subject/homeroom resolution;
- student analysis and commit invariants; and
- platform/bootstrap and app-origin diagnostics where they cover the shared runtime.

Later slices need additional contract tests for:

- exact offering selection for stage-specific labels;
- ambiguous generic subjects remaining blocked/reviewable;
- duplicate homeroom claims;
- fixed class conflicts and capacity;
- natural-language proposals never bypassing confirmation;
- retrying analysis without a file re-upload;
- resuming the same draft without losing decisions;
- cancellation winning against late worker success; and
- tenant isolation for every issue/decision endpoint.

Static tests are useful for mount/route contracts, but they do not prove signed-in browser behavior, provider delivery, MongoDB connectivity, Cloudflare/Hetzner/Coolify deployment behavior, or Inngest delivery. Those remain BI.7 verification concerns.

## 8. BI.0 changed surface

The only runtime surface intentionally changed for this discovery slice is the admin layout: the unfinished global `AdminLeoEntry` mount is hidden. The component, its hooks, APIs, and purpose-built Leo panels remain available for later work. The two documents in this directory are the architecture/reuse deliverables. No import collection, importer rewrite, natural-language feature, or legacy cleanup is included.

## 9. BI.1 implementation surface

BI.1 adds the shared modules under `src/lib/import-intelligence/`:

| Module | Role |
| --- | --- |
| `types.ts`, `schemas.ts` | Shared contracts and strict structured-output schemas. |
| `access.ts` | Import-specific capability access independent of normal Leo entitlement. |
| `leo.ts` | One typed Teacher/Student Leo boundary. |
| `catalog-keys.ts` | Opaque catalog keys and server-owned lookup maps. |
| `privacy.ts` | PII minimization, grouped vocabulary, anonymized row refs, bounded context. |
| `issues.ts`, `actions.ts` | Stable issues, resolution precedence, action/proposal validation, and NL protocol. |
| `versioning.ts`, `active-draft.ts` | V2 markers, V1 outcomes, and application-level active-draft policy. |
| `serialize.ts`, `workflow.ts` | Plain JSON review DTOs and notification phase semantics. |

`TeacherImportJob` and `StudentImportJob` are extended additively. OpenAI provider code is now isolated in `src/lib/leo/providers/openai-import-provider.ts`; `src/lib/teachers/teacher-import-leo.ts` and `src/lib/students/student-import-leo.ts` no longer couple directly to that SDK.
