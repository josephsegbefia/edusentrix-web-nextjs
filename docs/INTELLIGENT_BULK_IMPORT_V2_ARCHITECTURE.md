# EduSentrix Intelligent Bulk Import V2

## BI.0 architecture, discovery, and contract lock

Status: discovery and architecture only. This document does not implement BI.1 or any later slice.

## 1. Scope and non-goals

BI.0 establishes the boundary for the next teacher and student import experience. It audits the current staged import paths, records what can be reused, and locks the contracts that later implementation slices must preserve.

BI.0 includes:

- the current Teacher and Student parser, analysis, review, commit, cancellation, retry, reconciliation, notification, and persistence paths;
- the shared `BackgroundJob` and Inngest transport boundary;
- the current Leo access and provider boundary;
- canonical domain contracts for teachers, students, subject offerings, issues, and review decisions;
- a no-new-collection persistence architecture;
- a future-slice dependency order; and
- hiding the unfinished global Ask Leo entry point while preserving purpose-built Leo workflows and the underlying server infrastructure.

BI.0 does not include a new importer, a redesigned review screen, natural-language parsing, a new Leo capability, a migration, a new MongoDB collection, or a production cutover.

## 2. Product boundary

The importer is an assisted administrative workflow, not a blind spreadsheet-to-database converter.

The invariant is:

```text
source file -> deterministic parse -> domain resolution -> Leo assistance when useful
            -> explicit admin review -> domain validation -> durable commit
```

Leo may interpret ambiguity, suggest a mapping, explain an issue, and translate an administrator's instruction into a structured proposal. Leo must not directly create a teacher, student, assignment, homeroom, grade placement, or subject relationship.

The final authority order is:

1. tenant-scoped persisted domain records;
2. the explicit admin decision recorded in the import job;
3. deterministic validators and domain invariants;
4. Leo suggestions and explanations;
5. source-file text and formatting.

An AI suggestion is never a substitute for a valid `ObjectId`, an existing school-scoped catalog item, a permitted mutation, or an admin confirmation where the issue is ambiguous or destructive.

## 3. Current architecture observed in the repository

### 3.1 Teacher path

The current staged Teacher path is distributed across:

- upload and status APIs under `src/app/api/admin/teachers/imports/`;
- the legacy-compatible upload route `src/app/api/admin/teachers/bulk-create/route.ts`;
- `src/lib/teachers/parse-teacher-import.ts` for CSV/XLS/XLSX parsing, sheets, headers, and mappings;
- `src/lib/teachers/analyze-teacher-import.ts` for tenant-scoped deterministic resolution;
- `src/lib/teachers/teacher-import-leo.ts` for Leo-assisted semantic/header suggestions;
- `src/lib/teachers/teacher-import-workflow.ts` for persistence, enqueueing, analysis, approval, commit, serialization, and recovery;
- `src/models/TeacherImportJob.ts` for the staged review aggregate; and
- `src/components/modals/ImportTeachersCSVModal.tsx` for the current review UI.

The upload creates a `TeacherImportJob`, stores the source bytes in that existing job, and enqueues one `BackgroundJob` with `kind: "BULK_IMPORT"`, `subjectType: "TeacherImportJob"`, the domain job id, and an explicit `teacherImportPhase`. Analysis moves the domain job to `review_ready`; only a confirmed review enqueues the commit phase.

Deterministic teacher analysis currently covers column mapping, names, email, duplicate/existing checks, status, homeroom class resolution, subject-offering resolution, school catalogs, and row-level issues. Subject offerings are resolved through display names, short names, codes, subject-family context, stage/band normalization, and class-grade context. A broad subject can remain ambiguous. Multiple new rows claiming one homeroom are treated as a blocking conflict; subject profiles remain independent from the single-valued homeroom relationship.

The current commit creates or reuses the person/teacher domain records and persists teacher subject/profile and homeroom data. A teacher profile is not the same thing as a future `TeacherAssignment`; the V2 contract must not silently turn a subject profile into a class assignment.

### 3.2 Student path

The current staged Student path is distributed across:

- `src/app/api/admin/students/import/route.ts` and the staged import routes under `src/app/api/admin/students/imports/`;
- `src/lib/students/student-import-parse.ts` for workbook parsing, sheet selection, headers, and mappings;
- `src/lib/students/analyze-student-import.ts` for deterministic grade, class, date, status, sex, duplicate, and capacity checks;
- `src/lib/students/student-import-leo.ts` for structural semantic assistance;
- `src/lib/students/student-import-workflow.ts` for persistence, enqueueing, approval, commit, serialization, and retry/recovery integration;
- `src/models/StudentImportJob.ts` for the staged review aggregate; and
- `src/components/admin/students/StudentsImportModal.tsx` for the current review UI.

The Student flow supports `school_wide` and `class_scoped` placement. A class-scoped import may have a fixed grade/class target and a conflict policy. Analysis resolves grades and class groups against the active school's catalogs, normalizes dates/status/sex, detects duplicates and capacity problems, and stores row-level issues before review. Commit uses the existing student creation service with school, capacity, usage, and authorization rules still applied.

### 3.3 Shared background execution

The shared transport is:

```text
domain import job -> BackgroundJob -> Inngest bulk-import function
                  -> tenant/kind/cancellation checks
                  -> domain analysis or commit
                  -> BackgroundJob terminal state + domain state + notification
```

Relevant boundaries are:

- `src/models/BackgroundJob.ts` — queue state, tenant key, subject reference, input/result, retry, cancellation, heartbeat, and notification metadata;
- `src/lib/background/functions/bulk-import.ts` — Inngest function and failure finalization;
- `src/lib/imports/execute-bulk-import.ts` — staged teacher/student phase dispatch;
- `src/lib/imports/bulk-import-routing.ts` — strict routing validation so a staged job cannot fall through to the legacy importer;
- `src/lib/background/worker-wrapper.ts` — connection, progress, cancellation, success/failure, and notification handling;
- `src/lib/background/retry-job.ts` — generic retry and import-specific retry prerequisites;
- `src/lib/background/reconciliation.ts` — stale jobs, dispatch recovery, domain-success recovery, and orphan enqueue recovery; and
- the import cancel routes and cancellation/state-machine helpers.

The import domain jobs remain the source of truth for review data and domain progress. `BackgroundJob` is the durable execution receipt, not a replacement for the import job.

### 3.4 Current Leo boundary

Leo access is currently resolved through `src/lib/leo/access.ts`, runtime flags, persisted platform/school settings, role overrides, and the existing entitlement path. Current import semantic completion is centralized in `src/lib/leo/import-completion.ts`; teacher header suggestions still have a direct OpenAI client path in `src/lib/teachers/teacher-import-leo.ts`. This is a mixed boundary and is recorded for BI.1 refactoring rather than hidden as if it were already unified.

Current import prompts are structurally constrained. Student semantic assistance receives catalogs and vocabulary rather than student names, dates of birth, admission numbers, guardian data, or source rows. Teacher semantic assistance receives column/header and catalog context rather than teacher PII. Leo returns suggestions/metadata; deterministic code and admin review remain authoritative.

The future capability name is `LEO_IMPORT_ASSIST`. BI.0 does not add or enable that capability. Until it exists, import access must continue to use the current layered Leo gate and must fail safely when runtime, entitlement, provider, timeout, schema, or configuration conditions are unavailable.

The unfinished global `AdminLeoEntry` remains in the repository so its infrastructure can be revisited. Its global mount is hidden during BI.0. Purpose-built panels and workflows, such as teacher assignment, exam scheduling, student insights, and schedule guidance, are not hidden.

## 4. Canonical Teacher Import Contract

The future staged import contract should normalize every source row into these conceptual groups:

```ts
type TeacherImportCanonicalRow = {
  identity: {
    firstName: string;
    middleName?: string | null;
    lastName: string;
    preferredName?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  employment: {
    status?: "active" | "inactive" | "invited" | "suspended";
    staffId?: string | null;
    invitationMode?: "send_now" | "queue" | "none";
  };
  subjectProfiles: Array<{
    subjectOfferingId: string;
    subjectId?: string | null;
    sourceLabel?: string | null;
  }>;
  gradeScopes?: Array<{ gradeId: string; sourceLabel?: string | null }>;
  classScopes?: Array<{ classGroupId: string; sourceLabel?: string | null }>;
  homeroom?: {
    classGroupId: string;
    decision: "assign" | "keep_existing" | "replace" | "no_assign";
  } | null;
  source: { rowNumber: number; sheetName?: string | null };
};
```

The persisted implementation may use the existing `TeacherImportJob` fields, but later slices must preserve these distinctions:

- identity belongs to the canonical person/teacher records;
- employment/status/invitation is not a subject assignment;
- a subject profile points to a school-scoped subject offering;
- grade/class applicability is not automatically a timetable assignment;
- homeroom is a single-valued class-group relationship and requires an explicit conflict decision; and
- a future `TeacherAssignment` mutation must be explicit, validated, and separate from profile import.

### Teacher source flexibility

Name formats may include a single full-name column, split first/middle/last columns, initials, titles, and reordered names. The parser should preserve raw values and a normalized interpretation. Leo may suggest a split or ordering, but a low-confidence or ambiguous split becomes a review issue. The system must not silently infer a staff identity from an email or phone when the person match is uncertain.

Subject values are interpreted against active school subject offerings. Examples such as `Creative Arts - Lower Primary` and `Creative Arts - Upper Primary` are distinct offering labels when the school catalog contains both. A generic `Creative Arts` value is not enough to choose a stage-specific offering without class/grade context or admin confirmation.

## 5. Subject and curriculum contract

The subject hierarchy for imports is:

```text
subject family -> subject offering -> grade/band applicability -> optional class-group scope
```

The authority order is:

1. exact school-scoped subject-offering id supplied by a trusted reviewed decision;
2. exact normalized offering name/code/short name;
3. deterministic alias and stage/grade contextual matching;
4. Leo suggestion constrained to the school's offering catalog;
5. explicit admin choice; and
6. unresolved/blocked state.

No import may create a new offering implicitly. No legacy subject string may be stored as if it were an offering id. A subject profile may contain multiple offerings, but the contract must retain the source label and candidate/evidence metadata for auditability.

Preschool learning areas remain outside the central subject-offering contract where the current product rules say they belong to individual grade pages. Later implementation must not use import assistance to revive the old legacy subject relationship system.

## 6. Canonical Student Import Contract

The future staged Student row should normalize into:

```ts
type StudentImportCanonicalRow = {
  identity: {
    firstName: string;
    middleName?: string | null;
    lastName: string;
    admissionNo?: string | null;
    gesIndexNumber?: string | null;
    gesSchoolCode?: string | null;
  };
  demographics: {
    sex?: "male" | "female" | "other" | "unspecified" | null;
    dateOfBirth?: string | null;
  };
  placement: {
    mode: "school_wide" | "class_scoped";
    gradeId: string;
    classGroupId: string;
    sourceGrade?: string | null;
    sourceClass?: string | null;
  };
  lifecycle: {
    status: "active" | "inactive" | "withdrawn" | "graduated";
    enrolledAt?: string | null;
  };
  source: { rowNumber: number; sheetName?: string | null };
};
```

The fixed target of a class-scoped import is an admin decision, not a Leo decision. If a row contains a conflicting grade/class value, the review must expose the conflict and require either an explicit use-target choice or a row-level correction. Capacity is checked against the projected class count at analysis and enforced again at commit.

## 7. Privacy and minimum data contract

| Data | Leo needs it? | Rule |
| --- | --- | --- |
| Header names and structural column samples | Usually | Allowed when needed for mapping; do not send row PII by default. |
| School grade/class/subject catalogs | Yes for resolution | Send identifiers/labels required to constrain suggestions. |
| Raw student names, DOB, admission numbers, guardian data | No for semantic mapping | Never send to Leo for import assistance. |
| Raw teacher names, email, phone, staff identifiers | No for semantic mapping | Never send to Leo for catalog/column interpretation. |
| Source rows | Exceptional only | Requires an explicitly documented, minimized, redacted contract; not part of BI.0. |
| Admin natural-language instruction | Yes | Store the instruction and resulting structured proposal for audit. |

Provider failure, timeout, invalid output, disabled access, missing key, or privacy-policy rejection must degrade to deterministic analysis plus a visible review issue. It must never turn a blocked row into an accepted row.

## 8. Common issue model

Later teacher and student workflows should converge on a transport-neutral issue shape while retaining domain-specific codes:

```ts
type ImportIssue = {
  issueId: string;
  domain: "teacher" | "student";
  code: string;
  severity: "info" | "warning" | "blocking";
  resolutionClass: "automatic" | "review_required" | "admin_decision";
  field?: string | null;
  message: string;
  sourceValue?: string | null;
  affectedRows: number[];
  candidateOptions?: Array<{
    id?: string;
    label: string;
    evidence?: string[];
  }>;
  selectedOptionId?: string | null;
  resolutionSource?: "deterministic" | "leo" | "admin" | null;
  resolvedAt?: string | null;
};
```

The current job schemas already persist issue arrays, candidate options, affected rows, and resolution statuses. BI.1 may normalize naming and shape, but it must remain backward-readable for existing staged jobs.

### Resolution classes

- `automatic`: deterministic and unambiguous; no admin action is required, but evidence remains visible.
- `review_required`: the system has a safe set of candidates or a low-risk normalization, but the admin must inspect/accept it before commit.
- `admin_decision`: there is no safe default, the choice changes a relationship, or the action may replace existing data. The admin must choose explicitly.

Examples of `admin_decision` include a generic subject that could map to multiple stage-specific offerings, a homeroom already occupied by another teacher, two new teachers claiming one homeroom, a fixed class conflict, and any instruction that changes existing assignments.

## 9. Natural-language resolution contract

Natural-language resolution is a review accelerator, not an unlogged command channel.

The required sequence is:

```text
admin instruction
  -> persist instruction on the existing import job
  -> Leo returns a structured proposal constrained by tenant catalogs
  -> UI displays “I understood …” with affected rows and exact changes
  -> admin confirms or edits the proposal
  -> deterministic domain validation runs again
  -> approved resolution is persisted
  -> commit may be enqueued
```

The proposal must include intent, affected rows, candidate ids, proposed changes, unresolved parts, confidence/explanation, and whether confirmation is required. A proposal cannot contain an arbitrary database id, a new subject offering, an unscoped class, or a mutation outside the import domain.

BI.0 defines this protocol only. It does not add chat, instruction parsing, or automatic proposal execution.

## 10. Review, persistence, resume, and cancellation contract

The primary V2 review experience should be issue-first and progressive:

1. show the file/sheet and a truthful analysis status;
2. summarize ready, review, blocked, existing, and capacity/duplicate counts;
3. let the admin resolve one issue or a safe group of identical issues;
4. show the affected rows and resulting canonical values;
5. enable confirmation only when all blocking issues have a valid decision;
6. preserve a secondary full audit table for row-level inspection; and
7. provide a clear commit receipt with created, skipped, failed, and retriable outcomes.

The existing domain import job is the durable draft. It should retain the original file metadata/bytes until analysis/retry policy permits removal, normalized rows, issues, decisions, Leo metadata, approval identity/time, background-job ids, and final result. `BackgroundJob` retains execution and delivery state.

Resume must reopen the same tenant-scoped import draft and rehydrate its persisted decisions. A refresh, worker retry, or reconnect must not cause Leo to re-decide a previously confirmed mapping. “Start over” should create a new import job and leave the prior job/audit trail intact; it must not overwrite an existing draft. The product may later enforce one active draft per school/domain/initiating admin, but that policy must be explicit before implementation.

Cancel is a durable request, not a browser-only state. It must stop future work where possible, prevent analysis/commit success from winning a cancellation race, retain the cancelled job and receipt, and never roll back already-created records unless a separately approved compensation workflow exists. A cancelled commit must be visibly distinct from a failed commit.

## 11. Background and notification semantics

The current phase model should be preserved:

| Phase | Domain state | User meaning |
| --- | --- | --- |
| Analysis queued/running | `uploaded` / `analyzing` | File is being interpreted; no domain records are created. |
| Review ready | `review_ready` | Admin action is required; nothing has been committed. |
| Commit queued/running | `committing` | Confirmed decisions are being applied. |
| Commit terminal | `completed` / `completed_with_errors` / `failed` | Receipt is available. |
| Cancelled | `cancelled` | Work was stopped; no claim of full success is allowed. |

Notifications must describe the phase. Analysis success says the import is ready for review, not complete. Commit notifications distinguish complete, complete with issues, failure, and cancellation. Notification delivery failure must not change the domain result and must remain visible in the background-job receipt.

Retry is phase-aware and idempotent. Analysis retry may reuse retained file bytes. Commit retry must use the persisted approved decisions and must not create duplicates; domain duplicate checks remain active at commit.

## 12. Persistence architecture: no new collection

BI.0 locks the following architecture:

```text
TeacherImportJob / StudentImportJob
  - source metadata and retained bytes
  - parsed/canonical rows
  - resolutions, issues, admin decisions
  - Leo metadata and natural-language proposal history when added
  - approval and final result

BackgroundJob
  - execution transport, progress, retry, cancellation, heartbeat
  - tenant/subject references and notification receipt
```

No `ImportSession`, `ImportIssue`, `ImportConversation`, or `LeoImportJob` collection is introduced by BI.0. If later volume requires separate storage, it needs a separate architecture decision, migration plan, tenant/index review, retention policy, and explicit approval.

Existing Mongo schemas remain the compatibility surface. New fields should be additive, bounded, tenant-scoped through their parent job, and serializer-safe. Existing staged jobs must remain readable even when Leo metadata is absent.

## 13. Future slice dependency order

- BI.1 — shared canonical contracts, issue/resolution adapters, and safe Leo import capability boundary.
- BI.2 — deterministic importer normalization and catalog resolution hardening.
- BI.3 — issue-first review UX and persisted resolution actions.
- BI.4 — natural-language resolution proposals with confirmation and audit.
- BI.5 — durable resume/start-over/cancel/retry polish and receipt UX.
- BI.6 — teacher/student parity, edge-case coverage, and provider/runtime hardening.
- BI.7 — signed-in browser, provider, deployment, and production rollout verification.

Later slices must not begin by deleting the current staged paths. The cutover must first prove parity, recovery, authorization, privacy, and idempotency.

## 14. BI.0 decisions and open risks

Decisions locked:

- subject offerings are the source of truth for teacher subject resolution;
- a teacher profile, subject profile, homeroom, and class assignment are distinct concepts;
- fixed class-scoped Student placement is an admin decision;
- Leo is advisory and catalog-constrained;
- blocking issues require explicit resolution before commit;
- the existing import jobs and `BackgroundJob` remain the persistence/transport model;
- the global Ask Leo entry is hidden while purpose-built workflows remain available; and
- no new MongoDB collection is part of V2.

Risks to validate in later slices:

- current teacher header assistance still has a direct provider boundary;
- existing job schemas use domain-specific issue shapes that need adapters, not an unsafe rewrite;
- the current review components are large and should be migrated incrementally;
- subject aliases can be school-specific and stage-sensitive;
- worker/provider behavior still requires deployed and signed-in verification; and
- legacy `BulkImportJob` transport must remain quarantined until staged parity is proven.

## 15. BI.0 acceptance statement

BI.0 is complete when this architecture and the reuse map are reviewed, the unfinished global Ask Leo entry is not mounted, purpose-built Leo workflows remain intact, and focused static/build checks pass. Completion does not mean the intelligent importer or natural-language resolution is implemented.

## 16. BI.1 concrete implementation

BI.1 adds the shared foundation under `src/lib/import-intelligence/`:

- `types.ts` defines the import capability, tasks, metadata, workbook/column contracts, V2 issue shape, action protocol, natural-language resolution shape, review DTO, and compatibility outcomes;
- `schemas.ts` validates structured responses and rejects unknown action fields/types;
- `access.ts` resolves `LEO_IMPORT_ASSIST` independently from the normal Leo copilot entitlement while retaining authorization, runtime, provider, platform, and privacy gates;
- `leo.ts` is the shared domain/task boundary for Teacher and Student import intelligence;
- `catalog-keys.ts` creates temporary opaque catalog keys and server-owned lookup maps;
- `privacy.ts` groups vocabulary, anonymizes row references, excludes PII by construction, and bounds context;
- `issues.ts` creates stable issue ids and enforces admin/deterministic/Leo resolution precedence;
- `actions.ts` validates proposals and the future natural-language confirmation protocol;
- `versioning.ts` defines `importSchemaVersion: 2`, `analysisVersion: "v2"`, and explicit V1 compatibility outcomes;
- `active-draft.ts` enforces one unfinished draft per school/domain/initiating administrator at application level without a unique index;
- `serialize.ts` provides plain-JSON review DTOs and compatibility metadata; and
- `workflow.ts` provides shared notification phase semantics.

The existing `TeacherImportJob` and `StudentImportJob` now have additive fields for V2 versioning, workbook inspection, column interpretations, V2 issues, natural-language resolutions, and Leo metadata. Existing analysis remains deterministic and domain-owned. BI.1 does not implement Teacher curriculum reasoning, Student placement intelligence, issue-first UI, or commit redesign.

Provider-specific code is isolated in `src/lib/leo/providers/openai-import-provider.ts`. Teacher and Student import modules call `runLeoImportIntelligence` and no longer instantiate or import the provider SDK directly. The underlying provider remains replaceable.

## 17. BI.2 Teacher understanding engine

BI.2 adds a deterministic, tenant-scoped Teacher understanding layer on top of the BI.1 Leo boundary. The parser accepts the official template and arbitrary reasonable CSV/XLS/XLSX shapes. Obvious aliases and structural patterns resolve locally; unresolved headers remain available for Leo or administrator review.

### 17.1 Canonical row and provenance

`ITeacherImportParsedRow` now retains raw `sourceValues` and normalized identity, including `firstName`, `middleNames`, `lastName`, `email`, normalized Ghana phone, employee id, employment status, department, subject values, grade scopes, class scopes, homeroom, and proposal-only explicit assignments. Grade/class ids and subject-offering ids are stored separately from source text. Provenance identifies the source header/value and interpretation source (`exact`, `alias`, `structural`, `leo`, or `admin`).

Full names are split conservatively into first/middle/last names. Missing or uncertain names remain reviewable. Teacher PII is not included in Leo vocabulary context.

### 17.2 Flexible columns and structural teaching data

The parser supports repeated `Subject 1`, `Subject 2`, `Grades Taught`, `Classes Taught`, and equivalent columns, plus delimited lists. `Math Class` and `Science Class` are interpreted as explicit subject/class assignment proposals. A generic `Teaching Assignments` field is parsed as structured text such as `P4A - Maths; P4B - Science`. Source columns are not required to match the official template.

### 17.3 Grade, class, and curriculum resolution

Grade aliases understand local primary/basic/grade/form/JHS vocabulary and number words. Class aliases combine the active class name with its real school grade and code. Every lookup is restricted to active, school-scoped `Grade`, `ClassGroup`, and `SubjectOffering` records.

Subject resolution is contextual rather than globally collapsed:

```text
source subject -> normalized family/alias
               -> explicit stage/band, if present
               -> active school offerings
               -> class-group offering restrictions
               -> grade id / grade band context
               -> AUTO only when one valid offering remains
               -> REVIEW or BLOCKING otherwise
```

This means a broad `Maths` value can resolve to Lower Primary for P1-P3, Upper Primary for P4-P6, and JHS for a JHS class. A teacher with multiple grade/class contexts receives the corresponding offerings independently. A stage mismatch, such as a Primary subject in a JHS context, remains a review issue; Leo semantic substitutions never auto-apply.

### 17.4 Profile, homeroom, and assignment boundaries

Resolved subject offerings populate the teacher subject profile only. They never create or mutate `TeacherAssignment` records. Explicit assignments are normalized into persisted proposals containing subject/class/grade candidates, status, issue code, and provenance. Existing active assignment overlap is reported as a review/co-teaching warning. Duplicate imported assignments are grouped for review.

Homeroom remains separate from classes taught. Occupied homerooms and duplicate imported homeroom claims remain review decisions; no replacement occurs during analysis.

### 17.5 Issues, admin precedence, and persistence

The engine emits legacy row issues plus stable BI.1 `ImportIssueV2` records for missing/invalid identity, duplicate identity, subject and class ambiguity, stage mismatch, grade/class scope gaps, explicit assignment review/overlap, occupied/duplicate homerooms, and provider degradation. Summary counts expose automatic, review, blocked, conflict, and Leo-assisted work.

Admin subject/homeroom decisions are applied through the existing review service, recorded in the V2 issue ledger with `resolvedBy: "admin"`, and passed back into reanalysis as preserved state. Valid prior decisions retain precedence; invalidated catalog choices reopen with an actionable issue. The existing `TeacherImportJob` stores the state and source bytes for reanalysis; `BackgroundJob` remains the transport receipt. No new collection and no BI.2 assignment commit are introduced.

### 17.6 Validation boundary

BI.2 regression coverage includes alternate headers, full/middle names, repeated subjects/grades/classes, P1/P2/P4/JHS context resolution, lower/upper/JHS offerings, cross-band teachers, semantic stage mismatch, explicit assignment overlap, occupied/duplicate homerooms, duplicate source identity, serialization, legacy parser/resolution compatibility, and the permanent 18-teacher fixture at `tests/fixtures/teacher-import/real-teachers-18.csv`. BI.2V verifies the fixture through the actual analysis path with a realistic school catalog, including a Leo semantic-substitution review and degraded/retryable provider fallback. Signed-in browser, live provider, MongoDB, Inngest, Cloudflare, Hetzner, and Coolify behavior remain deployment/runtime verification work.
