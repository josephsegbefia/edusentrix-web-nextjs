# Phase 0 — Lesson Notes implementation verification

**Date:** 2026-04-26  
**Purpose:** Mandatory inventory per [edusentrix-lessons-module-technical-spec.md](../edusentrix-lessons-module-technical-spec.md) §4 and [implementation plan](../edusentrix-lessons-module-implementation-plan.md) Slice 0.  
**Outcome:** Confirmed paths, shapes, and auth patterns for building the **Lessons** layer (`lessonNoteId` link, no wizard changes).

---

## 1. Mongoose models

| Model | File | Role |
|-------|------|------|
| `LessonNote` | `src/models/LessonNote.ts` | Primary document: `schoolId`, `teacherId`, `classGroupId`, optional `subjectId` / `academicPeriodId`, `templateType`, `weekOf`, optional `date`, `topic`, `body` (Mixed), `resources[]`, `status`, workflow timestamps, etc. |
| `LessonNoteReviewComment` | `src/models/LessonNoteReviewComment.ts` | Admin review threads keyed by `lessonNoteId` + `sectionKey`. |
| `LessonNoteApproval` | `src/models/LessonNoteApproval.ts` | Schema exists for approval **history** (`submit` / `approve` / `reject` / `revise`). |

**Finding — `LessonNoteApproval`:** No `LessonNoteApproval.create` (or equivalent) was found under `src/` at verification time. Workflow state lives on `LessonNote` (`status`, `submittedAt`, `approvedAt`, `approvedBy`, `rejectionReason`). Audit events are written from the approval API (`writeTransactionalAuditEvent`). If historical rows are required for product/ops, wire this model in a later task; it does **not** block Lessons Slice 1.

**No `Lesson` (student delivery) model** exists yet — Slice 1 will introduce it.

---

## 2. Template types and bodies (actual vs spec §3)

`LessonNoteTemplateType` in code:

- `NACCA_3_PHASE`, `CLASSIC_JHS`, `SIMPLE`
- `CAMBRIDGE_3_PART`, `BRITISH_3_PART`, `AMERICAN_STANDARDS`
- `IB_PYP_UNIT_PLANNER`, `IB_MYP_UNIT_PLANNER`

Structured bodies are typed in TypeScript (`NaCCA3PhaseBody`, `ClassicJHSBody`, `SimpleBody` in `src/types/lesson-notes.ts` and mirrored in `src/models/LessonNote.ts`). Mongo stores `body` as **Mixed**.

**Spec §3 gaps:** The product doc lists “Primary-specific / JHS-specific / Preschool / Early Years” variants as not yet present. In code, **NaCCA 3-phase** and **Classic JHS** already exist as first-class templates; international and IB planners exist. “Preschool / Early Years” are **not** separate template enums — treat as N/A or future template additions. Lessons MVP should consume whatever `templateType` + `body` the note has, without new template work.

---

## 3. API routes and auth

### Teacher (`requireTeacher`, `PERMISSIONS.journalView` / `journalWrite`)

| Method | Route | Behavior |
|--------|-------|----------|
| `GET` | `/api/teacher/lesson-notes` | List for `context.teacherId` + `schoolId`; filters: `classGroupId`, `subjectId`, `templateType`, `status`, `weekOf`, `academicPeriodId`, `search`, `limit`. Non-admins must have `TeacherAssignment` for class/subject when those filters apply. |
| `POST` | `/api/teacher/lesson-notes` | Create; Zod + `normalizeLessonNoteRequestBody`; assigns `academicPeriodId` from current period; `journalWrite`. |
| `GET` | `/api/teacher/lesson-notes/[id]` | Detail for note owned by `teacherId` + `schoolId`; includes serialized `reviewComments`. |
| `PATCH` | `/api/teacher/lesson-notes/[id]` | Update; non-admins cannot edit `approved`/`rejected`; teachers may only set `status` to `draft` or `published` via PATCH; open review comments for touched sections → `addressed`. |
| `DELETE` | `/api/teacher/lesson-notes/[id]` | Delete; non-admin blocked if `status === approved`. |
| `POST` | `/api/teacher/lesson-notes/[id]/approval` | `submit`, `approve`, `reject`, `return_to_draft`; permission `journal:approve` for reviewer actions; teacher can submit own note. |
| `POST` | `/api/teacher/lesson-notes/ai/generate` | AI assist (out of scope for Lessons Slice 1–3). |

### Admin (`requireSchoolAdmin`)

| Method | Route | Behavior |
|--------|-------|----------|
| `GET` | `/api/admin/lesson-notes` | List all notes in school; filters: class, subject, teacher, template, status, week, search; comment counts aggregated. |
| `GET` | `/api/admin/lesson-notes/[id]` | Full detail + review comments (any teacher’s note in school). |
| `POST` | `/api/admin/lesson-notes/[id]/comments` | Create review comment on a section. |
| `DELETE` (and others if present) | `/api/admin/lesson-notes/[id]/comments/[commentId]` | Comment moderation. |

**Note:** Admin **detail** route is GET-only; teachers use PATCH on their own notes for content. Admins approving use the **teacher** approval endpoint with `journal:approve` (same route module handles school-scoped note lookup).

---

## 4. UI entry points (do not change wizard per spec §2)

| Surface | Path | Role |
|---------|------|------|
| Teacher list + **wizard** | `src/app/(app)/teacher/lesson-notes/page.tsx` | Create/edit via `LessonNoteWizard`; uses `CustomDatePicker`, `PremiumDropdownMenu`, `PremiumSelect`, `useConfirmationDialog` — **reference for Lessons UI polish**. |
| Teacher readonly + section revision | `src/app/(app)/teacher/lesson-notes/[id]/page.tsx` | `LessonNoteReadonlyView` + `TeacherLessonNoteSectionRevisionDialog` for admin comments. |
| Admin list | `src/app/(app)/admin/lesson-notes/page.tsx` | Filters, links to admin detail. |
| Admin detail | `src/app/(app)/admin/lesson-notes/[id]/page.tsx` | Review UI. |

**Wizard implementation:** `src/components/teacher/lesson-notes/LessonNoteWizard.tsx` — steps from `getTemplateDefinition` / `constants/curriculum-lesson-templates`; saves through `useTeacherLessonNoteCreate` / `useTeacherLessonNoteUpdate`.

---

## 5. Payload and normalization

- **Shared types:** `src/types/lesson-notes.ts` — `LessonNote`, `LessonNoteFormData`, `CreateLessonNotePayload`, API responses, review comment types, etc.
- **Request normalization:** `src/lib/lesson-notes/normalize-payload.ts` (used on teacher POST/PATCH).
- **Review helpers:** `src/lib/lesson-notes/review.ts` — `getLessonNoteReviewSections`, `lessonNoteToFormData`, comment grouping.
- **Week start:** Monday-normalized `weekOf` in API helpers (teacher routes).

**API response shape (detail):** String IDs, ISO dates, `body` as stored (null or object), `resources`, `curriculum`, `assessment`, `reflections`, `status`, workflow fields, `reviewComments` on teacher/admin detail.

---

## 6. Mapping to the future `Lesson` entity (Slice 1+)

| Lesson Note field | Use for Lessons |
|-------------------|-----------------|
| `_id` | **`lessonNoteId`** (required FK; **allow many lessons per note** for reteach / reschedule). |
| `schoolId`, `teacherId`, `classGroupId`, `subjectId`, `academicPeriodId` | Denormalize at **lesson creation** for querying and student access control; optional overrides only where product requires (e.g. `scheduledAt` for delivery date ≠ note `date`). |
| `topic`, `templateType`, `body`, `resources`, `durationMinutes` | Student-facing content: prefer **snapshot on publish** (copy or freeze) so admin edits to the note do not mutate published student experience — decide in Slice 3; default recommendation: store `contentSnapshot` or key fields on `Lesson` at publish. |
| `status` (note) | Independent from **lesson** `draft \| published \| archived`. A note can be `approved` while a lesson is still `draft`. Product rule TBD: e.g. only allow “create lesson” when note ≥ `approved` if compliance requires it. |

**Permissions:** Reuse patterns: teacher scoped by `TeacherAssignment` + `journalView`/`journalWrite` where appropriate; students need new read permission and routes (Slice 3).

---

## 7. Exit criteria (Slice 0)

- [x] Models and files located and summarized.  
- [x] Teacher vs admin APIs and auth documented.  
- [x] Wizard vs readonly pages identified; constraint “do not alter wizard chrome” preserved.  
- [x] Clear FK and denormalization plan for `Lesson`.  

**Next step:** Slice 2 — Teacher UI: list lessons / create from lesson note (premium components); optional entrypoint on lesson note pages.

---

## 8. File index (quick reference)

```
src/models/LessonNote.ts
src/models/LessonNoteReviewComment.ts
src/models/LessonNoteApproval.ts
src/types/lesson-notes.ts
src/lib/lesson-notes/normalize-payload.ts
src/lib/lesson-notes/review.ts
src/lib/lesson-notes/quality-score.ts
src/lib/lesson-notes/ai-context.ts
src/app/api/teacher/lesson-notes/route.ts
src/app/api/teacher/lesson-notes/[id]/route.ts
src/app/api/teacher/lesson-notes/[id]/approval/route.ts
src/app/api/teacher/lesson-notes/ai/generate/route.ts
src/app/api/admin/lesson-notes/route.ts
src/app/api/admin/lesson-notes/[id]/route.ts
src/app/api/admin/lesson-notes/[id]/comments/route.ts
src/app/api/admin/lesson-notes/[id]/comments/[commentId]/route.ts
src/components/teacher/lesson-notes/LessonNoteWizard.tsx
src/app/(app)/teacher/lesson-notes/page.tsx
src/app/(app)/teacher/lesson-notes/[id]/page.tsx
src/app/(app)/admin/lesson-notes/page.tsx
src/app/(app)/admin/lesson-notes/[id]/page.tsx
src/models/Lesson.ts
src/app/api/teacher/lessons/route.ts
src/app/api/teacher/lessons/[id]/route.ts
```

---

## 9. Slice 1 implementation (reference paths)

Delivered in the same milestone as this verification doc:

- **Model:** `src/models/Lesson.ts` — `lessonNoteId`, denormalized school/teacher/class/subject/period, `title`, `scheduledAt`, `status` (`draft` | `published` | `archived`), `publishedAt`.
- **Registry:** `Lesson` added to `src/lib/demo/collection-registry.ts` (delete before `LessonNote`).
- **Teacher APIs:** `GET|POST /api/teacher/lessons`, `GET|PATCH|DELETE /api/teacher/lessons/[id]` — auth `journalView` / `journalWrite`; create requires owning `LessonNote` + `TeacherAssignment` (non-admin); delete allowed only for `draft`.

Student-facing routes and publish confirmation UI remain **Slice 2–3**.
