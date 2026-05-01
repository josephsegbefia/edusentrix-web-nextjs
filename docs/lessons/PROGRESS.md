# Lessons module — implementation progress

**Plan:** [edusentrix-lessons-module-implementation-plan.md](../edusentrix-lessons-module-implementation-plan.md)  
**Spec:** [edusentrix-lessons-module-technical-spec.md](../edusentrix-lessons-module-technical-spec.md)

**Last updated:** 2026-04-26

**Current stage:** V1 + V2-adjacent: parent-facing summaries (school toggle + guardian UI); school **lesson bank**; Phase 1 **template variant resolver** scaffold. Larger V2 (assignments-as-product, spaced revision, collaboration) still optional backlog.

---

## Slice checklist

Status: `—` not started · `~` in progress · `✓` done

| Slice | Name | Status | Notes |
|-------|------|--------|--------|
| 0 | Pre-implementation verification (spec §4) | ✓ | `phase-0-lesson-notes-verification.md` |
| 1 | Lesson model + APIs (list/detail/create) | ✓ | `Lesson` model; `/api/teacher/lessons` |
| 2 | Teacher UI: create from note + list | ✓ | `/teacher/lessons`, hooks, sidebar, note entrypoints |
| 3 | Publish + confirmation + student read-only | ✓ | `publishedSnapshot` on publish; `/api/student/lessons`; `/student/lessons`; `LessonNoteReadonlyView` |
| 4 | Flashcards MVP | ✓ | Deck + cards models; teacher/student APIs; `TeacherLessonFlashcardsPanel`; `StudentLessonFlashcardsStudy`; progress upsert |
| 5 | Resources / library wiring | ✓ | `LessonResource`; link + catalogue; teacher/student APIs; `TeacherLessonResourcesPanel`, `StudentLessonResourcesList`; visibility; demo registry |
| 6 | Teaching Mode | ✓ | `teachingMode` on `Lesson`; `/teacher/lessons/[id]/teach`; segments + prompts; `includeDisplayNote` query; published/archived + snapshot gate |
| 7 | Reflections & outcomes | ✓ | `LessonReflection`; `GET/PATCH .../reflection`; panel + Teaching Mode link `#lesson-reflection` |
| 8 | Analytics & dashboards | ✓ | Admin + **teacher** scoped analytics; `getLessonAnalytics` / `getTeacherLessonAnalytics`; date range; completion rates |
| 9 | Notifications | ✓ | In-app + **transactional email** (`LESSON_PUBLISHED_STUDENT`) when student has linked `userId` + email; PATCH publish hook |
| 10 | Leo / AI (V2) | ✓ | `POST /api/leo/lessons/*` (7 routes); `lessons-draft-shared.ts`; draft-only JSON; same AI limits + `journalWrite` as lesson-notes AI |

**MVP 1 target:** Slices 0–3 — **complete.**

---

## Session log

Newest first.

| Date (UTC) | Slice | Before (intent) | After (shipped) |
|------------|-------|-----------------|-----------------|
| 2026-05-01 | Leo differentiated materials (V2 closure) | V2 called out differentiated learning materials, but Leo flows did not expose a dedicated endpoint/action for this output. | Added `POST /api/leo/lessons/generate-differentiated-materials` returning tiered draft materials (`support/core/extension`, adjustments, tasks, checks, grouping strategy, teacher notes); wired `kind: "differentiate"` in `useLeoLessonDraft`; added “Differentiate” action in `TeacherLessonLeoPanel`. |
| 2026-05-01 | Collaboration visibility parity hardening | Teacher lesson list showed owner + explicit collaborators but could miss assignment-based co-teachers. | `GET /api/teacher/lessons` now adds assignment-derived visibility (active teacher assignments by class/subject/period) to list filtering so co-teachers who can open lesson detail also see those lessons in list/discovery. |
| 2026-05-01 | Collaboration validator regression tests | Collaborator hardening lacked focused automated tests for malformed/disallowed IDs. | Added `tests/lesson-collaboration-validation.test.ts` for `validateCollaboratorTeacherIdsInput` covering invalid ID rejection, same-school/active enforcement via allowed-id set, and dedupe/owner-exclusion normalization. |
| 2026-05-01 | Collaboration access-control hardening | Collaborator assignment accepted malformed IDs and could include non-school/non-active teachers. | Hardened lesson detail PATCH collaborator updates: now rejects invalid ObjectIds and enforces collaborator IDs map to active/on-leave teachers in the same school; owner-only guard remains in place. |
| 2026-05-01 | Admin analytics drill-downs (V2 hardening) | Academic-head analytics had KPI cards but lacked ranked drill-down views for actionability. | Added ranking drill-downs to admin lesson analytics: `lessonTasks.teacherRanking`, `lessonTasks.classRanking`, and `collaboration.hotspots` (open comment hotspots by lesson). Dashboard now shows “Teacher task ranking”, “Class task ranking”, and “Collaboration hotspots” panels. |
| 2026-05-01 | Advanced reports for academic heads (V2) | Admin lesson analytics lacked downstream task outcomes and collaboration-health indicators. | Extended `getLessonAnalytics` with `lessonTasks` (linked task created/published mix, submissions, distinct learner submissions, graded volume, average score) and `collaboration` (shared lessons, shared lessons active in range, comment created/resolved/open counts); `/admin/lessons/analytics` now includes dedicated “Lesson task outcomes” and “Collaboration health” sections. |
| 2026-05-01 | Teacher collaboration on lessons (V2) | Lessons were single-owner only with no in-context collaboration thread. | Added collaboration support on lesson detail: assignment-based co-teachers (plus optional explicit collaborator IDs) can access lesson details; list API includes collaborator-shared lessons; new lesson collaboration comments APIs (`GET/POST /api/teacher/lessons/[id]/collaboration/comments`, `PATCH .../[commentId]`) with resolve/reopen; new `TeacherLessonCollaborationPanel` renders collaborators and threaded notes. |
| 2026-05-01 | Lesson task outcome rollups (V2) | Teacher lesson analytics did not show downstream assignment/quiz outcomes from linked lesson tasks. | `getTeacherLessonAnalytics` now includes `lessonTasks` rollups for linked tasks (`sourceLessonId`): created/published counts, quiz vs assignment-like split, submissions, distinct learners submitted, graded count, average graded score; `/teacher/lessons/analytics` renders a dedicated “Lesson tasks (assignments & quizzes)” section. |
| 2026-05-01 | Lesson↔assignment linkage | Lesson-created assignments/quizzes were not explicitly linked for reporting. | Added `Homework.sourceLessonId`; assignment create API accepts/validates it; lesson-launched assignment/quiz create pages submit it; lesson detail GET now returns `linkedAssignmentsSummary` (totals/published/draft/quizzes/assignments) and UI renders “Lesson tasks created”. |
| 2026-05-01 | Student revision analytics (V2) | Student list only showed studied ratio; no revision-quality view. | `GET /api/student/lessons` now includes `progress.revision` (flashcard known/needs-review/learning/new counts, review events, 7-day completions, recent completion streak); `/student/lessons` renders a “Revision analytics” card. |
| 2026-05-01 | Quiz auto-seeding from lessons | Lesson→quiz hook prefilled metadata only; quiz builder still blank for questions. | `assignment-seed` now includes starter quiz questions: prefers lesson flashcards (`LessonFlashcard`), falls back to `publishedSnapshot.assessment`; quiz create page hydrates `questions` from seed when opened via `?lessonId=`. |
| 2026-05-01 | Lesson → assignment/quiz hooks | V2 asked for lesson-to-assignment/quiz but teacher flow started from blank studio forms. | `GET /api/teacher/lessons/[id]/assignment-seed` (title/instructions/subject/class defaults from lesson snapshot) + prefill support in `/teacher/studio/assignments/new` and `/teacher/studio/quizzes/new` via `?lessonId=`; added “Create assignment” + “Create quiz” CTAs on lesson detail. |
| 2026-04-26 | Parent summaries + bank + Phase 1 scaffold | V2 items: parent visibility, shared bank, template Phase 1. | `SchoolSettings.lessonsModule.parentSummaryVisibleToParents`; `Lesson.parentSummaryHtml`; teacher PATCH/GET + Leo **Save to lesson (parents)**; admin **Features** toggle; `GET /api/parent/wards/[id]/lessons` + `[lessonId]`; parent pages `wards/[id]/lessons` (+ detail); overview CTA; **`GET /api/teacher/lessons/bank`** + `/teacher/lessons/bank` + sidebar + list CTA; `template-variant-resolver.ts` + `phase-1-template-resolver.md`. |
| 2026-04-26 | AuditEvent dual-write | Lesson actions lived only in `LessonAuditLog` (no tamper-evident stream). | Registered Tier-1 `lesson.*` policies in `policy.ts`; `recordLessonAudit` appends hash-chained `AuditEvent` on `school:<schoolId>:lessons` via `writeRetryableAuditEvent` when `httpRequest` is passed; teacher lesson routes/resources pass `Request` + `actorRole`; publish + flashcards audits include `publishedAt` for idempotency; `buildSchoolUserAuditContext` / related helpers accept Web `Request` (+ pathname from `URL`). |
| 2026-04-26 | UX + hardening | Teachers waited for manual refresh for studied stats; student list capped; duplicated % math. | `completionRatioPercent` in `completion-percent.ts` + `tests/lesson-completion-percent.test.ts`; student `GET /api/student/lessons` `limit`/`offset` + `pagination`; `useInfiniteQuery` + “Load more” on `/student/lessons`; `useTeacherLesson` / `useTeacherLessons` refetch intervals (45s / 90s) when lesson list/detail should stay fresh. |
| 2026-04-26 | Teacher list studied | At-a-glance completion on lesson grid. | `GET /api/teacher/lessons` batches `studentStudiedSummary` (studied / class / %); cards on `/teacher/lessons` for published/archived. |
| 2026-04-26 | Teacher lesson studied stats | Surface class-level self-reported completion on lesson detail. | `GET /api/teacher/lessons/[id]` includes `studentCompletionSnapshot` (active class count, studied count, %); Details card on `/teacher/lessons/[id]`. |
| 2026-04-26 | Student list progress | Learner-facing completion visibility. | `GET /api/student/lessons` returns `progress` (class published total, studied count, %) + `studied` on list rows; student lessons page summary + badges; `useStudentLessonComplete` invalidates list cache. |
| 2026-04-26 | Curriculum coverage | Roster-weighted completion vs publishes in range. | `lesson-analytics-curriculum-coverage.ts`; `curriculumCompletionInRange` on admin + teacher analytics APIs/pages (published in range, slots, completions, %). |
| 2026-04-26 | Teacher analytics | Spec §23 teacher dashboard gap. | `getTeacherLessonAnalytics`; `GET /api/teacher/lessons/analytics`; `useTeacherLessonAnalytics`; `/teacher/lessons/analytics`; sidebar + CTA from lesson list; scoped student/flashcard metrics + completion %. |
| 2026-04-26 | Completion + audit UX | Student completion; richer analytics; teacher audit visibility. | `POST /api/student/lessons/[id]/complete`; lesson GET includes `progress`; student “Mark as studied”; `StudentLessonProgress` index `{ schoolId, completedAt }`; admin analytics `completionsInRange` / `distinctStudentsCompletedInRange`; `actorLabel` on admin audit API + UI; `GET /api/teacher/lessons/[id]/audit`; `TeacherLessonAuditPanel` on teacher lesson detail (`journalView`). |
| 2026-04-26 | Notify + audit UI | Email on publish; flashcards audit; admin log. | `LESSON_PUBLISHED_STUDENT` registry; Brevo queue in `lesson-publish-notifications.ts`; `flashcards_published` when cards exist; `GET /api/admin/lessons/audit-log`; `/admin/lessons/audit`; sidebar. |
| 2026-04-26 | Spec follow-up | Audit + engagement telemetry. | `LessonAuditLog` + `recordLessonAudit` (create/publish/unpublish/archive/update lesson; resource add/delete); `StudentLessonProgress` + `POST …/view`; student page beacon; admin analytics `studentLessons`; demo registry. |
| 2026-04-26 | 10 (UI) | Wire Leo on teacher lesson page. | `useLeoLessonDraftMutation`; `TeacherLessonLeoPanel` on `/teacher/lessons/[id]` (`journalWrite`); actions + JSON preview + copy. |
| 2026-04-26 | 10 | Leo draft APIs per spec §13.8. | `lessons-draft-shared.ts` (context, OpenAI, billing); `POST` `generate-summary`, `generate-flashcards`, `generate-practice-questions`, `suggest-activities`, `simplify-for-learners`, `generate-parent-summary`, `check-quality`; responses include `isDraft` + disclaimer; no auto-publish. |
| 2026-04-26 | 9 | Event-driven student notifications on publish. | `notifyStudentsOfPublishedLesson` → `Notification` (type `announcement`) for active class students with linked `userId`; dedupe per publish via `metadata.dedupeKey`; `PATCH /api/teacher/lessons/[id]` when `status: published`. |
| 2026-05-01 | 8 | Admin aggregates + range filter. | `admin-analytics.service.ts`; `GET /api/admin/lessons/analytics?from&to`; `useAdminLessonAnalytics`; admin page + `DateRangePicker`; Academics sidebar “Lesson analytics”. |
| 2026-05-01 | 7 | Post-lesson reflection on lesson instance. | `LessonReflection` model (unique school+lesson); `GET`/`PATCH /api/teacher/lessons/[id]/reflection`; `useTeacherLessonReflection` hooks; `TeacherLessonReflectionPanel` on lesson detail; `#lesson-reflection` link from Teaching Mode; demo registry. |
| 2026-05-01 | 6 | Teaching Mode route + persisted segments. | `ILessonTeachingMode` / `teachingMode` on `Lesson`; PATCH `teachingMode`; GET `?includeDisplayNote=1` + `lessonSnapshotToStudentDisplayNote`; `formatTeachingModeDto`; `TeachingModePage` + `/teacher/lessons/[id]/teach`; CTA on lesson detail; `useTeacherLesson` / invalidate variants. |
| 2026-05-01 | 5 | Lesson resources + library catalogue wiring. | `LessonResource` model; `GET/POST /api/teacher/lessons/[id]/resources`; `PATCH/DELETE /api/teacher/lesson-resources/[resourceId]`; `GET /api/student/lessons/[id]/resources`; hooks; `TeacherLessonResourcesPanel` (link + library search); `StudentLessonResourcesList`; publish copy; `DEMO_SCOPED_COLLECTIONS` entry. |
| 2026-04-26 | 4 | Wire flashcards MVP UI + deck race handling. | `StudentLessonFlashcardsStudy` on student lesson detail; `TeacherLessonFlashcardsPanel` on teacher detail; publish copy mentions flashcards; `getOrCreateLessonFlashcardDeck` handles concurrent create; `lesson.id` for API-backed lesson ids. |
| 2026-04-26 | 2 | Teacher UI for lessons. | Hooks, `/teacher/lessons`, sidebar, note links, publish confirm. |
| 2026-04-26 | 0–1 | Verification + model/APIs. | Phase 0 doc, `Lesson` model, teacher APIs. |

---

## Artifacts

| Artifact | Path |
|----------|------|
| Phase 0 verification | `docs/lessons/phase-0-lesson-notes-verification.md` |
| Phase 1 template scaffold | `docs/lessons/phase-1-template-resolver.md`; `src/lib/lesson-notes/template-variant-resolver.ts` |
| Publish snapshot helper | `src/lib/lessons/published-snapshot.ts` |
| Lesson model | `src/models/Lesson.ts` |
| Teacher lesson APIs | `src/app/api/teacher/lessons/route.ts`, `[id]/route.ts`, `analytics/route.ts`, **`bank/route.ts`** |
| Student lesson APIs | `src/app/api/student/lessons/route.ts` (list + **class progress** + **pagination** `limit`/`offset`), `[id]/route.ts`, `[id]/complete`, resources, flashcards |
| Teacher lesson UI | `src/app/(app)/teacher/lessons/page.tsx`, `[id]/page.tsx`, `analytics/page.tsx`, **`bank/page.tsx`** |
| Student lesson UI | `src/app/(app)/student/lessons/page.tsx`, `[id]/page.tsx` |
| Flashcards (MVP) | Models: `LessonFlashcardDeck`, `LessonFlashcard`, `StudentFlashcardProgress`; `src/lib/lessons/flashcard-deck.ts`; teacher APIs `[id]/flashcards`, `flashcards/[cardId]`; student APIs `lessons/[id]/flashcards`, `flashcards/[cardId]/progress`; `TeacherLessonFlashcardsPanel`, `StudentLessonFlashcardsStudy` |
| Admin lesson analytics | `src/lib/lessons/admin-analytics.service.ts`; `lesson-analytics-curriculum-coverage.ts`; `src/app/api/admin/lessons/analytics/route.ts`; `useAdminLessonAnalytics`; `src/app/(app)/admin/lessons/analytics/page.tsx` |
| Academic-head advanced reporting | `lessonTasks` + `collaboration` analytics blocks in `admin-analytics.service.ts`; rendered in `/admin/lessons/analytics` as “Lesson task outcomes” + “Collaboration health” |
| Admin analytics drill-down rankings | `lessonTasks.teacherRanking` + `lessonTasks.classRanking` + `collaboration.hotspots` in `admin-analytics.service.ts`; rendered as ranking/hotspot cards on `/admin/lessons/analytics` |
| Teacher lesson analytics | `src/lib/lessons/teacher-analytics.service.ts`; `lesson-analytics-curriculum-coverage.ts`; `GET /api/teacher/lessons/analytics`; `useTeacherLessonAnalytics`; `src/app/(app)/teacher/lessons/analytics/page.tsx`; teacher sidebar + list CTA |
| Publish → student notifications | `src/lib/email/registry.ts` (`LESSON_PUBLISHED_STUDENT`); `src/lib/lessons/lesson-publish-notifications.ts` (in-app + Brevo); hook in `src/app/api/teacher/lessons/[id]/route.ts` (publish + `flashcards_published` audit when cards exist) |
| Admin lesson audit browser | `src/types/lesson-audit.ts`; `GET /api/admin/lessons/audit-log` (optional `actorLabel` via `audit-actor-labels`); `useAdminLessonAuditLog`; `src/app/(app)/admin/lessons/audit/page.tsx`; sidebar “Lesson audit log” |
| Teacher lesson audit feed | `GET /api/teacher/lessons/[id]/audit`; `useTeacherLessonAudit`; `TeacherLessonAuditPanel`; `/teacher/lessons/[id]` |
| Student lesson completion | `POST /api/student/lessons/[id]/complete`; `useStudentLessonComplete`; student lesson GET `progress`; completions metrics in `admin-analytics.service` |
| Lesson audit + student progress | `src/models/LessonAuditLog.ts`; `src/lib/lessons/lesson-audit.ts` (domain log + **dual-write** to hash-chained `AuditEvent` on `school:<id>:lessons`); `src/models/StudentLessonProgress.ts`; lesson/resource audit hooks; `POST /api/student/lessons/[id]/view`; admin analytics `studentLessons`; student detail beacon |
| Leo lessons drafts (V2 API) | `src/lib/leo/lessons-draft-shared.ts`; `src/app/api/leo/lessons/generate-summary/route.ts`, `generate-flashcards`, `generate-practice-questions`, `suggest-activities`, `simplify-for-learners`, `generate-parent-summary`, `check-quality` |
| Leo differentiated materials | `POST /api/leo/lessons/generate-differentiated-materials`; `useLeoLessonDraft` `kind: "differentiate"`; `TeacherLessonLeoPanel` “Differentiate” action |
| Leo teacher UI (lesson detail) | `src/hooks/teacher/useLeoLessonDraft.ts`; `src/components/lessons/TeacherLessonLeoPanel.tsx`; `src/app/(app)/teacher/lessons/[id]/page.tsx` |
| Parent lesson summaries | School Features toggle → `lessonsModule.parentSummaryVisibleToParents`; `Lesson.parentSummaryHtml`; `/api/parent/wards/[id]/lessons`, `.../lessons/[lessonId]`; parent UI under ward; Leo panel save |
| School lesson bank | `GET /api/teacher/lessons/bank`; `/teacher/lessons/bank`; sidebar + my-lessons link |
| Lesson → studio prefill | `GET /api/teacher/lessons/[id]/assignment-seed`; assignment/quiz new pages accept `?lessonId=` seed; lesson detail CTA buttons |
| Teacher lesson collaboration | `Lesson.collaboratorTeacherIds`; `LessonCollaborationComment`; `src/lib/lessons/collaboration.ts`; `GET/POST /api/teacher/lessons/[id]/collaboration/comments`; `PATCH /api/teacher/lessons/[id]/collaboration/comments/[commentId]`; `TeacherLessonCollaborationPanel` |
| Completion % helper | `src/lib/lessons/completion-percent.ts`; `tests/lesson-completion-percent.test.ts`; wired in student list, teacher list/detail studied %, curriculum coverage |
