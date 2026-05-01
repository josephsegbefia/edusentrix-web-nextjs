# EduSentrix Lessons Module Technical Specification

**Version:** 1.0  
**Product:** EduSentrix Web App  
**Module:** Lessons  
**Status:** Developer-ready specification  
**Primary Goal:** Build a Lessons module that uses the existing Lesson Note module as its foundation, without duplicating or replacing it.

**Implementation sequencing:** See the buildable slices, MVP cut line, and UI guardrails in [edusentrix-lessons-module-implementation-plan.md](./edusentrix-lessons-module-implementation-plan.md). **Current slice / session log:** [docs/lessons/PROGRESS.md](./lessons/PROGRESS.md).

---

## 1. Executive Summary

EduSentrix already has a **Lesson Note module**. The new **Lessons module** must not become another lesson-note editor or clone. Instead, it should become the learning experience layer that sits on top of Lesson Notes.

The key product model is:

```txt
Lesson Notes = teacher planning and academic documentation
Lessons = classroom delivery, student learning, revision, resources, flashcards, assignments, analytics, and Leo-powered support
```

A teacher should create a Lesson Note as usual. From that Lesson Note, EduSentrix should allow the teacher to create a student-facing Lesson, add flashcards, attach resources, generate practice activities, publish learning materials to students, and later use Leo AI to assist with conversion, summaries, quizzes, and revision support.

This specification requires engineers or AI agents to first verify the existing Lesson Note module before implementing the Lessons module.

---

## 2. Critical Product Rule

The Lessons module must **not** replace, duplicate, redesign, or visually disrupt the existing Lesson Note module.

The current Lesson Note wizard must remain the source-of-truth planning tool.

### Mandatory rules

1. Do not rebuild the Lesson Note module.
2. Do not change the existing Lesson Note wizard look and feel.
3. Do not make teachers manually choose unnecessary curriculum/template variants.
4. Continue using the current automatic subject, class group, and grade context.
5. Build Lessons as a downstream layer created from Lesson Notes.
6. Lesson Notes should remain private/internal by default.
7. Lessons should be publishable student-facing learning units.
8. Leo/AI-generated content must always be reviewed by the teacher before publishing.

---

## 3. Existing Lesson Note Module Assumptions

Before development begins, engineers must verify the actual current implementation.

The current Lesson Note module reportedly:

- Automatically knows the subject for which the lesson note is being created.
- Automatically knows the class group.
- Can infer the grade from the class group.
- Supports NaCCA 3-phase lesson note.
- Supports classic lesson note.
- Uses a wizard-style UI.
- Has a look and feel that must not be changed.

The current module does not yet have:

- Primary-specific lesson note variant.
- JHS-specific lesson note variant.
- Preschool activity plan.
- Early Years / KG activity plan.

---

## 4. Required Pre-Implementation Verification

Before implementing the Lessons module, the engineer or AI agent must inspect and document the current Lesson Note implementation.

### Verify these files and structures

The engineer must locate and understand:

- Lesson Note models/schemas.
- Lesson Note API routes/server actions/controllers.
- Lesson Note wizard component.
- Lesson Note form state management.
- Lesson Note validation schemas.
- Lesson Note template configuration.
- Lesson Note status workflow.
- Lesson Note permissions.
- Lesson Note links to teacher, subject, class group, grade, academic year, and term.
- How class group maps to grade/level.
- How the current wizard determines template type.
- Whether Lesson Notes are structured field-based documents or stored as rich/plain content.
- Whether Lesson Notes already support approval/review flow.
- Whether Lesson Notes support attachments/resources.
- Whether Lesson Notes are visible to students or only teachers/admins.

### Mandatory verification output

Before coding Lessons, produce a short internal implementation note answering:

```txt
1. Where are Lesson Notes stored?
2. What fields exist on the Lesson Note model?
3. What templates exist today?
4. What statuses exist today?
5. How does the wizard infer subject/class/grade?
6. Can a Lesson Note be uniquely referenced by ID?
7. Can a Lesson be safely generated from a Lesson Note?
8. What fields from Lesson Note should map into Lesson?
9. What must not be touched in the Lesson Note wizard?
```

---

## 5. Curriculum and Template Strategy

EduSentrix should support schools that run the Ghana NaCCA curriculum while remaining flexible for other curricula.

### 5.1 NaCCA Primary and JHS lesson notes

For NaCCA-based schools, Primary and JHS lesson notes are not fundamentally different in structure. They generally follow the same standards-based planning approach and can use the same **NaCCA 3-phase lesson note** structure.

The difference is mostly in:

- learner age,
- pedagogy,
- activity style,
- assessment depth,
- examples,
- optional fields,
- helper text,
- teaching resources,
- learner independence.

Therefore, EduSentrix should not create completely separate Primary and JHS templates unless a school later defines custom templates.

Instead, use:

```txt
NaCCA 3-Phase Lesson Note
  ├── Primary variant
  └── JHS variant
```

### 5.2 Early Years / Preschool lesson planning

Preschool, Creche, Nursery, KG1, and KG2 should not be forced into the same formal lesson note experience used for Primary and JHS.

They should use an **Early Years Activity Plan** structure because early years learning is more:

- play-based,
- thematic,
- integrated,
- activity-driven,
- observation-based,
- routine-aware.

Use:

```txt
Early Years Activity Plan
  ├── Creche variant
  ├── Nursery variant
  ├── KG1 variant
  └── KG2 variant
```

### 5.3 Template architecture

Recommended template types:

```ts
type LessonNoteTemplateType =
  | "nacca_3_phase"
  | "classic"
  | "early_years_activity_plan"
  | "custom";
```

Recommended level variants:

```ts
type LessonNoteLevelVariant =
  | "creche"
  | "nursery"
  | "kg1"
  | "kg2"
  | "primary"
  | "jhs"
  | "other";
```

Recommended education levels:

```ts
type EducationLevel =
  | "early_years"
  | "primary"
  | "jhs"
  | "shs"
  | "other";
```

---

## 6. Automatic Preset Resolution

The system already knows subject, class group, and grade when creating a Lesson Note. This must continue.

The system should automatically resolve:

- template type,
- level variant,
- labels,
- hints,
- examples,
- optional fields,
- required fields,
- validation rules,
- AI prompt context later.

Teachers should not have to manually choose these unless the school enables custom override.

### Example resolver signature

```ts
type ResolveLessonNoteWizardConfigInput = {
  schoolId: string;
  teacherId: string;
  subjectId: string;
  classGroupId: string;
  gradeId?: string;
  curriculumType?: "nacca" | "cambridge" | "montessori" | "custom";
};

function resolveLessonNoteWizardConfig(
  input: ResolveLessonNoteWizardConfigInput
): LessonNoteWizardConfig;
```

### Example config shape

```ts
type LessonNoteWizardConfig = {
  templateType: LessonNoteTemplateType;
  levelVariant: LessonNoteLevelVariant;
  educationLevel: EducationLevel;
  labels: Record<string, string>;
  hints: Record<string, string>;
  examples: Record<string, string>;
  optionalFields: string[];
  requiredFields: string[];
  validationRules: Record<string, unknown>;
};
```

### Example automatic mapping

If class group is `JHS 1 Gold` and subject is `Integrated Science`:

```txt
Template: NaCCA 3-Phase
Variant: JHS
Hints: experiment, investigation, misconceptions, application questions
Optional fields: practical activity, exam-style question, misconception notes
```

If class group is `Basic 2` and subject is `Mathematics`:

```txt
Template: NaCCA 3-Phase
Variant: Primary
Hints: concrete materials, oral participation, guided practice, group work
Optional fields: manipulatives, picture-based activity, learner support notes
```

If class group is `KG1` and learning area is `Numeracy`:

```txt
Template: Early Years Activity Plan
Variant: KG1
Hints: play-based learning, songs, concrete objects, observation, movement
Optional fields: circle time, guided play, observation notes, care routines
```

---

## 7. Lesson Note Template Field Recommendations

These are recommendations for enhancing the existing Lesson Note module without changing its look and feel.

Enhancements should be additive and configuration-driven.

### 7.1 NaCCA 3-phase base fields

For Primary and JHS:

```txt
Basic Information
- Subject
- Class group
- Grade
- Academic year
- Term
- Week
- Date
- Duration
- Strand
- Sub-strand
- Content standard
- Indicator
- Performance indicator
- Core competencies
- Keywords / vocabulary
- Teaching and learning resources
- References

Phase 1: Starter / Introduction
- Previous knowledge
- Starter activity
- Lesson introduction

Phase 2: Main Activity
- Main lesson content
- Teacher activities
- Learner activities
- Guided practice
- Differentiation / support

Phase 3: Reflection / Assessment
- Assessment questions
- Lesson summary
- Learner reflection
- Teacher reflection
- Homework / extended activity
```

### 7.2 Primary variant hints and optional fields

Primary lessons should emphasize:

- visual aids,
- songs/rhymes where relevant,
- concrete examples,
- manipulatives,
- oral participation,
- guided practice,
- group work,
- shorter written work.

Optional fields:

```txt
- Phonics / vocabulary focus
- Manipulatives / concrete materials
- Picture-based activity
- Oral response activity
- Group activity
- Learner support notes
```

### 7.3 JHS variant hints and optional fields

JHS lessons should emphasize:

- independent learning,
- subject-specific vocabulary,
- application questions,
- experiments/investigation,
- debates/discussion,
- problem-solving,
- exam readiness.

Optional fields:

```txt
- Concept explanation
- Experiment / practical activity
- Application task
- Critical thinking question
- Exam-style question
- Misconceptions to address
- Extended learning
```

### 7.4 Early Years Activity Plan fields

For Creche, Nursery, KG1, and KG2:

```txt
Basic Information
- Class level
- Theme
- Sub-theme
- Learning area
- Activity title
- Duration
- Age group
- Date

Learning Intention
- What children will experience
- Skills to develop
- Vocabulary / language focus

Materials
- Songs
- Story books
- Flashcards
- Objects
- Toys
- Art materials

Activity Flow
- Arrival / settling activity
- Circle time
- Starter song / rhyme
- Main activity
- Guided play
- Outdoor / movement activity
- Story / recap

Observation / Assessment
- What teacher should observe
- Children who need support
- Children who exceeded expectations

Care Routines
- Snack
- Toilet routine
- Rest
- Hygiene
- Safety notes
```

---

## 8. Lessons Module Product Definition

The Lessons module converts planning content into learning experiences.

A Lesson is a student-facing or classroom-facing learning unit derived from a Lesson Note.

### Core flow

```txt
Teacher creates Lesson Note
↓
Lesson Note is saved as planning source
↓
Optional approval/review happens in Lesson Note module
↓
Teacher clicks “Create Lesson from Note”
↓
EduSentrix creates Lesson draft
↓
Teacher edits student-facing content
↓
Teacher adds flashcards/resources/practice
↓
Teacher publishes Lesson to students
↓
Students study lesson and flashcards
↓
Teacher/admin views engagement analytics
```

### Lessons module must include

- Student-friendly lesson summaries.
- Teaching Mode for classroom delivery.
- Flashcard decks.
- Resources and attachments.
- Practice questions.
- Assignment/quiz hooks.
- Student engagement tracking.
- Lesson analytics.
- Leo-powered content generation in V2.

---

## 9. Lessons Module Scope

## 9.1 V1 Scope

V1 should focus on non-AI core functionality.

Build:

1. Create Lesson from existing Lesson Note.
2. Lesson draft editor for student-facing content.
3. Lesson detail page for teachers.
4. Student lesson view.
5. Flashcard deck creation.
6. Flashcard card creation/editing.
7. Publish flashcard deck to class group/students.
8. Attach resources to lesson.
9. Resource visibility controls.
10. Teaching Mode basic version.
11. Lesson publish/unpublish workflow.
12. Lesson reflection after teaching.
13. Student flashcard progress tracking.
14. Basic lesson analytics.
15. Role-based access and permissions.
16. Audit logging for publish/unpublish actions.
17. Notifications when lessons/flashcards are published.

## 9.2 V2 Scope

V2 should introduce Leo-powered intelligence and deeper learning workflows.

Build:

1. Leo: Generate student lesson summary from Lesson Note.
2. Leo: Generate flashcards from Lesson Note.
3. Leo: Generate quiz/practice questions from Lesson Note.
4. Leo: Suggest teaching activities.
5. Leo: Simplify lesson for struggling learners.
6. Leo: Create differentiated learning materials.
7. Leo: Generate parent-friendly lesson summary.
8. Advanced Teaching Mode with time segments.
9. Lesson-to-assignment creation.
10. Lesson-to-quiz creation.
11. Curriculum coverage analytics.
12. Department/shared lesson bank.
13. Teacher collaboration on lessons.
14. Student study analytics and spaced revision.
15. Parent lesson summary visibility.
16. Recommended library resources.
17. Advanced reports for academic heads.

---

## 10. Core Domain Concepts

### 10.1 Lesson Note

Existing planning document created by teacher.

Must remain in Lesson Note module.

### 10.2 Lesson

Learning unit generated from a Lesson Note.

Can be private draft or published to students.

### 10.3 Lesson Resource

File, link, video, image, worksheet, slides, or other material attached to a Lesson.

### 10.4 Flashcard Deck

A set of flashcards linked to a Lesson.

### 10.5 Flashcard

Individual study card with front/back content.

### 10.6 Teaching Mode

Teacher-facing classroom delivery view based on the Lesson.

### 10.7 Lesson Reflection

Teacher’s post-teaching notes about completion, learner understanding, and follow-up needs.

### 10.8 Student Progress

Student interaction data with lessons and flashcards.

---

## 11. Recommended Backend Models

These are TypeScript-oriented model definitions. Convert to Mongoose schemas according to current backend patterns.

### 11.1 Lesson

```ts
type LessonStatus =
  | "draft"
  | "published"
  | "unpublished"
  | "archived";

type LessonVisibility =
  | "teacher_only"
  | "students"
  | "students_and_parents";

type Lesson = {
  _id: string;
  schoolId: string;

  sourceLessonNoteId: string;

  teacherId: string;
  subjectId: string;
  classGroupId: string;
  gradeId?: string;
  academicYearId: string;
  termId: string;

  title: string;
  topic?: string;
  subtopic?: string;
  weekNumber?: number;
  lessonDate?: Date;
  durationMinutes?: number;

  studentSummary?: string;
  keyPoints: string[];
  vocabulary: {
    term: string;
    meaning: string;
  }[];

  learningObjectives: string[];
  practiceQuestions: {
    question: string;
    answer?: string;
    type?: "short_answer" | "multiple_choice" | "essay" | "oral";
  }[];

  teachingMode?: {
    enabled: boolean;
    segments: {
      title: string;
      durationMinutes?: number;
      teacherPrompt?: string;
      learnerActivity?: string;
      notes?: string;
    }[];
  };

  status: LessonStatus;
  visibility: LessonVisibility;

  publishedAt?: Date;
  publishedBy?: string;
  unpublishedAt?: Date;
  archivedAt?: Date;

  createdBy: string;
  updatedBy?: string;

  createdAt: Date;
  updatedAt: Date;
};
```

### 11.2 LessonResource

```ts
type LessonResourceType =
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "link"
  | "document"
  | "slide"
  | "worksheet"
  | "other";

type ResourceVisibility =
  | "teacher_only"
  | "students"
  | "students_and_parents";

type LessonResource = {
  _id: string;
  schoolId: string;
  lessonId: string;

  title: string;
  description?: string;
  type: LessonResourceType;

  url: string;
  uploadThingKey?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;

  visibility: ResourceVisibility;

  uploadedBy: string;

  createdAt: Date;
  updatedAt: Date;
};
```

### 11.3 LessonFlashcardDeck

```ts
type FlashcardDeckStatus = "draft" | "published" | "archived";

type LessonFlashcardDeck = {
  _id: string;
  schoolId: string;
  lessonId: string;
  sourceLessonNoteId?: string;

  title: string;
  description?: string;

  createdBy: string;
  status: FlashcardDeckStatus;

  publishToClassGroupIds: string[];
  availableFrom?: Date;
  availableUntil?: Date;

  publishedAt?: Date;
  publishedBy?: string;

  createdAt: Date;
  updatedAt: Date;
};
```

### 11.4 LessonFlashcard

```ts
type LessonFlashcard = {
  _id: string;
  schoolId: string;
  deckId: string;
  lessonId: string;

  front: string;
  back: string;
  hint?: string;
  explanation?: string;
  imageUrl?: string;

  order: number;

  createdBy: string;

  createdAt: Date;
  updatedAt: Date;
};
```

### 11.5 LessonReflection

```ts
type ObjectivesMet = "yes" | "partially" | "no";

type LessonReflection = {
  _id: string;
  schoolId: string;
  lessonId: string;
  teacherId: string;

  completed: boolean;
  objectivesMet: ObjectivesMet;
  notes?: string;

  studentsWhoStruggled?: string[];
  followUpRequired: boolean;
  followUpNotes?: string;

  nextStep?: string;

  createdAt: Date;
  updatedAt: Date;
};
```

### 11.6 StudentLessonProgress

```ts
type StudentLessonProgress = {
  _id: string;
  schoolId: string;
  lessonId: string;
  studentId: string;

  viewedAt?: Date;
  completedAt?: Date;
  completionStatus: "not_started" | "viewed" | "completed";

  lastActivityAt?: Date;

  createdAt: Date;
  updatedAt: Date;
};
```

### 11.7 StudentFlashcardProgress

```ts
type FlashcardProgressStatus =
  | "new"
  | "learning"
  | "known"
  | "needs_review";

type StudentFlashcardProgress = {
  _id: string;
  schoolId: string;
  studentId: string;
  deckId: string;
  flashcardId: string;

  status: FlashcardProgressStatus;
  lastReviewedAt?: Date;
  reviewCount: number;

  createdAt: Date;
  updatedAt: Date;
};
```

### 11.8 LessonAuditLog

```ts
type LessonAuditAction =
  | "lesson_created_from_note"
  | "lesson_updated"
  | "lesson_published"
  | "lesson_unpublished"
  | "lesson_archived"
  | "resource_added"
  | "resource_deleted"
  | "flashcards_published";

type LessonAuditLog = {
  _id: string;
  schoolId: string;
  lessonId: string;
  actorId: string;
  action: LessonAuditAction;
  metadata?: Record<string, unknown>;
  createdAt: Date;
};
```

---

## 12. Data Relationships

```txt
School
 └── LessonNote
      └── Lesson
           ├── LessonResource[]
           ├── LessonFlashcardDeck[]
           │    └── LessonFlashcard[]
           ├── LessonReflection
           ├── StudentLessonProgress[]
           └── LessonAuditLog[]
```

Lesson must always reference `sourceLessonNoteId` unless a future school setting allows manual lessons.

For V1, manual Lessons without Lesson Notes should be disabled or admin-only.

---

## 13. API Design

Use the project’s existing API conventions. The routes below assume REST-style Next.js route handlers or Express-style endpoints.

### 13.1 Lessons

```txt
GET    /api/lessons
POST   /api/lessons/from-note
GET    /api/lessons/:lessonId
PATCH  /api/lessons/:lessonId
DELETE /api/lessons/:lessonId
POST   /api/lessons/:lessonId/publish
POST   /api/lessons/:lessonId/unpublish
POST   /api/lessons/:lessonId/archive
```

#### POST `/api/lessons/from-note`

Creates a Lesson draft from an existing Lesson Note.

Request:

```json
{
  "lessonNoteId": "string"
}
```

Server must:

1. Verify lesson note exists.
2. Verify teacher/admin has access.
3. Verify lesson note belongs to same school.
4. Pull subject, class group, grade, academic year, term, teacher from lesson note.
5. Create Lesson draft.
6. Map safe fields into student-facing draft.
7. Do not publish automatically.
8. Create audit log.

Response:

```json
{
  "data": {
    "lessonId": "string",
    "status": "draft"
  }
}
```

### 13.2 Lesson Resources

```txt
GET    /api/lessons/:lessonId/resources
POST   /api/lessons/:lessonId/resources
PATCH  /api/lessons/:lessonId/resources/:resourceId
DELETE /api/lessons/:lessonId/resources/:resourceId
```

### 13.3 Flashcard Decks

```txt
GET    /api/lessons/:lessonId/flashcard-decks
POST   /api/lessons/:lessonId/flashcard-decks
GET    /api/flashcard-decks/:deckId
PATCH  /api/flashcard-decks/:deckId
POST   /api/flashcard-decks/:deckId/publish
POST   /api/flashcard-decks/:deckId/archive
```

### 13.4 Flashcards

```txt
GET    /api/flashcard-decks/:deckId/cards
POST   /api/flashcard-decks/:deckId/cards
PATCH  /api/flashcards/:flashcardId
DELETE /api/flashcards/:flashcardId
POST   /api/flashcards/reorder
```

### 13.5 Student Progress

```txt
POST   /api/student/lessons/:lessonId/view
POST   /api/student/lessons/:lessonId/complete
GET    /api/student/lessons
GET    /api/student/lessons/:lessonId
POST   /api/student/flashcards/:flashcardId/progress
GET    /api/student/flashcard-decks/:deckId/progress
```

### 13.6 Reflections

```txt
GET    /api/lessons/:lessonId/reflection
POST   /api/lessons/:lessonId/reflection
PATCH  /api/lessons/:lessonId/reflection
```

### 13.7 Reports

```txt
GET /api/lessons/reports/overview
GET /api/lessons/reports/teacher/:teacherId
GET /api/lessons/reports/class-group/:classGroupId
GET /api/lessons/reports/engagement
```

### 13.8 V2 Leo AI endpoints

```txt
POST /api/leo/lessons/generate-summary
POST /api/leo/lessons/generate-flashcards
POST /api/leo/lessons/generate-practice-questions
POST /api/leo/lessons/suggest-activities
POST /api/leo/lessons/simplify-for-learners
POST /api/leo/lessons/generate-parent-summary
POST /api/leo/lessons/check-quality
```

All AI endpoints must return drafts only. They must never publish content automatically.

---

## 14. Backend Services

Create service-layer functions to avoid bloated route handlers.

### Lesson service

```ts
createLessonFromNote(lessonNoteId, actor)
getLessons(filters, actor)
getLessonById(lessonId, actor)
updateLesson(lessonId, payload, actor)
publishLesson(lessonId, actor)
unpublishLesson(lessonId, actor)
archiveLesson(lessonId, actor)
```

### Lesson mapping service

Responsible for transforming Lesson Note data into Lesson draft data.

```ts
mapLessonNoteToLessonDraft(lessonNote): Partial<Lesson>
```

This service must be careful not to expose internal teacher-only notes to students.

### Resource service

```ts
addLessonResource(lessonId, payload, actor)
updateLessonResource(resourceId, payload, actor)
deleteLessonResource(resourceId, actor)
```

### Flashcard service

```ts
createDeck(lessonId, payload, actor)
addFlashcard(deckId, payload, actor)
updateFlashcard(flashcardId, payload, actor)
reorderFlashcards(deckId, orderedIds, actor)
publishDeck(deckId, actor)
recordStudentFlashcardProgress(flashcardId, payload, actor)
```

### Analytics service

```ts
getLessonOverviewReport(filters, actor)
getTeacherLessonReport(teacherId, filters, actor)
getClassLessonEngagement(classGroupId, filters, actor)
```

### Leo service, V2

```ts
generateLessonSummaryFromNote(lessonNoteId, actor)
generateFlashcardsFromNote(lessonNoteId, actor)
generatePracticeQuestionsFromLesson(lessonId, actor)
suggestTeachingActivities(lessonId, actor)
```

---

## 15. Frontend Routes

Adjust route paths to match existing EduSentrix routing conventions.

### Teacher routes

```txt
/teacher/lessons
/teacher/lessons/from-note/:lessonNoteId
/teacher/lessons/:lessonId
/teacher/lessons/:lessonId/edit
/teacher/lessons/:lessonId/resources
/teacher/lessons/:lessonId/flashcards
/teacher/lessons/:lessonId/teaching-mode
/teacher/lessons/:lessonId/reflection
```

### Student routes

```txt
/student/lessons
/student/lessons/:lessonId
/student/flashcards
/student/flashcards/:deckId
```

### Admin / Academic Head routes

```txt
/admin/lessons
/admin/lessons/reports
/admin/lessons/teacher-coverage
/admin/lessons/class-coverage
/admin/lessons/templates
```

---

## 16. Frontend Screens

### 16.1 Teacher Lessons Dashboard

Purpose: Teacher sees all lessons derived from Lesson Notes.

Required UI:

- Search lessons.
- Filter by class group, subject, term, status.
- Cards/table toggle if consistent with existing product.
- Status badges: draft, published, unpublished, archived.
- Quick actions:
  - View,
  - Edit,
  - Teaching Mode,
  - Flashcards,
  - Publish/Unpublish.
- CTA: `Create Lesson from Lesson Note`.

### 16.2 Create Lesson from Lesson Note

Purpose: Choose an existing Lesson Note and generate a Lesson draft.

Required UI:

- List eligible lesson notes.
- Filters by subject, class, term, week, status.
- Show whether a lesson has already been created from the note.
- Action: `Create Lesson`.

Important:

- Do not create another lesson note.
- Do not show lesson-note wizard here.
- Link back to source lesson note for editing planning content.

### 16.3 Lesson Editor

Purpose: Edit student-facing Lesson content.

Required sections:

- Source Lesson Note summary/read-only link.
- Lesson title.
- Student summary.
- Key points.
- Vocabulary.
- Practice questions.
- Resources.
- Flashcards.
- Visibility.
- Publish controls.

Important:

- Make clear this is student-facing content.
- Do not expose private Lesson Note fields by default.

### 16.4 Lesson Detail Page

Teacher/admin view of a lesson.

Required tabs:

```txt
Overview
Resources
Flashcards
Practice
Teaching Mode
Engagement
Reflection
```

### 16.5 Teaching Mode

Purpose: Distraction-free classroom delivery mode.

Required UI:

- Lesson objective.
- Key points.
- Time segments.
- Teacher prompts.
- Learner activities.
- Questions to ask.
- Resources quick access.
- Mark as taught.
- Add reflection after teaching.

V1 can be simple. V2 can include timers and AI suggestions.

### 16.6 Flashcard Deck Builder

Required UI:

- Deck title and description.
- Add/edit/delete flashcards.
- Front/back fields.
- Hint/explanation fields.
- Optional image.
- Reorder cards.
- Preview mode.
- Publish to class.

### 16.7 Student Lesson View

Required UI:

- Lesson title.
- Subject and class.
- Summary.
- Key points.
- Vocabulary.
- Resources.
- Flashcards.
- Practice questions.
- Mark as completed.

Students should not see private teacher planning fields.

### 16.8 Student Flashcard Study UI

Required UI:

- Flip-card interaction.
- Progress buttons:
  - I know this,
  - Still learning,
  - Revise again.
- Progress indicator.
- Deck completion summary.

### 16.9 Admin Lessons Analytics

Required UI:

- Lessons created this week/month/term.
- Published lessons.
- Unpublished drafts.
- Teacher lesson activity.
- Class lesson coverage.
- Student engagement.
- Flashcard usage.

---

## 17. Frontend Components

Recommended components:

```txt
LessonCard
LessonStatusBadge
LessonSourceNoteBanner
CreateLessonFromNoteButton
LessonFilters
LessonEditorForm
KeyPointsEditor
VocabularyEditor
PracticeQuestionEditor
LessonResourceUploader
LessonResourceList
FlashcardDeckCard
FlashcardEditor
FlashcardPreview
FlashcardStudyCard
TeachingModePanel
LessonReflectionForm
LessonEngagementChart
LessonPublishDialog
LessonVisibilitySelector
```

Use existing EduSentrix design system components and shadcn/ui patterns.

Do not introduce a new visual language.

---

## 18. Frontend Hooks

Using TanStack React Query, create hooks such as:

```ts
useLessons(filters)
useLesson(lessonId)
useCreateLessonFromNote()
useUpdateLesson()
usePublishLesson()
useUnpublishLesson()
useLessonResources(lessonId)
useAddLessonResource()
useDeleteLessonResource()
useFlashcardDecks(lessonId)
useCreateFlashcardDeck()
useFlashcards(deckId)
useCreateFlashcard()
useUpdateFlashcard()
usePublishFlashcardDeck()
useStudentLessons()
useStudentLesson(lessonId)
useMarkLessonViewed()
useMarkLessonCompleted()
useUpdateFlashcardProgress()
useLessonReflection(lessonId)
useSaveLessonReflection()
useLessonReports(filters)
```

Use native `fetch` if that is the current EduSentrix convention. Do not introduce Axios unless the project already uses it.

---

## 19. Permissions and RBAC

Suggested permissions:

```txt
lessons.read
lessons.create_from_note
lessons.update
lessons.publish
lessons.unpublish
lessons.archive

lessonResources.read
lessonResources.create
lessonResources.update
lessonResources.delete

lessonFlashcards.read
lessonFlashcards.create
lessonFlashcards.update
lessonFlashcards.delete
lessonFlashcards.publish
lessonFlashcards.study

lessonReflections.read
lessonReflections.create
lessonReflections.update

lessonAnalytics.view
lessonTemplates.manage
lessonAi.use
```

### Role behavior

#### Teacher

Can:

- create lessons from own/assigned lesson notes,
- edit own lessons,
- upload resources,
- create flashcards,
- publish lessons to assigned class groups,
- record reflections,
- view engagement for assigned students/classes.

#### Academic Head / Supervisor

Can:

- view lessons for assigned department/classes,
- view reports,
- inspect lesson coverage,
- review lesson quality if configured.

#### School Admin

Can:

- view all lessons in school,
- manage settings,
- view reports,
- configure templates/visibility rules,
- archive inappropriate content.

#### Student

Can:

- view published lessons for their class group,
- study flashcards,
- access student-visible resources,
- update own progress.

#### Parent, optional V2

Can:

- view parent-visible summaries and resources for their child.

---

## 20. Notifications

Trigger notifications for:

```txt
lesson.published
lesson.unpublished
flashcardDeck.published
resource.added
practice.added
lesson.markedTaught
```

Examples:

```txt
A new Science lesson has been published for JHS 1.
New flashcards are available for Mathematics - Fractions.
Your teacher added a worksheet to today’s English lesson.
```

Notification channels depend on existing EduSentrix notification infrastructure.

---

## 21. UploadThing Integration

Resources should use the existing UploadThing setup.

Supported uploads:

- PDF,
- images,
- documents,
- slides,
- audio,
- worksheets.

Store only file metadata and URL in the database.

Recommended metadata:

```ts
{
  url: string;
  uploadThingKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}
```

Visibility must be enforced server-side.

---

## 22. Leo / AI Requirements, V2

Leo should enhance the Lessons module, not replace teacher judgement.

### AI content generation rules

1. AI output must be draft-only.
2. Teacher must review before publishing.
3. AI must use school, subject, grade, class, and curriculum context.
4. AI must respect whether the source is Primary, JHS, KG, or Preschool.
5. AI must avoid exposing private teacher notes unless teacher selects them.
6. AI-generated content should be auditable.

### AI features

```txt
Generate student summary from Lesson Note
Generate flashcards from Lesson Note
Generate practice questions
Suggest teaching activities
Simplify for struggling learners
Create differentiated learning tasks
Generate parent-friendly summary
Check lesson quality
Suggest missing resources
Generate vocabulary list
```

### Example AI flow

```txt
Teacher opens Lesson draft
Clicks “Generate Flashcards with Leo”
Leo creates draft cards
Teacher reviews/edits/deletes cards
Teacher publishes deck
Students study deck
```

---

## 23. Analytics and Reports

### Teacher analytics

```txt
Lessons created
Lessons published
Lessons taught
Lessons pending publication
Flashcards created
Student views
Student completion
Flashcard progress
```

### Admin analytics

```txt
Lessons created by teacher
Lessons published by class
Subject coverage
Class coverage
Teacher activity
Student engagement
Most used resources
Flashcard usage
Unpublished lesson drafts
```

### Student analytics

```txt
Lessons viewed
Lessons completed
Flashcards studied
Cards known
Cards needing review
Last study date
```

---

## 24. Integration With Existing Modules

### Lesson Notes

Source of all Lessons.

### Timetable

A Lesson may be linked to scheduled class periods in future.

### Subjects

Lessons inherit subject from Lesson Note.

### Class Groups / Grades

Lessons inherit class group and grade from Lesson Note.

### Students

Published Lessons appear in student accounts.

### Teachers

Teachers create and manage Lessons from Lesson Notes.

### Assignments

V2 can allow assignments to be generated from Lessons.

### Assessments / Quizzes

V2 can allow quizzes to be generated from Lessons.

### Library

V2 can recommend books/resources linked to Lessons.

### Notifications

Notify students when learning materials are published.

### Leo AI

Generate drafts, summaries, flashcards, questions, and teaching ideas.

---

## 25. UX Principles

1. The module must feel like part of EduSentrix, not a separate LMS pasted in.
2. Keep workflows simple for teachers.
3. Do not make teachers duplicate work.
4. Always start from Lesson Notes where possible.
5. Make student-facing content clearly separate from private teacher planning.
6. Use premium, clean UI consistent with existing EduSentrix design.
7. Avoid clutter; use tabs and progressive disclosure.
8. Make publishing intentional and reversible.
9. Make AI helpful but not automatic.

---

## 26. Required Empty States

### Teacher has no lessons

```txt
No lessons yet.
Create your first student-ready lesson from an existing lesson note.
```

CTA:

```txt
Create Lesson from Lesson Note
```

### No eligible lesson notes

```txt
No lesson notes found for this class or subject.
Create a lesson note first, then return here to turn it into a student lesson.
```

### Student has no lessons

```txt
No lessons have been published for your class yet.
Check back later.
```

### No flashcards

```txt
No flashcards yet.
Create flashcards to help students revise this lesson.
```

---

## 27. Validation Rules

### Lesson creation from note

- `lessonNoteId` is required.
- Lesson Note must belong to actor’s school.
- Teacher must have access to the Lesson Note.
- Duplicate lessons from the same Lesson Note should be prevented unless explicitly allowed.
- Required inherited fields must exist: schoolId, teacherId, subjectId, classGroupId, academicYearId, termId.

### Publishing

To publish a Lesson:

- Lesson must have title.
- Lesson must have student summary or key points.
- Lesson must have valid class group.
- Actor must have publish permission.
- Visibility must be selected.

### Flashcards

- Deck title is required.
- Flashcard front and back are required.
- Cannot publish an empty deck.

### Resources

- Resource title is required.
- Resource URL is required.
- Resource visibility is required.

---

## 28. Security Requirements

1. Enforce school scoping on every query.
2. Enforce role/permission checks on every mutation.
3. Students can only access lessons published to their class group.
4. Parents can only access child-related lessons if parent visibility is enabled.
5. Teacher-only resources must never be returned to students.
6. Source Lesson Note private fields must not leak through Lesson APIs.
7. Upload URLs must be validated and associated with school/lesson.
8. Audit publish/unpublish/archive actions.
9. AI endpoints must not expose cross-school data.

---

## 29. Performance Requirements

- Lessons list must support pagination.
- Flashcards list should be ordered and indexed by deckId.
- Reports should use efficient aggregation.
- Add indexes for schoolId, lessonId, teacherId, classGroupId, subjectId, termId, status.
- Avoid loading all flashcard progress records for a large class unless necessary.

Recommended indexes:

```txt
Lesson: schoolId + teacherId + status
Lesson: schoolId + classGroupId + subjectId + termId
Lesson: schoolId + sourceLessonNoteId
LessonResource: schoolId + lessonId
LessonFlashcardDeck: schoolId + lessonId + status
LessonFlashcard: schoolId + deckId + order
StudentLessonProgress: schoolId + studentId + lessonId
StudentFlashcardProgress: schoolId + studentId + deckId
```

---

## 30. Acceptance Criteria

### V1 acceptance criteria

1. Teacher can create a Lesson from an existing Lesson Note.
2. System automatically inherits subject, class group, grade, academic year, term, and teacher from Lesson Note.
3. The existing Lesson Note wizard UI remains unchanged.
4. Teacher can edit student-facing summary, key points, vocabulary, and practice questions.
5. Teacher can attach resources and control visibility.
6. Teacher can create flashcard decks and cards.
7. Teacher can publish a Lesson to students.
8. Students can view only published Lessons for their class group.
9. Students can study flashcards and update progress.
10. Teacher can use basic Teaching Mode.
11. Teacher can save lesson reflection after teaching.
12. Admin/teacher can view basic engagement analytics.
13. Server enforces school scoping and permissions.
14. Private Lesson Note content is not exposed to students by default.
15. Publish/unpublish actions are audited.

### V2 acceptance criteria

1. Leo can generate draft student summaries from Lesson Notes.
2. Leo can generate draft flashcards from Lesson Notes.
3. Leo can generate draft practice questions.
4. Teacher must approve AI output before publishing.
5. Teaching Mode supports lesson segments and timing guidance.
6. Lessons can generate assignments/quizzes.
7. Admin can view curriculum/lesson coverage analytics.
8. Students receive improved progress and revision analytics.
9. Parent-visible summaries can be enabled by school settings.
10. Shared lesson bank works within school boundaries.

---

## 31. Implementation Phases

### Phase 0: Verification

- Inspect existing Lesson Note module.
- Document models, APIs, wizard behavior, statuses, permissions.
- Identify safe mapping fields from Lesson Note to Lesson.

### Phase 1: Lesson Note template config enhancement

- Add config resolver for presets/labels/hints/examples/optional fields.
- Preserve current wizard look and feel.
- Add Primary/JHS variants under NaCCA 3-phase.
- Add Early Years Activity Plan support if required by current roadmap.

### Phase 2: Core Lessons backend

- Add Lesson model.
- Add create-from-note endpoint.
- Add Lesson CRUD.
- Add publish/unpublish/archive.
- Add audit logs.

### Phase 3: Teacher frontend

- Lessons dashboard.
- Create from Lesson Note flow.
- Lesson editor.
- Lesson detail tabs.
- Teaching Mode basic.

### Phase 4: Resources and flashcards

- Resource upload/list/delete.
- Flashcard decks.
- Flashcard builder.
- Publish deck.

### Phase 5: Student experience

- Student lessons page.
- Student lesson detail.
- Flashcard study UI.
- Progress tracking.

### Phase 6: Analytics and notifications

- Basic reports.
- Engagement tracking.
- Notifications for published lessons and flashcards.

### Phase 7: Leo AI, V2

- AI summaries.
- AI flashcards.
- AI practice questions.
- AI teaching suggestions.
- Differentiated learning materials.

---

## 32. Non-Goals for V1

Do not build these in V1 unless explicitly approved:

- Full LMS replacement.
- Live video lessons.
- Public course marketplace.
- Parent lesson dashboards.
- AI auto-publishing.
- Cross-school lesson sharing.
- Advanced spaced repetition engine.
- Full curriculum mapping engine.
- Manual lesson creation detached from Lesson Notes.

---

## 33. Final Product Positioning

EduSentrix Lessons should be positioned as:

```txt
Turn approved teacher lesson notes into student-ready lessons, flashcards, resources, practice activities, and teaching support.
```

The key difference is:

```txt
Traditional school system: stores lesson notes.
EduSentrix: turns lesson notes into learning experiences.
```

This is the product advantage.

---

## 34. Final Engineering Instruction

Before implementing anything, verify the existing Lesson Note module.

The Lessons module must integrate seamlessly with it, inherit its context, respect its wizard design, and extend its value without duplicating its purpose.

The correct architecture is:

```txt
Lesson Note Module
  = planning, templates, compliance, review

Lessons Module
  = delivery, student learning, flashcards, resources, practice, analytics, Leo AI
```

