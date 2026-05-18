# EduSentrix Lessons v2 — Development Specification

**Version:** 2.0 (overhaul)  
**Status:** Approved for phased implementation  
**Supersedes (in part):** [edusentrix-lessons-module-technical-spec.md](./edusentrix-lessons-module-technical-spec.md) for delivery model, statuses, and creation flow  
**Companion:** [AGENTS.md](../AGENTS.md) — all implementation must follow it  
**Out of scope (documented later):** Ghanaian Language lesson notes / lessons (non-English NLP)

---

## 0. Legacy code policy (v2)

During Lessons v2, **legacy lesson features may be removed** when removal does not break unrelated modules, block migration, or leave dangling UI that pretends to work.

| Safe to remove in phase | Examples |
|-------------------------|----------|
| Misleading UX | Lesson bank **import**, unused “published” on lesson notes |
| Dead or duplicate paths | Routes/components superseded by v2 week plan / session APIs |
| Unused settings enforcement gaps | Flags that were never wired (replace with enforced gates) |

| Keep until replaced | Examples |
|---------------------|----------|
| Data migration inputs | Existing `Lesson`, `LessonFlashcard*`, audit rows |
| Shared dependencies | Lesson note wizard, timetable models, RBAC keys used elsewhere |
| Mobile/API contracts still in use | Student lesson GET shapes until mobile migrates |

**Rule:** Remove legacy code in the **same phase** that ships its replacement, or in Phase F cleanup after redirects exist. Prefer delete over comment-out. Log removals in PR description.

---

## 1. Executive summary

Lessons v2 replaces the current pattern where a **Lesson** is mostly a frozen copy of a **Lesson Note**. Instead:

- **Lesson notes** remain the **one-calendar-week planning** artifact (admin-reviewed).
- **Lesson week plans** group all sessions for that week, class group, and subject.
- **Lesson sessions** are rich, teachable units aligned to **timetable periods** (not ad hoc counts).
- **Lesson deliveries** track teach/complete state **per class group**; delivering in JHS 1A does not complete JHS 1B.
- **Content is cloned** when creating plans for additional class groups from the same approved note; deliveries stay independent.
- **Publish** controls visibility to students, parents, and school admin (teacher-chosen timing, typically after delivery or when ready).
- **Teaching mode** is a guided slide-style presenter flow through session content, resources, and activities.
- **Leo** assists at every step of the creation wizard; APIs use `lessonAi.use` plus subscription entitlements.

Implementation is **strictly phased**. Do not start a later phase until the previous phase exit criteria are met.

---

## 2. Product decisions (locked)

| # | Decision |
|---|----------|
| 1 | Lesson note scope is **always one calendar week** (Mon–Sun or school-configured week boundaries). |
| 2 | **One session → one lesson note** (no multi-note sessions). |
| 3 | **Flashcards are per session** (not shared across the week bundle). |
| 4 | **Content cloned at creation** for each class group; 1A and 1B share the same authored session content initially; **delivery** is tracked separately per class group. |
| 5 | **Publish** = visible to students / parents / school admin as configured; timing is **after delivery or when the teacher chooses** — not tied to note approval. |
| 6 | **English only** for v2 generated and stored instructional text. |
| 7 | **Edits after publish/delivery update what students see** (no immutable snapshot for student body in v2; keep audit/version for compliance). |
| 8 | **No lesson bank import**; remove misleading import UX. |
| 9 | **No student web view-tracking** in this overhaul (student experience moves to mobile app later). |
| 10 | **Teachers cannot create lessons** from lesson notes unless note status is **`approved`**. |
| 11 | Drop legacy lesson note status **`published`**; notes end at `draft` \| `submitted` \| `approved` \| `rejected`. |
| 12 | Substitute / delegated teachers may deliver sessions; **delivery records** store who actually taught. Main teacher retains ownership unless **quit** (see §8). |

---

## 3. Terminology

| Term | Meaning |
|------|---------|
| **Lesson note** | Weekly teacher plan; source for objectives, scheme linkage, TLMs; admin review. |
| **Lesson week plan** | Bundle: one class group + subject + calendar week + approved note; contains N sessions. |
| **Lesson session** | Single timetable period’s teachable unit; rich content, resources, flashcards, teaching deck. |
| **Lesson delivery** | Per session + class group: scheduled → in progress → delivered → completed; attendance + actual teacher. |
| **Publish (session)** | Student/parent/admin visibility flag on session content (see §7). |
| **Coverage** | Scheme / note section marked covered when a session delivery is **completed** for that class group. |

**Do not use** “published” for lesson notes. **Do not confuse** note `approved` with session `published`.

---

## 4. Domain model

### 4.1 Lesson note (existing model — workflow change only)

**Model:** `LessonNote` (`src/models/LessonNote.ts`)

**Statuses (v2):**

```txt
draft → submitted → approved | rejected
         ↑__________________|  (revise & resubmit)
```

**Removed:** `published` on lesson notes. Migration: map existing `published` → `approved`.

**Required fields (unchanged conceptually):** `schoolId`, `teacherId`, `classGroupId` (primary/context), `subjectOfferingId`, `academicPeriodId`, `topic`, week date range (`weekStartDate`, `weekEndDate` — add if missing), scheme links optional.

**Rules:**

- One note = one calendar week for a subject/context.
- Only **`approved`** notes may start the lesson creation wizard.
- Lesson note wizard UI is **not redesigned** in v2 (AGENTS.md).

---

### 4.2 Lesson week plan (new)

**Model:** `LessonWeekPlan` (new file under `src/models/`)

| Field | Type | Notes |
|-------|------|-------|
| `schoolId` | ObjectId | Required, indexed |
| `academicPeriodId` | ObjectId | Required |
| `classGroupId` | ObjectId | Required |
| `subjectOfferingId` | ObjectId | Required |
| `lessonNoteId` | ObjectId | Required; must be `approved` |
| `ownerTeacherId` | ObjectId | Primary teacher from note |
| `weekStartDate` | Date | Calendar week start (date only) |
| `weekEndDate` | Date | Calendar week end |
| `weekLabel` | string | e.g. "Week 3" |
| `title` | string | e.g. "Science — Week 3" |
| `status` | enum | `draft` \| `ready` \| `archived` |
| `sessionIds` | ObjectId[] | Ordered session references |
| `createdFromNoteRevision` | number/string | Optional hash/version of note at clone time |
| `clonedFromWeekPlanId` | ObjectId? | If cloned from another class group’s plan |

**Derived (not stored or updated by cron):** `deliverySummary` — counts completed / total sessions for UI.

**Indexes:** `{ schoolId, classGroupId, subjectOfferingId, weekStartDate }` unique.

---

### 4.3 Lesson session (evolve / replace current `Lesson`)

**Model:** `LessonSession` (new; migrate from `Lesson` in Phase A/B)

| Field | Type | Notes |
|-------|------|-------|
| `schoolId` | ObjectId | |
| `weekPlanId` | ObjectId | Parent bundle |
| `lessonNoteId` | ObjectId | Denormalized for queries |
| `classGroupId` | ObjectId | Denormalized |
| `subjectOfferingId` | ObjectId | |
| `ownerTeacherId` | ObjectId | Primary teacher |
| `sequenceInWeek` | number | 1..N |
| `timetableSlotId` | ObjectId? | Link to published `TimetableSlot` |
| `scheduledDate` | Date | Concrete date for that period |
| `dayOfWeek` | 0–6 | From slot |
| `startTime` / `endTime` | string | From slot |
| `durationMinutes` | number | Computed from slot |
| `title` | string | Session title |
| `status` | enum | `draft` \| `ready` \| `published` \| `archived` |
| `noteSectionAllocation` | object | Which note sections / scheme item ids this session owns |
| `contentBlocks` | array | Rich content (§5) |
| `teachingDeck` | object | Slide-ordered presenter steps (§9) |
| `studentVisibility` | enum | `hidden` \| `published` (teacher control) |
| `parentVisibility` | boolean | |
| `adminVisibility` | boolean | Default true when published |
| `contentVersion` | number | Increment on edit after publish |
| `aiMetadata` | object | Draft flags, Leo usage, teacher reviewed |

**Legacy mapping:** Current `Lesson` rows become single-session week plans during migration (script), or remain read-only archived.

---

### 4.4 Lesson delivery (new)

**Model:** `LessonDelivery` (new)

| Field | Type | Notes |
|-------|------|-------|
| `schoolId` | ObjectId | |
| `sessionId` | ObjectId | |
| `weekPlanId` | ObjectId | Denormalized |
| `classGroupId` | ObjectId | |
| `ownerTeacherId` | ObjectId | Primary teacher |
| `scheduledTeacherId` | ObjectId | Who was expected to teach |
| `actualTeacherId` | ObjectId? | Who taught (substitute if different) |
| `substituteReason` | enum? | `leave` \| `absence` \| `delegation` \| `other` |
| `status` | enum | `scheduled` \| `in_progress` \| `delivered` \| `completed` \| `cancelled` |
| `startedAt` / `endedAt` | Date? | Teaching mode / complete |
| `attendanceBeforeId` | ObjectId? | Link to attendance record |
| `attendanceAfterId` | ObjectId? | |
| `reflectionId` | ObjectId? | Optional post-lesson reflection |
| `completedAt` | Date? | |
| `completedByTeacherId` | ObjectId? | |

**Rules:**

- Exactly **one delivery per session per class group** (session already scoped to class group).
- Completing delivery in class A **never** updates class B (separate week plans).
- **Coverage** rows written on `completed` (§10).

---

### 4.5 Content allocation (note → sessions)

**Model:** embedded on `LessonSession.noteSectionAllocation`

```ts
{
  schemeItemIds: ObjectId[],
  noteSectionKeys: string[],  // stable keys from note body
  coverageWeight: number,      // 0–1, sum per week plan = 1
}
```

**Algorithm (Leo-assisted, teacher-approved in wizard):**

1. Load N slots from **published timetable** for `classGroupId` + `subjectOfferingId` in `[weekStartDate, weekEndDate]`.
2. If N = 0, block wizard with actionable message (publish timetable / assign teacher).
3. Propose N sessions with minutes per slot; map note sections to sessions by duration and scheme order.
4. Ensure **no scheme item / section appears in more than one session** unless teacher explicitly overrides (warning).
5. Teacher accepts or edits split before content generation.

**Timetable source of truth:** `TimetableSlot` on **published** version (`src/models/TimetableSlot.ts`). Class-group scoped (AGENTS.md). Do not invent period counts.

---

### 4.6 Rich content blocks

**Embedded:** `LessonSession.contentBlocks[]`

| Block type | Purpose |
|------------|---------|
| `explanation` | Grade-appropriate in-depth text (English) |
| `example` | Real-world example (Ghana context when relevant) |
| `activity` | Class activity instructions |
| `discussion` | Questions for learners |
| `check` | Quick understanding check |
| `resource_embed` | Link/file from session resources |
| `exit_ticket` | End-of-session check |

Each block: `id`, `type`, `title?`, `bodyHtml` or structured fields, `order`, `estimatedMinutes?`, `aiGenerated`, `teacherReviewed`.

**Generation:** Leo uses approved note JSON + allocation slice + grade band from class group’s grade. Teacher edits in wizard and session detail.

**Student-facing:** Render blocks in order; edits after publish bump `contentVersion` and update mobile/API payload (no frozen `publishedSnapshot` copy of entire note).

---

### 4.7 Flashcards, resources, homework (session-scoped)

| Asset | Scope | Notes |
|-------|-------|-------|
| `LessonFlashcardDeck` / `LessonFlashcard` | Per **session** | Keep existing models; add `sessionId` (rename `lessonId` → `sessionId` in migration) |
| `LessonResource` | Per **session** | Same |
| Studio assignments / homework | Per **session** | Optional post-complete generators |
| Flashcards generation | Post-complete optional | Leo + manual; per session |

---

## 5. Visibility and publish semantics

| Audience | When visible |
|----------|----------------|
| **Teacher / owner** | Always while permitted |
| **Substitute** | When delegated for session/week |
| **School admin** | When `adminVisibility` or school policy says so; default on publish |
| **Students** | When `studentVisibility === published'` and `lessonsModule.enableStudentLessonView` |
| **Parents** | When published + `parentSummaryVisibleToParents` / session parent summary |

**Teacher controls** per session (or bulk for week plan):

- Publish to students now / after delivery / hide.
- Parent summary visibility.

**Default recommendation in UI:** Publish students after **delivery completed**; allow early publish for flipped scenarios.

---

## 6. Substitute and delegation

### 6.1 Assignment types

| Type | `substituteReason` | Owner on record |
|------|-------------------|-----------------|
| Planned delegation | `delegation` | Primary `ownerTeacherId` |
| Same-day absence | `absence` | Primary unless quit |
| Leave block | `leave` | Primary unless quit |
| Ad hoc substitute | `other` | Primary unless quit |

### 6.2 Who can teach

- **Primary teacher** (`ownerTeacherId`): always.
- **Substitute teacher**: assigned via:
  - Existing **Delegation** system where applicable (`src/lib/delegations/`), extended for `lessonSession.deliver`, OR
  - New `LessonSessionSubstitute` assignment: `sessionId`, `substituteTeacherId`, `validFrom`, `validTo`, `assignedBy`.

### 6.3 Delivery attribution

- On start teaching / complete: set `actualTeacherId` (defaults to logged-in teacher).
- If `actualTeacherId !== ownerTeacherId`, require `substituteReason` (dropdown).
- Analytics and coverage credit **actualTeacherId** for “who taught”; week plan ownership stays with owner unless **quit**.

### 6.4 Teacher quit

- If primary teacher status = `inactive` / terminated: week plan flagged `ownerInactive`; admin may reassign `ownerTeacherId`.
- Past deliveries keep historical `actualTeacherId`; do not rewrite.

---

## 7. Lesson creation wizard (teacher UX)

**Entry:** Approved lesson note → “Create lessons for this week” (class group picker if note context allows multiple).

**Step 0 — Context (read-only)**

> Creating lessons for **Science** for **Week 3** (2 Apr 2026 – 6 Apr 2026) for **JHS 1A**.  
> Based on the class timetable, **3 lessons** are needed this week.

Leo: explain slot list (day, period, duration).

**Step 1 — Timetable confirmation**

- Show table of N slots; allow exclude slot (cancelled day) with reason.
- Recompute N; warn if total minutes ≠ expected contact hours.

**Step 2 — Content split**

- Show proposed section/scheme allocation per session; editable.
- Leo: propose titles and focus per session.

**Step 3 — Rich content (per session tabs or sequential)**

- Leo generates `contentBlocks` per session from allocation.
- Teacher edits; mark reviewed.

**Step 4 — Teaching deck**

- Auto-build slides from blocks + resources placeholders.
- Leo: suggest activities/interactions order.

**Step 5 — Review & create**

- Summary: 3 sessions, coverage map, AI disclaimer.
- On submit: create `LessonWeekPlan` + `LessonSession` × N + `LessonDelivery` × N (status `scheduled`).

**Clone flow (1B from 1A):**

- Same wizard pre-filled from 1A week plan IDs; new `classGroupId`; new timetable slots for 1B; **clone** `contentBlocks` and deck; new deliveries.

**UI standards:** `AGENTS.md` — premium glass cards, `ResponsiveModal`, `PremiumSelect`, `CustomDatePicker`, `useConfirmationDialog`, toasts, no fake actions.

**Route (suggested):** `/teacher/lessons/create?noteId=…&classGroupId=…`

---

## 8. Teaching mode (presenter)

**Route:** `/teacher/lessons/sessions/[sessionId]/teach`

**Behavior:**

- Full-screen **slide deck** from `teachingDeck.slides[]` (ordered).
- Slide types: content block summary, activity, check, resource open, timer.
- Navigation: next/prev, jump to section, elapsed time.
- Start → sets delivery `in_progress`, `actualTeacherId`.
- End → sets `delivered` (not yet `completed`).
- Speaker notes per slide (teacher-only).

**Do not** require student web concurrent view; mobile app consumes published content separately later.

---

## 9. Post-lesson flow

On session detail after `delivered`:

1. **Attendance** — before/after hooks to existing period attendance APIs (class group + date + period); store ids on delivery.
2. **Mark completed** — delivery `completed`; write **coverage** records.
3. **Optional generators** (Leo + teacher confirm):
   - Classroom exercises
   - Homework (Studio assignment)
   - Flashcards (per session)
4. **Reflection** — short teacher reflection on delivery (existing pattern, scoped to delivery).

**Publish prompts:** If students not yet visible, suggest publish after complete.

---

## 10. Coverage

**Model:** `LessonCoverageRecord` (new)

| Field | Notes |
|-------|-------|
| `schoolId`, `classGroupId`, `subjectOfferingId`, `schemeItemId` | |
| `sessionId`, `deliveryId` | |
| `lessonNoteId` | |
| `coveredAt` | When delivery completed |

**Rules:**

- One scheme item marked covered **once per class group** per week plan cycle (configurable override with admin permission).
- Admin/teacher analytics aggregate by class group, subject, week.

---

## 11. Navigation & surfaces

| Surface | Behavior |
|---------|----------|
| **Teacher lessons list** | Group by **calendar week** (collapsible); within week: class, subject, sessions with delivery chips (scheduled / delivered / completed). Filters: class group, subject, status. |
| **Class group page** | Tab **Lessons**: same week grouping for that class. |
| **Session detail** | Content, deck, resources, flashcards, delivery card, publish controls, substitute assign. |
| **Admin lesson analytics** | Per class group delivery and coverage (extend existing analytics services). |
| **Parent** | Published session summaries / parent blocks only. |

**Remove:** Lesson bank **import**; keep optional read-only browse later if needed.

---

## 12. Settings (`lessonsModule`)

**File:** `src/lib/lessons/settings.ts`, `SchoolSettings.lessonsModule`

**Phase A requirement:** Every lessons API route calls:

1. `assertLessonsModuleEnabled(schoolId)`
2. `assertLessonsFeatureEnabled(settings, '<flag>', 'Label')` for the relevant feature

| Flag | Enforce on |
|------|------------|
| `enabled` | All lesson routes |
| `enableStudentLessonView` | Student session APIs |
| `enableFlashcards` | Flashcard routes |
| `enableResources` | Resource routes |
| `enableTeachingMode` | `/teach` routes |
| `enableLessonReflection` | Reflection routes |
| `enableLessonAnalytics` | Analytics routes |
| `enableLeoLessonTools` | Leo lesson routes + hide wizard AI steps |
| `requireApprovedLessonNoteToPublish` | **Always true in v2** for creation; keep flag but default `true` |
| `allowTeacherPublishWithoutReview` | **Deprecated** — treat as false in v2 |
| `requireTeacherReviewForAiContent` | Publish checklist / block publish if AI blocks unreviewed |
| `parentSummaryVisibleToParents` | Parent APIs |
| `notifyStudentsOnPublish` / `notifyParentsOnPublish` | Publish actions |

**Admin settings UI:** Expose all flags that are enforced (Phase A); no “dead” toggles.

**Defaults (v2 migration):**

```ts
requireApprovedLessonNoteToPublish: true,
allowTeacherPublishWithoutReview: false,
enableLeoLessonTools: false, // schools opt in
```

---

## 13. Permissions (RBAC)

**File:** `src/lib/rbac/rbac.ts`

| Permission | Use |
|------------|-----|
| `lessons.read` | View week plans / sessions |
| `lessons.create` | Wizard create |
| `lessons.update` | Edit content, deck |
| `lessons.publish` | Student/parent visibility |
| `lessons.delete` / `lessons.archive` | Archive week plan / session |
| `lessonTeachingMode.manage` | Presenter |
| `lessonAi.use` | **All** `/api/leo/lessons/*` and wizard Leo steps |
| `lessonFlashcards.*` | Per session flashcards |
| `lessonResources.*` | Per session resources |
| `lessonReflections.manage` | Post-lesson reflection |
| `lessonCollaboration.*` | Comments (session or week plan level) |
| `lessonAudit.view` | Audit log |

**Change from legacy:** Leo lessons server context **must** check `lessonAi.use`, not `journalWrite` (`src/lib/leo/lessons-draft-shared.ts`).

Lesson notes keep `teacher.journal.view` / `teacher.journal.write` for the note wizard only.

---

## 14. API outline (by phase)

### Phase A — Foundation

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/teacher/lesson-notes/[id]/week-creation-context` | Approved check, week dates, slot count preview |
| GET | `/api/teacher/timetable/class-group-slots` | Slots for class + subject + date range |
| POST | `/api/teacher/lesson-week-plans` | Create plan + sessions + deliveries |
| GET | `/api/teacher/lesson-week-plans` | List (filter by week, class, subject) |
| GET | `/api/teacher/lesson-week-plans/[id]` | Detail with sessions + deliveries |
| PATCH | `/api/teacher/lesson-sessions/[id]` | Update content, publish flags |
| PATCH | `/api/teacher/lesson-deliveries/[id]` | Status, actual teacher, substitute reason |
| POST | `/api/teacher/lesson-sessions/[id]/substitute` | Assign substitute |

Admin: PATCH `/api/admin/settings` — full `lessonsModule` patch.

**Leo (permission fix only in A):** `requireLessonsLeoTeacherContext` → `lessonAi.use` + entitlement.

### Phase B — Wizard + Leo generation

| POST | `/api/leo/lessons/propose-week-split` | N sessions + allocations |
| POST | `/api/leo/lessons/generate-session-content` | Blocks per session |
| POST | `/api/leo/lessons/generate-teaching-deck` | Slides |

### Phase C — Teaching + post-lesson

| POST | `/api/teacher/lesson-sessions/[id]/teach/start` | `in_progress` |
| POST | `/api/teacher/lesson-sessions/[id]/teach/end` | `delivered` |
| POST | `/api/teacher/lesson-deliveries/[id]/complete` | Complete + coverage |
| POST | `/api/teacher/lesson-deliveries/[id]/attendance` | Link before/after |
| POST | `/api/leo/lessons/generate-flashcards` | Post-complete (existing path, session-scoped) |

### Student / parent (minimal for web)

| GET | `/api/student/lesson-sessions/...` | Published blocks only (mobile-ready shape) |
| GET | `/api/parent/wards/.../lesson-sessions/...` | Parent-visible fields |

---

## 15. Migration strategy

**Script:** `scripts/migrations/lessons-v2-migrate.ts`

1. Lesson notes: `published` → `approved`.
2. Existing `Lesson` → `LessonWeekPlan` + single `LessonSession` + `LessonDelivery` (status from old lesson status).
3. `LessonFlashcardDeck.lessonId` → `sessionId` (alias field during transition if needed).
4. Archive lessons that cannot be mapped to a timetable slot with `legacyUnmapped: true`.
5. Log counts per school; dry-run mode.

**Do not delete** old collections until Phase F cleanup.

---

## 16. Implementation phases

### Phase A — Foundation & cleanup (no rich AI wizard yet)

**Goals:** Correct statuses, settings enforced, permissions fixed, new models, list grouped by week, block unapproved note creation.

**Tasks:**

1. Remove note status `published`; migration + UI labels (“Approved for delivery”).
2. Enforce `lessonsModule` flags on all lesson/session/delivery routes.
3. Leo: `lessonAi.use` + `enableLeoLessonTools` gate.
4. Add `LessonWeekPlan`, `LessonSession`, `LessonDelivery` models.
5. Timetable slot query helper (published version, class group + subject + week).
6. APIs: week plan CRUD (minimal), delivery status PATCH.
7. Teacher list UI: group by week; session cards show delivery state.
8. Remove lesson bank import UI.
9. Block `POST` create if note not `approved`.
10. Admin settings: expose `lessonsModule` toggles.

**Exit criteria:**

- [x] No `published` on lesson notes in DB/UI.
- [x] Creating lessons from draft/submitted note returns 403 with clear message.
- [x] Disabled `enableFlashcards` returns 403 on flashcard routes.
- [x] Leo routes return 403 without `lessonAi.use`.
- [x] Week-grouped list renders with empty state when no plans.

**Phase A implementation log (2026-05-17):** Models `LessonWeekPlan`, `LessonSession`, `LessonDelivery`; week-plan APIs; delivery PATCH; settings enforcement helpers; admin lessons toggles; migration `scripts/migrations/lessons-v2-phase-a.ts`.

---

### Phase B — Timetable-driven week wizard (manual content)

**Goals:** Full creation wizard without Leo generation (or Leo preview only on split).

**Tasks:**

1. `week-creation-context` API with slot table.
2. Wizard steps 0–2 + 5 (confirm split manually).
3. Create N sessions + deliveries from timetable.
4. Clone week plan to second class group.
5. Class group page lessons tab (week grouped).
6. Session detail page (basic block editor manual).

**Exit criteria:**

- [x] Teacher can create 3 sessions from approved note + timetable for one class.
- [x] Clone to 1B creates separate deliveries; completing 1A does not complete 1B.
- [x] Sessions appear under correct calendar week.

**Phase B implementation log (2026-05-17):** `week-dates` helper; `planNotes` on sessions; `create-week-plan` shared service; week-creation-context defaults from `note.weekOf`; clone + session GET/PATCH APIs; hooks `useLessonWeekCreation`, `useTeacherLessonSession`; wizard `/teacher/lessons/create`; session detail `/teacher/lessons/sessions/[id]`; panel links + clone modal; journal class page panel; workflow bar → wizard.

---

### Phase C — Rich content & Leo wizard

**Goals:** AI block generation; content allocation enforcement.

**Tasks:**

1. `contentBlocks` schema + renderer (teacher + student API shape).
2. Leo APIs: propose-week-split, generate-session-content.
3. Wizard steps 3–4 with Leo (gated).
4. `requireTeacherReviewForAiContent` enforcement on publish.
5. Edit after publish updates student payload + `contentVersion`.

**Exit criteria:**

- [x] Leo generates English blocks per session from note slice.
- [x] Coverage weights sum to 1 per week plan (validator).
- [x] Unreviewed AI blocks block publish when setting on.

**Phase C implementation log (2026-05-17):** `contentBlocks` + `aiMetadata` on `LessonSession`; `content-blocks` normalize/validate + publish gate; Leo `propose-week-split` and `generate-session-content`; wizard split/content steps; session detail block editor; student GET `/api/student/lesson-sessions/[id]`; clone copies blocks; `contentVersion` on publish/edit.

---

### Phase D — Teaching mode & delivery lifecycle

**Goals:** Presenter deck; deliver / complete; attendance links.

**Tasks:**

1. `teachingDeck` model + slide builder from blocks.
2. Teach route UI (fullscreen presenter).
3. Delivery transitions: scheduled → in_progress → delivered → completed.
4. Attendance integration (before/after).
5. Coverage records on complete.

**Exit criteria:**

- [x] Teacher can teach through deck and mark delivered.
- [x] Complete writes coverage for allocated scheme items.
- [x] Attendance ids stored on delivery when taken.

**Phase D implementation log (2026-05-17):** `teachingDeck` on sessions + slide builder; fullscreen presenter `/teacher/lessons/sessions/[id]/teach`; teach start/end APIs; delivery complete API + `LessonCoverageRecord`; `LessonAttendanceLink` + attendance POST on delivery; session detail teach/complete/attendance UI.

---

### Phase E — Substitute, publish, post-lesson generators

**Goals:** Delegation; visibility rules; flashcards/homework after complete.

**Tasks:**

1. Substitute assign API + UI on session.
2. `actualTeacherId` on teach/complete.
3. Publish controls (student/parent/admin).
4. Post-complete: flashcards, homework, exercises (Leo optional).
5. Reflection per delivery.

**Exit criteria:**

- [x] Substitute can teach assigned session; analytics show actual teacher.
- [x] Publish hides/shows student API payload correctly.
- [x] Flashcards created per session after complete.
- [x] Session-linked homework/practice can be created after complete (Studio + Leo).

**Phase E implementation log (2026-05-17):** `session-access` + substitute assign/clear API; teach/complete/read access for scheduled substitute; `parentVisibility` / `adminVisibility` on session PATCH + UI; `LessonDeliveryReflection` + session reflection API; session-scoped flashcard decks (`sessionId` on deck/card), flashcards API, Leo `generate-session-flashcards`, student session flashcards GET; post-complete flashcards + reflection panels on session detail; `sourceSessionId` on `Homework` + session assignment-seed/assignments APIs; Studio create from session; Leo `generate-session-practice`; homework/quiz/practice panel on session detail.

---

### Phase F — Admin analytics & legacy cleanup

**Goals:** Coverage dashboards; deprecate old `Lesson` model paths.

**Tasks:**

1. Extend `teacher-analytics.service.ts` / `admin-analytics.service.ts` for delivery + coverage by class group.
2. Redirect old URLs `/teacher/lessons/[id]` → session detail.
3. Remove dead code (`publishedSnapshot`-only paths if fully replaced).
4. Update `content/docs/lessons/lessons-overview.md`.

**Exit criteria:**

- [x] Admin sees coverage by class group and week.
- [x] No broken links from teacher sidebar.

**Phase F implementation log (2026-05-17):** `lessons-v2-coverage-analytics` + `v2Coverage` on admin/teacher analytics services; `LessonsV2CoverageSection` on analytics pages; `legacyLessonId` + `GET /api/teacher/lessons/[id]/v2-session` + redirect on legacy lesson page; session-scoped resources (`sessionId` on `LessonResource`, APIs, panel); `scripts/migrations/lessons-v2-migrate.ts`; parent session GET; Leo `generate-teaching-deck`; `content/docs/lessons/lessons-overview.md` updated for v2.

---

## 17. AGENTS.md compliance checklist

| Rule | How v2 complies |
|------|-----------------|
| School-scoped data | All models indexed by `schoolId` |
| Class schedule source of truth | Session count from `TimetableSlot`, class-group scoped |
| Subject offerings | `subjectOfferingId` on plans/sessions |
| Lesson notes not redesigned | Wizard untouched; downstream only |
| Lesson notes admin review | Required `approved` before lesson creation |
| No placeholder UI | Wizard steps disabled until API succeeds |
| Premium UI | Reuse admin/students glass patterns |
| Entitlements on expensive AI | `requireEntitlement` + `lessonAi.use` |
| Settings truthful | All `lessonsModule` flags enforced |
| Incremental migration | Phased; old lessons archived not deleted |
| ObjectId validation | Before `new Types.ObjectId()` |
| Confirmations | Destructive archive/delete via `useConfirmationDialog` |

---

## 18. Explicitly out of scope (v2)

- Ghanaian Language lesson notes / lessons (future spec + NLP).
- Student web app view tracking (mobile owns engagement).
- Lesson bank import / copy-from-school-lesson.
- WhatsApp/SMS lesson notifications.
- Immutable published snapshot (replaced by versioned live content).
- Section-anchored collaboration (optional later; week/session comments only if needed).

---

## 19. Open engineering notes (non-blocking)

1. **Week boundaries:** Use school timezone for `weekStartDate` / `weekEndDate` (store UTC date keys).
2. **Timetable version:** Pin `versionId` on week plan when created; warn if school publishes new timetable mid-week.
3. **Mobile API contract:** Phase C should define stable JSON for `contentBlocks` for future app.
4. **Conflict with existing `StudentLessonProgress`:** Map to session + delivery or replace with delivery-status for web.

---

## 20. Document history

| Date | Change |
|------|--------|
| 2026-05-17 | Initial v2 spec from product overhaul discussion |

**Next step:** Implement **Phase A only** in a dedicated PR; do not skip ahead.
