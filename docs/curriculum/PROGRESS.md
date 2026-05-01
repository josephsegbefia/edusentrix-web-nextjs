# Curriculum & Scheme of Work Progress

Last updated: 2026-05-01

## Phase Status Tracker

- [x] Phase 0 - Discovery & Safety Baseline
- [x] Phase 1 - Core Scheme Foundation (MVP scaffold)
- [x] Phase 2 - Lesson Note Integration (MVP)
- [x] Phase 3 - Lessons Integration (MVP)
- [x] Phase 4 - Coverage V1
- [x] Phase 5 - CSV/Excel Import
- [ ] Phase 6 - PDF Import + AI Extraction
- [ ] Phase 7 - Advanced Framework + Leo Planner

## Phase 1 Delivered

- Added core data models:
  - `Curriculum`
  - `CurriculumSubject`
  - `CurriculumNode`
  - `SchemeOfWork`
  - `SchemeItem`
  - `SchemeReview`
- Added RBAC permission keys for curriculum/scheme workflows.
- Extended `SchoolSettings` with `academicPlanning` settings block.
- Added teacher scheme APIs:
  - `GET/POST /api/teacher/schemes`
  - `GET/PATCH /api/teacher/schemes/[id]`
  - `POST /api/teacher/schemes/[id]/submit`
  - `GET/POST /api/teacher/schemes/[id]/items`
  - `PATCH/DELETE /api/teacher/scheme-items/[id]`
- Added admin review APIs:
  - `GET /api/admin/schemes`
  - `POST /api/admin/schemes/[id]/approve`
  - `POST /api/admin/schemes/[id]/activate`
  - `POST /api/admin/schemes/[id]/archive`
  - `GET/POST /api/admin/curricula`
- Added teacher/admin UI entry pages:
  - `src/app/(app)/teacher/schemes/page.tsx`
  - `src/app/(app)/teacher/schemes/[id]/page.tsx`
  - `src/app/(app)/admin/schemes/page.tsx`
- Added admin/teacher hooks and shared scheme serializers.
- Added sidebar navigation links for the new pages.

## Phase 2 Delivered

- Extended `LessonNote` with optional `schemeId` and `schemeItemIds` (references `SchemeOfWork` / `SchemeItem`).
- Shared validation in `src/lib/lesson-notes/validate-lesson-note-scheme.ts`:
  - Respects `SchoolSettings.academicPlanning.enableSchemeOfWork`
  - Validates grade/subject compatibility with the scheme
  - Validates scheme items belong to the scheme
- Teacher APIs:
  - `GET /api/teacher/lesson-notes/scheme-suggestions` — matching schemes and items for class/subject (+ optional topic hints)
  - `POST /api/teacher/lesson-notes` — optional scheme fields on create + policy check when publishing
  - `PATCH /api/teacher/lesson-notes/[id]` — link/unlink schemes and items; enforce `requireSchemeLinkForLessonNotes` on publish/submit-related transitions
  - `POST /api/teacher/lesson-notes/[id]/approval` (`action: submit`) — same scheme requirement when school policy mandates it
- Responses (teacher list/detail + admin list/detail) include `schemeId` and `schemeItemIds` where applicable.
- Wizard UI: `LessonNoteSchemeLinkPanel` on context step; readonly view shows when a note is scheme-linked.

## Phase 3 Delivered

- Extended `Lesson` with optional `schemeId` and `schemeItemIds` (same validation helper as lesson notes).
- `POST /api/teacher/lessons` — copies scheme alignment from the source lesson note when valid.
- `PATCH /api/teacher/lessons/[id]` — owner may set/clear `schemeId` / `schemeItemIds`; on **publish**, if the lesson has no scheme yet, copies from the linked lesson note when present.
- Teacher list/detail, lesson bank list, and `TeacherLessonRow` / `useTeacherLessonUpdate` types include scheme fields.
- Teacher lesson detail page shows a short “Scheme alignment” panel when linked.

## Phase 4 Delivered

- **`SchemeItem`** stores manual coverage: `coverageStatus` (not_started → needs_review), optional `coverageNote`, `coverageUpdatedAt` / `coverageUpdatedByUserId`.
- **RBAC**: `schemeItem.updateCoverage` granted to baseline teachers (school admins already have full permissions).
- **`PATCH /api/teacher/scheme-items/[id]/coverage`** — updates coverage when `academicPlanning.enableSchemeOfWork` is on, scheme is **approved** or **active**, and the caller may edit that scheme (owner, school-owned scheme with no owner, or school admin).
- **`GET /api/teacher/coverage/summary`** — with `?schemeId=` returns `{ scheme, summary }`; without it returns approved/active schemes each with a summary (dashboard list).
- **Aggregation** in `src/lib/schemes/coverage-aggregate.ts` (percent = covered ÷ non-dropped planned rows).
- **UI**: `/teacher/coverage` dashboard; scheme detail shows overview bar + per-row coverage select when editable; sidebar link **Coverage** under Resources.

### Out of scope for Phase 4 MVP

- Automatic coverage suggestions from lesson notes / lessons (`coverageUpdateMode` not wired).
- Admin-specific coverage routes (school admins can use teacher APIs when acting as teacher or extend later).
- By-subject / by-class / by-teacher breakdown APIs from the long-form spec.

## Phase 5 Delivered

- **Model** `SchemeImportJob`: stores parsed preview rows, optional UploadThing `fileUrl`/`fileKey`, statuses `parsed` | `confirmed` | `cancelled` | `failed`, `resultSchemeId` after confirm.
- **Parsing** (`src/lib/schemes/scheme-import-parse.ts`): CSV via `csv-parse`; Excel via `xlsx` (first sheet). Flexible headers (`title`/`topic`, `week`, objectives, `notes`). Max 500 rows.
- **Gate**: `enableSchemeOfWork` + `allowSchemeImport` from `SchoolSettings`; download URLs restricted to UploadThing / utfs / ufs hosts (SSRF-safe).
- **RBAC**: `schemeImport.upload`, `schemeImport.confirm` on baseline teachers.
- **APIs**:
  - `POST /api/teacher/scheme-imports` — `{ fileUrl, fileName, fileKey? }` after client upload.
  - `GET /api/teacher/scheme-imports/[id]`
  - `PATCH /api/teacher/scheme-imports/[id]/rows` — replace edited rows + revalidate.
  - `POST /api/teacher/scheme-imports/[id]/confirm` — creates **draft** `SchemeOfWork` + `SchemeItem`s only (never active).
  - `POST /api/teacher/scheme-imports/[id]/cancel`
- **UI**: `/teacher/schemes/import` (UploadThing via existing `DocumentUploader` / `teacherDocument`), preview table, save, confirm → redirects to scheme detail. Link from schemes list when permitted.
- **Dependency**: `xlsx` added; listed in `serverExternalPackages`.

### Out of scope for Phase 5 MVP

- Admin-only import route (teachers + admins with teacher context can use the same flow).
- Background jobs / queue for huge files.
- PDF import (Phase 6).

## Notes

- Phase 1 remains a functional MVP scaffold; optional hardening can add richer validation and audit events without breaking API shapes.
- Phase 2 MVP does not yet resolve scheme titles in the readonly note view (IDs only in data layer); a small enrichment endpoint can be added later.
- Phase 3 does not add student-facing scheme fields in APIs (teachers/ops use case first).
