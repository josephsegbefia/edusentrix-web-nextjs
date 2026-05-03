# EduSentrix Lessons Module — Gap Filling & Completion Spec

**Document purpose:** This spec defines the remaining work required to bring the EduSentrix Lessons module fully in line with the agreed product direction and technical specification.

**Module principle:** Lessons must not become another Lesson Note module. Lesson Notes remain the teacher planning/source-of-truth layer. Lessons are the downstream learning experience layer built from Lesson Notes.

```txt
Lesson Note → Lesson → Student Content → Flashcards / Resources / Practice / Assignments / Analytics / Leo AI
```

---

## 1. Current State Summary

The existing Lessons module already has a strong foundation.

Implemented or partially implemented:

- Lessons are created from Lesson Notes.
- Teacher Lessons pages exist.
- Student Lessons pages exist.
- Parent lesson visibility exists in early form.
- Lesson resources exist.
- Flashcards exist.
- Student flashcard progress exists.
- Teaching Mode exists.
- Reflection exists.
- Assignment/quiz seed support exists.
- Leo lesson-generation endpoints exist.
- Lesson audit log exists.
- Admin lesson analytics/audit pages exist.
- UI generally follows EduSentrix premium dark/glass style.

Main issues to resolve:

- Permissions are too generic and reuse journal permissions.
- Publishing is not strongly guarded by Lesson Note approval rules.
- Lesson settings are too shallow.
- Resources do not support UploadThing/file uploads.
- Flashcard decks/cards are too limited.
- Leo output is too developer-like and lacks review/apply workflows.
- Student-facing content needs its own editable layer separate from the Lesson Note snapshot.
- Publish validation is too light.
- Teacher preview-as-student flow is missing.
- Audit logging does not cover enough actions.
- Analytics need expansion.
- UI needs tighter consistency across teacher, student, parent, and admin surfaces.

---

## 2. Non-Negotiable Product Rules

### 2.1 Lessons must remain downstream of Lesson Notes

Correct flow:

```txt
Lesson Note → Lesson → Published Student Learning Content
```

Incorrect flow:

```txt
Lesson created as a new independent Lesson Note clone
```

The Lessons module must never recreate the Lesson Note wizard or duplicate Lesson Note planning workflows.

### 2.2 Existing Lesson Note wizard must not be redesigned

Do not change the look, feel, step flow, or core experience of the existing Lesson Note wizard.

Lessons should consume Lesson Notes through:

- `lessonNoteId`
- Lesson Note status
- subject/class group/grade context
- scheme links where present
- structured note fields where available

### 2.3 Teacher controls what students see

Student-facing lesson content must be intentionally prepared and published.

The system must not expose full private teacher Lesson Notes to students by default.

### 2.4 Leo/AI must generate drafts, not publish directly

AI-generated content must always go through:

```txt
Generate → Preview → Teacher edits/reviews → Apply/Save → Publish
```

### 2.5 UI must match the EduSentrix premium experience

Use existing platform UI conventions:

- glassmorphism cards,
- dark premium surfaces,
- subtle gradients,
- consistent rounded corners,
- `Button`, `Card`, `Badge`, `ResponsiveModal`,
- `PremiumSelect` / `PremiumDropdown`,
- `CustomDatePicker` where dates are required,
- Sonner/busy toast pattern,
- empty states,
- skeleton/loading states,
- confirmation dialogs for destructive actions.

Raw HTML controls should be avoided unless wrapped in the platform's design system.

---

## 3. Target Architecture

### 3.1 Core relationships

```txt
LessonNote
  └── Lesson
        ├── LessonStudentContent
        ├── LessonResource[]
        ├── FlashcardDeck[]
        │     └── Flashcard[]
        ├── LessonReflection
        ├── TeachingMode
        ├── LessonAnalyticsEvent[]
        └── LessonAuditLog[]
```

### 3.2 Curriculum/Scheme inheritance

If the source Lesson Note has scheme links, the Lesson should inherit them.

```txt
Scheme Item → Lesson Note → Lesson
```

Lesson creation must copy or reference:

- `schemeId`
- `schemeItemIds`
- `subjectId`
- `classGroupId`
- `gradeId`
- `academicYearId` if available
- `termId` if available

---

## 4. Implementation Chunks

The work should be completed in manageable chunks. Engineers/AI agents should complete and test each chunk before moving to the next.

---

# Chunk 1 — Permissions Cleanup

## Goal

Replace generic journal permissions with dedicated Lessons permissions.

## Current issue

The module uses broad permissions such as:

```ts
PERMISSIONS.journalView
PERMISSIONS.journalWrite
```

This is semantically wrong because a user may be allowed to create Lesson Notes but not publish student-facing Lessons.

## Required permissions

Add dedicated permissions to the central permissions registry.

```ts
export const LESSON_PERMISSIONS = {
  lessonsRead: "lessons.read",
  lessonsCreate: "lessons.create",
  lessonsUpdate: "lessons.update",
  lessonsDelete: "lessons.delete",
  lessonsPublish: "lessons.publish",
  lessonsArchive: "lessons.archive",

  lessonStudentContentRead: "lessonStudentContent.read",
  lessonStudentContentManage: "lessonStudentContent.manage",

  lessonResourcesRead: "lessonResources.read",
  lessonResourcesManage: "lessonResources.manage",

  lessonFlashcardsRead: "lessonFlashcards.read",
  lessonFlashcardsManage: "lessonFlashcards.manage",
  lessonFlashcardsStudy: "lessonFlashcards.study",

  lessonReflectionsManage: "lessonReflections.manage",
  lessonTeachingModeManage: "lessonTeachingMode.manage",

  lessonAnalyticsView: "lessonAnalytics.view",
  lessonAiUse: "lessonAi.use",

  lessonCollaborationComment: "lessonCollaboration.comment",
  lessonCollaborationResolve: "lessonCollaboration.resolve",
  lessonCollaborationManage: "lessonCollaboration.manage",

  lessonAuditView: "lessonAudit.view",
};
```

## Role mapping

### Teacher

Default teacher permissions for assigned classes/subjects:

```txt
lessons.read
lessons.create
lessons.update
lessons.publish, if school allows teacher publishing
lessonStudentContent.manage
lessonResources.manage
lessonFlashcards.manage
lessonReflections.manage
lessonTeachingMode.manage
lessonAi.use, if enabled
```

### Academic Head

```txt
lessons.read
lessonAnalytics.view
lessonAudit.view
lessonCollaboration.manage
```

May also publish/approve depending on school policy.

### School Admin

Full Lessons module permissions.

### Student

```txt
lessons.read
lessonFlashcards.study
```

Only for published lessons assigned to their class/group.

### Parent

Read-only access to parent-visible lesson summaries and parent-visible resources.

## Required code changes

Search for usages of:

```ts
PERMISSIONS.journalView
PERMISSIONS.journalWrite
```

inside Lessons-related routes/components and replace them with the correct dedicated permission.

Affected areas likely include:

```txt
src/app/api/teacher/lessons/**
src/app/api/student/lessons/**
src/app/api/parent/wards/[id]/lessons/**
src/app/api/admin/lessons/**
src/components/lessons/**
```

## Acceptance criteria

- No Lessons route uses `journalView` or `journalWrite` as the primary permission gate.
- Publishing requires `lessons.publish`.
- Managing flashcards requires `lessonFlashcards.manage`.
- Managing resources requires `lessonResources.manage`.
- Viewing analytics requires `lessonAnalytics.view`.
- Using Leo lesson tools requires `lessonAi.use`.

---

# Chunk 2 — School-Level Lessons Settings

## Goal

Add proper school-level settings for Lessons behavior.

## Required model additions

Extend `SchoolSettings` or the relevant school configuration model.

```ts
type LessonsModuleSettings = {
  enabled: boolean;

  requireApprovedLessonNoteToPublish: boolean;
  allowTeacherPublishWithoutReview: boolean;

  enableStudentLessonView: boolean;
  enableFlashcards: boolean;
  enableResources: boolean;
  enableTeachingMode: boolean;
  enableLessonReflection: boolean;
  enableLessonAnalytics: boolean;

  parentSummaryVisibleToParents: boolean;

  enableLeoLessonTools: boolean;
  requireTeacherReviewForAiContent: boolean;

  notifyStudentsOnPublish: boolean;
  notifyParentsOnPublish: boolean;
};
```

## Default values

```ts
lessonsModule: {
  enabled: true,

  requireApprovedLessonNoteToPublish: false,
  allowTeacherPublishWithoutReview: true,

  enableStudentLessonView: true,
  enableFlashcards: true,
  enableResources: true,
  enableTeachingMode: true,
  enableLessonReflection: true,
  enableLessonAnalytics: true,

  parentSummaryVisibleToParents: false,

  enableLeoLessonTools: false,
  requireTeacherReviewForAiContent: true,

  notifyStudentsOnPublish: true,
  notifyParentsOnPublish: false,
}
```

## Behavior rules

- If `enabled === false`, Lessons routes should return `403` or hide module navigation.
- If `enableFlashcards === false`, hide flashcard UI and block flashcard APIs.
- If `enableResources === false`, hide resource UI and block resource APIs.
- If `enableLeoLessonTools === false`, hide Leo panels and block Leo endpoints.
- If `requireApprovedLessonNoteToPublish === true`, publishing must validate Lesson Note approval status.

## Acceptance criteria

- Lessons module behavior is controlled by settings.
- Disabled features do not appear in UI and cannot be accessed directly via API.
- Settings are school-scoped.

---

# Chunk 3 — Publish Validation & Lesson Note Approval Enforcement

## Goal

Prevent weak or accidental publishing.

## Current issue

Lessons can be created from Lesson Notes, but publishing does not strongly enforce approval rules.

## Required publish validation checklist

Before publishing, validate:

```txt
1. Lesson exists.
2. Lesson belongs to current school.
3. Source Lesson Note exists.
4. Source Lesson Note belongs to current school.
5. Lesson has subjectId, classGroupId, teacherId.
6. Lesson has student-facing content or a valid publishable snapshot.
7. If school requires approval, Lesson Note status must be approved.
8. If AI content is applied, it must be marked reviewed by teacher.
9. Parent summary must be sanitized before parent visibility.
10. Resources marked public must have valid safe URLs/files.
11. Flashcard decks marked published must contain at least one valid card.
```

## Add endpoint

```txt
POST /api/teacher/lessons/:lessonId/publish-checklist
```

Response:

```ts
type PublishChecklistResponse = {
  canPublish: boolean;
  items: Array<{
    key: string;
    label: string;
    status: "passed" | "warning" | "failed";
    message?: string;
  }>;
};
```

## Publish endpoint behavior

When a teacher clicks publish:

```txt
Run checklist → show blockers/warnings → allow publish only if no failed checks
```

## Approval rule

If:

```ts
settings.lessonsModule.requireApprovedLessonNoteToPublish === true
```

then:

```ts
if (sourceLessonNote.status !== "approved") {
  throw 403;
}
```

## Acceptance criteria

- Lesson publishing cannot bypass approval if school requires approved Lesson Notes.
- UI shows publish blockers clearly.
- API returns meaningful validation errors.
- Publish flow creates audit log entries.

---

# Chunk 4 — Student-Facing Lesson Content Layer

## Goal

Create an editable student-facing content layer separate from the raw Lesson Note snapshot.

## Current issue

The current `publishedSnapshot` is useful but not enough. Teachers need to control and edit what students see.

## Required model addition

Add to `Lesson` or create a separate `LessonStudentContent` model.

Recommended embedded model for V1:

```ts
type LessonStudentContent = {
  summaryHtml?: string;
  keyPoints: string[];
  vocabulary: Array<{
    term: string;
    definition: string;
  }>;
  studentInstructions?: string;
  practicePrompt?: string;
  estimatedReadingMinutes?: number;
  lastEditedBy?: ObjectId;
  lastEditedAt?: Date;
  aiGenerated?: boolean;
  teacherReviewed?: boolean;
};
```

Add to `Lesson`:

```ts
studentContent?: LessonStudentContent;
```

## Required API

```txt
GET   /api/teacher/lessons/:lessonId/student-content
PATCH /api/teacher/lessons/:lessonId/student-content
```

## Required UI

Add a Student Content section/tab to teacher lesson detail.

Fields:

- student summary,
- key points,
- vocabulary,
- student instructions,
- practice prompt,
- estimated reading time,
- teacher-reviewed toggle if AI content was used.

Actions:

```txt
Generate with Leo
Edit manually
Preview as student
Save draft
Publish lesson
```

## Rendering rule

Student view should render:

```txt
studentContent if present
else publishedSnapshot fallback
```

## Acceptance criteria

- Teacher can edit student-facing lesson content without editing the original Lesson Note.
- Student view does not expose private teacher planning fields by default.
- AI-generated content must be teacher-reviewed before publishing if setting requires it.

---

# Chunk 5 — Preview as Student

## Goal

Allow teachers to see exactly what students will see before publishing.

## Required UI

Add button on teacher lesson detail:

```txt
Preview as student
```

Options:

- route: `/teacher/lessons/[id]/preview`
- or `ResponsiveModal` preview

The preview should show:

- lesson title,
- subject,
- class group,
- student summary,
- key points,
- vocabulary,
- visible resources,
- visible flashcard decks,
- practice prompt.

It should not show:

- teacher-only resources,
- internal Lesson Note planning fields,
- reviewer/admin comments,
- draft AI output not applied.

## Acceptance criteria

- Teacher can preview unpublished draft lessons.
- Preview uses the same visual language as the student lesson view.
- Preview clearly displays a badge: `Teacher Preview`.

---

# Chunk 6 — UploadThing Lesson Resources

## Goal

Expand resources beyond external links/library books to support file uploads.

## Current issue

Resource kind currently supports only:

```ts
"link" | "library_book"
```

## Required model changes

```ts
type LessonResourceKind = "file" | "link" | "library_book";

type LessonResourceFileType =
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "slide"
  | "other";
```

Add fields:

```ts
fileUrl?: string;
uploadThingKey?: string;
fileName?: string;
fileSizeBytes?: number;
mimeType?: string;
fileType?: LessonResourceFileType;
```

Update visibility:

```ts
type LessonResourceVisibility =
  | "teacher_only"
  | "students"
  | "parents_only"
  | "students_and_parents";
```

## UploadThing requirements

Implement or reuse existing UploadThing route/config.

Allowed files:

```txt
PDF
images
videos
audio
documents
slides
```

Apply school storage limits if available.

## Required UI

Update `TeacherLessonResourcesPanel`:

- drag-and-drop upload,
- upload progress,
- file preview,
- resource title,
- resource description,
- visibility selector using `PremiumSelect`,
- resource type badge,
- delete confirmation,
- teacher-only badge where applicable.

## Required API

Existing resource create route should accept both link and file payloads.

Add/update:

```txt
POST   /api/teacher/lessons/:lessonId/resources
PATCH  /api/teacher/lesson-resources/:resourceId
DELETE /api/teacher/lesson-resources/:resourceId
POST   /api/teacher/lessons/:lessonId/resources/reorder
```

## URL safety

For external links:

- allow only `https://` by default,
- reject `javascript:` URLs,
- reject unsafe `data:` URLs,
- trim and normalize links.

## Acceptance criteria

- Teacher can upload a PDF worksheet to a lesson.
- Teacher can mark resource as students-only, parents-only, students-and-parents, or teacher-only.
- Students only see resources visible to students.
- Parents only see resources visible to parents.
- File uploads use UploadThing and do not break existing link resources.

---

# Chunk 7 — Flashcard Deck & Card Expansion

## Goal

Make flashcards production-quality and closer to the spec.

## Current issue

Only one deck per lesson is allowed and cards only have front/back/order.

## Required `LessonFlashcardDeck` changes

```ts
type LessonFlashcardDeck = {
  schoolId: ObjectId;
  lessonId: ObjectId;
  teacherId: ObjectId;

  title: string;
  description?: string;

  status: "draft" | "published" | "archived";

  publishToClassGroupIds: ObjectId[];

  availableFrom?: Date;
  availableUntil?: Date;

  createdAt: Date;
  updatedAt: Date;
};
```

## Important migration decision

Current unique index likely enforces one deck per lesson:

```txt
{ schoolId: 1, lessonId: 1 }, unique: true
```

For full implementation, remove this unique constraint and allow multiple decks per lesson.

Temporary V1 option:

- keep one default deck per lesson,
- add status/description/availability fields,
- remove unique constraint in a later migration.

Recommended final state: multiple decks per lesson.

## Required `LessonFlashcard` changes

```ts
type LessonFlashcard = {
  schoolId: ObjectId;
  deckId: ObjectId;

  front: string;
  back: string;
  hint?: string;
  explanation?: string;
  imageUrl?: string;

  difficulty?: "easy" | "medium" | "hard";
  cardType?: "qa" | "term_definition" | "image_prompt" | "concept_example";

  order: number;

  createdAt: Date;
  updatedAt: Date;
};
```

## Required API

```txt
GET    /api/teacher/lessons/:lessonId/flashcard-decks
POST   /api/teacher/lessons/:lessonId/flashcard-decks
PATCH  /api/teacher/flashcard-decks/:deckId
POST   /api/teacher/flashcard-decks/:deckId/publish
POST   /api/teacher/flashcard-decks/:deckId/archive

GET    /api/teacher/flashcard-decks/:deckId/cards
POST   /api/teacher/flashcard-decks/:deckId/cards
POST   /api/teacher/flashcard-decks/:deckId/cards/bulk
PATCH  /api/teacher/flashcards/:cardId
DELETE /api/teacher/flashcards/:cardId
POST   /api/teacher/flashcard-decks/:deckId/cards/reorder
```

## Required UI

Update `TeacherLessonFlashcardsPanel`:

- deck list,
- deck status badges,
- create/edit deck modal,
- availability dates using `CustomDatePicker`,
- card editor with front/back/hint/explanation,
- card type selector using `PremiumSelect`,
- difficulty selector using `PremiumSelect`,
- optional image upload,
- reorder cards,
- publish deck confirmation.

## Student flashcard UX

Improve study view:

- flip animation,
- progress indicator,
- “I know this” button,
- “Review again” button,
- session summary,
- filter by needs review,
- review mode.

## Acceptance criteria

- Teacher can create a deck, add cards, publish it, and students can study it.
- Cards can contain hints/explanations.
- Deck availability dates work.
- Student progress updates correctly.

---

# Chunk 8 — Leo AI Review & Apply Workflow

## Goal

Make Leo outputs teacher-friendly and directly usable.

## Current issue

Leo output appears too JSON/developer-like and lacks polished review/apply workflows.

## Required Leo tools UX

For each AI tool, output should be shown in a polished preview, not raw JSON.

### Generate Summary

Output:

- student summary preview,
- key points,
- vocabulary if available.

Actions:

```txt
Apply to Student Content
Edit
Discard
Copy
```

### Generate Flashcards

Output:

- editable flashcard cards/table,
- select/deselect cards,
- edit front/back/hint/explanation.

Actions:

```txt
Add selected to deck
Create new deck from selected
Discard
```

### Generate Practice Questions

Output:

- question list,
- answer guide if available,
- difficulty labels.

Actions:

```txt
Create assignment draft
Create quiz draft
Copy
Discard
```

### Parent Summary

Output:

- parent-friendly summary preview,
- home support suggestions,
- conversation starters.

Actions:

```txt
Save Parent Summary
Make visible to parents
Discard
```

### Quality Check

Output:

- quality score,
- missing items,
- suggestions,
- warnings.

Actions:

```txt
Apply suggestions manually
Copy report
```

## Required endpoints

Existing Leo endpoints may remain, but add apply endpoints:

```txt
POST /api/teacher/lessons/:lessonId/apply-ai-draft
POST /api/teacher/lessons/:lessonId/flashcards/bulk
POST /api/teacher/lessons/:lessonId/create-assignment-from-ai
POST /api/teacher/lessons/:lessonId/save-parent-summary
```

## AI content tracking

When AI content is applied, track:

```ts
aiGenerated: true;
teacherReviewed: boolean;
aiTool: string;
aiGeneratedAt: Date;
aiAppliedBy: ObjectId;
```

## Acceptance criteria

- Teacher never has to copy/paste raw JSON from Leo output.
- AI flashcards can be reviewed and inserted into a deck.
- AI summaries can be applied to student content.
- AI parent summaries can be saved and optionally made visible.
- AI usage is permission-gated and settings-gated.

---

# Chunk 9 — Teaching Mode Completion

## Goal

Make Teaching Mode useful and optionally generated from Lesson Note phases.

## Current state

Teaching Mode exists but should be improved.

## Required model

```ts
type LessonTeachingMode = {
  enabled: boolean;
  segments: Array<{
    title: string;
    durationMinutes?: number;
    teacherPrompt?: string;
    learnerActivity?: string;
    resources?: string[];
    order: number;
  }>;
  generatedFromLessonNote?: boolean;
  lastEditedBy?: ObjectId;
  lastEditedAt?: Date;
};
```

## Required feature

Add action:

```txt
Generate Teaching Mode from Lesson Note
```

Mapping example:

```txt
Lesson Note Introduction → Teaching Mode Starter
Main Content / Teacher Activities → Teaching Mode Main Activity
Learner Activities → Teaching Mode Learner Activity
Assessment Questions → Teaching Mode Quick Check
Conclusion / Reflection → Teaching Mode Wrap-up
```

## Required UI

Teaching Mode editor:

- editable segment list,
- duration field,
- reorder segments,
- teacher prompt,
- learner activity,
- linked resources,
- fullscreen teaching mode.

## Acceptance criteria

- Teacher can generate and edit teaching segments from Lesson Note content.
- Teaching Mode can be opened full-screen.
- Teaching Mode does not expose internal review comments.

---

# Chunk 10 — Lesson Reflection Enhancement

## Goal

Complete reflection workflow and connect it to analytics.

## Required fields

```ts
type LessonReflection = {
  lessonId: ObjectId;
  schoolId: ObjectId;
  teacherId: ObjectId;

  completed: boolean;
  objectivesMet: "yes" | "partially" | "no";
  notes?: string;
  studentsWhoStruggled?: ObjectId[];
  followUpRequired?: boolean;
  followUpNotes?: string;
  retakeRecommended?: boolean;

  createdAt: Date;
  updatedAt: Date;
};
```

## Required UI

Teacher reflection card:

- completed toggle,
- objectives met selector,
- notes,
- struggling students selector,
- follow-up required toggle,
- follow-up notes,
- save toast.

Use `PremiumSelect` for selectors.

## Acceptance criteria

- Teacher can record lesson reflection.
- Academic head/admin can view reflection summaries if permitted.
- Reflection save creates audit log.

---

# Chunk 11 — Lesson Analytics Event Stream

## Goal

Track meaningful engagement, not just completion.

## Required model

Create or extend analytics model:

```ts
type LessonAnalyticsEvent = {
  schoolId: ObjectId;
  lessonId: ObjectId;

  actorType: "student" | "teacher" | "parent";
  actorId: ObjectId;

  eventType:
    | "lesson_opened"
    | "lesson_completed"
    | "resource_opened"
    | "flashcard_deck_opened"
    | "flashcard_reviewed"
    | "assignment_started_from_lesson"
    | "quiz_started_from_lesson"
    | "parent_summary_viewed";

  metadata?: Record<string, unknown>;
  createdAt: Date;
};
```

## Required events

Track:

- student opens lesson,
- student completes lesson,
- resource opened,
- flashcard reviewed,
- deck completed,
- parent views lesson summary,
- teacher opens teaching mode.

## Required admin analytics

Expand admin analytics to include:

```txt
Lessons published by teacher
Lessons published by class group
Lessons published by subject
Student completion by class
Flashcard engagement
Resource engagement
Parent summary views
Teachers with low lesson publishing
Classes with low lesson engagement
```

## Required API

```txt
GET /api/admin/lessons/analytics/overview
GET /api/admin/lessons/analytics/by-teacher
GET /api/admin/lessons/analytics/by-class
GET /api/admin/lessons/analytics/by-subject
GET /api/admin/lessons/analytics/flashcards
GET /api/admin/lessons/analytics/resources
```

## Acceptance criteria

- Admin can see meaningful lesson engagement, not only counts.
- Analytics are school-scoped.
- Analytics respect permissions.

---

# Chunk 12 — Parent Lesson Experience

## Goal

Make parent lesson visibility useful but controlled.

## Required parent view

Parents should see only content explicitly visible to parents.

Parent lesson card should show:

- child name,
- lesson title,
- subject,
- teacher,
- published date,
- short parent summary,
- how to help at home,
- conversation starters,
- parent-visible resources.

Parent should not see:

- full Lesson Note,
- teacher-only resources,
- internal reflection,
- review comments,
- draft AI content.

## Required model field

Add or expand:

```ts
parentContent?: {
  summaryHtml?: string;
  howToHelpAtHome?: string[];
  conversationStarters?: string[];
  visible: boolean;
  aiGenerated?: boolean;
  teacherReviewed?: boolean;
};
```

## Required UI

Teacher side:

- Parent Summary panel,
- generate with Leo,
- edit manually,
- visibility toggle,
- preview as parent.

Parent side:

- clean parent lesson summary page,
- child filter if parent has multiple wards.

## Acceptance criteria

- Parent content is opt-in.
- Parent sees only reviewed/visible content.
- Parent summary visibility obeys school settings.

---

# Chunk 13 — Collaboration Completion

## Goal

Complete collaboration feature if it remains in the module.

## Required permissions

```txt
lessonCollaboration.comment
lessonCollaboration.resolve
lessonCollaboration.manage
```

## Required features

- add comment,
- resolve comment,
- reopen comment,
- mention teacher/admin later,
- audit actions.

## Required model additions

For collaboration comments:

```ts
status: "open" | "resolved";
resolvedBy?: ObjectId;
resolvedAt?: Date;
```

## Acceptance criteria

- Collaboration is permission-gated.
- Resolved comments are visually distinct.
- Comments do not appear to students or parents.

---

# Chunk 14 — Audit Logging Expansion

## Goal

Improve traceability.

## Required audit actions

Expand `LessonAuditAction` to include:

```txt
lesson_created_from_note
lesson_updated
lesson_deleted
lesson_published
lesson_unpublished
lesson_archived
student_content_updated
parent_summary_saved
parent_summary_visibility_changed
resource_added
resource_updated
resource_deleted
resources_reordered
flashcard_deck_created
flashcard_deck_updated
flashcard_deck_published
flashcard_deck_archived
flashcard_added
flashcard_updated
flashcard_deleted
flashcards_reordered
reflection_saved
teaching_mode_updated
teaching_mode_generated
collaborator_added
collaborator_removed
comment_added
comment_resolved
ai_draft_generated
ai_draft_applied
```

## Required helper

Create a consistent helper:

```ts
await logLessonAudit({
  schoolId,
  lessonId,
  actorId,
  action,
  metadata,
});
```

## Acceptance criteria

- All major teacher/admin actions generate audit logs.
- Admin audit page can filter by action, teacher, lesson, date range.
- Audit logs do not expose private student data unnecessarily.

---

# Chunk 15 — UI Consistency & Premium Polish

## Goal

Make all Lessons module surfaces feel like one premium product.

## Required shared components

Create/reuse:

```txt
LessonGlassCard
LessonPageHeader
LessonStatusBadge
LessonMetricCard
LessonEmptyState
LessonSectionTabs
LessonVisibilityBadge
LessonResourceCard
LessonFlashcardPreview
LessonPublishChecklist
```

## Teacher UI requirements

Teacher pages should use:

- glass cards,
- consistent page headers,
- `PremiumSelect`,
- `PremiumDropdown`,
- `CustomDatePicker`,
- `ResponsiveModal`,
- Sonner/busy toast,
- confirmation dialogs.

## Student UI requirements

Student pages should align with teacher/admin style.

Avoid inconsistent one-off style systems such as mixing too many `slate-*` classes if platform standard uses `white/opacity` tokens.

Student views should feel simpler but still premium.

## Parent UI requirements

Parent lesson summaries should be calm, readable, and non-technical.

## Admin UI requirements

Admin pages should include:

```txt
Overview
Published Lessons
Teacher Activity
Class Engagement
Flashcard Engagement
Resources
Audit Log
```

## Known UI fix

Remove duplicate text in Teaching Mode button if present:

```txt
Teaching Mode Teaching Mode
```

## Acceptance criteria

- Lessons UI visually matches the broader EduSentrix platform.
- No raw unstyled select/date controls in new work.
- Empty/loading/error states are polished.
- Mobile/responsive layouts are usable.

---

# Chunk 16 — Create Lesson from Lesson Note UX Improvement

## Goal

Make the creation flow clearly communicate that Lessons come from Lesson Notes.

## Required UI

Improve creation modal/page.

Suggested flow:

```txt
Step 1: Choose Lesson Note
Step 2: Review source context
Step 3: Set lesson title/schedule
Step 4: Create draft Lesson
```

Show source context:

- Lesson Note title/topic,
- subject,
- class group,
- grade,
- teacher,
- status,
- scheme item if linked,
- last updated date.

Use `CustomDatePicker` for scheduled date if present.

## Eligibility rules

Show warnings if:

- Lesson Note is draft,
- Lesson Note needs revision,
- school requires approval before publishing,
- Lesson already exists for the selected Lesson Note.

## Acceptance criteria

- Teacher understands they are creating a Lesson from a Lesson Note.
- Duplicate Lesson creation from same Lesson Note is prevented or clearly handled.
- Source Lesson Note status is visible.

---

# Chunk 17 — Reorder Endpoints

## Goal

Support clean ordering for resources and flashcards.

## Required endpoints

```txt
POST /api/teacher/lessons/:lessonId/resources/reorder
POST /api/teacher/flashcard-decks/:deckId/cards/reorder
```

Payload:

```ts
{
  ids: string[];
}
```

Behavior:

- validate all IDs belong to the school,
- validate all IDs belong to the lesson/deck,
- update `order` sequentially,
- create audit log.

## Acceptance criteria

- Teacher can reorder flashcards.
- Teacher can reorder resources.
- Student view respects ordering.

---

# Chunk 18 — Security & Sanitization

## Goal

Protect student/parent-facing content.

## Required rules

### HTML sanitization

Sanitize:

- student summaries,
- parent summaries,
- AI-generated HTML,
- Lesson Note snapshot rendering if HTML exists.

Use a shared sanitizer.

### URL safety

External resource URLs must:

- use `https://`,
- reject `javascript:`,
- reject unsafe `data:`,
- trim whitespace,
- optionally validate domain formatting.

### Access checks

Student:

- can view only published lessons for their class/group.

Parent:

- can view only lessons for their ward,
- only if parent visibility is enabled,
- only parent-visible content/resources.

Teacher:

- can manage only their own lessons or lessons for assigned classes/subjects unless admin.

Admin:

- school-scoped only.

## Acceptance criteria

- Private teacher content never leaks to students/parents.
- Unsafe URLs are rejected.
- HTML is sanitized before rendering.

---

# Chunk 19 — Testing Requirements

## Required tests

### Backend tests

Cover:

- create lesson from Lesson Note,
- prevent publish when source Lesson Note approval is required but missing,
- publish checklist,
- student content update,
- resource upload/create,
- resource visibility filtering,
- flashcard deck/card CRUD,
- flashcard progress,
- parent visibility rules,
- permissions,
- audit logs.

### UI tests/manual QA

Scenarios:

```txt
Teacher creates Lesson from approved Lesson Note
Teacher creates Lesson from draft Lesson Note and publish is blocked
Teacher edits student-facing content
Teacher previews as student
Teacher uploads PDF resource
Teacher creates flashcards manually
Teacher uses Leo to generate flashcards and applies selected cards
Student views lesson
Student studies flashcards
Parent views parent summary
Admin views analytics
Admin views audit log
```

## Acceptance criteria

- No major Lesson flow is untested.
- Manual QA confirms UI consistency across roles.

---

## 5. Final Completion Checklist

The Lessons module is considered complete when all the following are true:

```txt
[ ] Lessons use dedicated permissions, not journal permissions.
[ ] School-level Lessons settings exist and are respected.
[ ] Publishing has a validation checklist.
[ ] Publishing can require approved Lesson Notes.
[ ] Teachers can edit student-facing lesson content separately from Lesson Notes.
[ ] Teachers can preview lessons as students.
[ ] UploadThing/file resources are supported.
[ ] Resource visibility works for teacher/students/parents.
[ ] Flashcard decks support status, availability, richer cards, and progress.
[ ] AI-generated content has polished review/apply workflows.
[ ] Teaching Mode can be generated from Lesson Notes and edited.
[ ] Reflection is complete and auditable.
[ ] Lesson analytics track meaningful events.
[ ] Parent lesson summaries are controlled and useful.
[ ] Collaboration is permission-gated and auditable.
[ ] Audit logging covers all major actions.
[ ] UI uses EduSentrix premium components and style consistently.
[ ] Security and sanitization rules are enforced.
[ ] Backend and manual QA tests cover the core flows.
```

---

## 6. Recommended Implementation Order

Use this order to reduce risk:

```txt
1. Permissions cleanup
2. School-level Lessons settings
3. Publish checklist + approval enforcement
4. Student-facing content layer
5. Preview as student
6. UploadThing resources
7. Flashcard model/workflow expansion
8. Leo review/apply workflows
9. Teaching Mode generation
10. Reflection enhancement
11. Analytics event stream
12. Parent lesson experience
13. Collaboration completion
14. Audit logging expansion
15. UI consistency polish
16. Reorder endpoints
17. Security/sanitization hardening
18. Testing and QA
```

---

## 7. Strategic Product Outcome

After this work, the Lessons module should feel like a true learning platform layer inside EduSentrix.

It should allow teachers to:

```txt
Create Lesson Notes once
Turn them into student-ready Lessons
Generate flashcards and practice activities
Attach resources
Teach from Teaching Mode
Reflect after teaching
Track engagement
Use Leo safely and productively
```

It should allow students to:

```txt
View published lessons
Study resources
Practice with flashcards
Track progress
```

It should allow parents to:

```txt
Understand what their child is learning
Access parent-visible resources
Support learning at home
```

It should allow school leaders to:

```txt
See lesson publishing activity
Monitor teacher engagement
Track class/student learning engagement
Review audit logs
Connect lessons to broader curriculum coverage
```

The final module should reinforce the core EduSentrix academic architecture:

```txt
Curriculum & Scheme of Work
→ Lesson Notes
→ Lessons
→ Flashcards / Resources / Assignments / Analytics / Leo AI
```
