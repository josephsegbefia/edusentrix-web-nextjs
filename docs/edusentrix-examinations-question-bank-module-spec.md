# EduSentrix Examinations & Question Bank Module — Development Spec

## 1. Purpose

The **Examinations & Question Bank Module** is a core academic module for EduSentrix School OS. It enables schools to create, review, print, archive, and reuse examination papers and questions.

This module should connect directly to EduSentrix’s existing academic backbone:

```txt
Curriculum & Scheme of Work
→ Lesson Notes
→ Lessons
→ Assignments / Classwork
→ Examinations
→ Results / Reports
→ Question Bank
→ AI Academic Insights
```

The goal is not just to create a basic question editor. The module must help schools:

- create printable exam papers,
- set different question types,
- allocate marks correctly,
- generate AI-assisted draft questions from completed lessons and schemes of work,
- review and approve exam papers,
- export question papers, answer keys, and marking schemes,
- preserve completed exam questions in a school-owned question bank,
- reuse curated past questions in future terms,
- analyze question difficulty after results are recorded.

---

## 2. Product Principle

The module must distinguish between two major entities:

### 2.1 Exam Paper

An **Exam Paper** is a specific assessment paper for a particular school, academic period, subject, class/grade, and exam type.

Example:

```txt
JHS 2 Integrated Science
End of Term 1 Examination
2026/2027 Academic Year
```

### 2.2 Question Bank

The **Question Bank** is a long-term reusable school-owned repository of curated questions.

Questions are not owned by individual teachers. They belong to the school, but the system must record:

- who created the question,
- which teacher originally used it,
- which exam it first appeared in,
- which term/academic period it belongs to,
- which class/grade it was created for,
- performance-based difficulty over time.

Correct ownership model:

```txt
Question belongs to the school.
Teacher is recorded as creator/contributor.
```

---

## 3. Recommended Module Name

Sidebar label:

```txt
Examinations
```

Internal sections:

```txt
Exam Papers
Question Bank
Exam Types
AI Question Generator
Print / Export
Past Questions
Exam Analytics
Settings
```

Marketing label:

```txt
Smart Examinations & Question Bank
```

---

## 4. Core Capabilities

The module should allow schools to:

1. Configure exam types.
2. Create exam papers per subject/class/term.
3. Add multiple-choice, essay, structured, short-answer, true/false, and other question types.
4. Configure the number of MCQ choices.
5. Allocate marks per question and sub-question.
6. Attach images/diagrams/illustrations to questions.
7. Use AI/Leo to generate draft questions from:
   - completed lessons,
   - approved lesson notes,
   - active schemes of work,
   - curriculum indicators,
   - subject and class context.
8. Set intended question difficulty when generating with AI.
9. Review and approve exam papers before printing.
10. Export printable PDFs.
11. Export answer keys and marking schemes.
12. Archive completed papers as past exam papers.
13. Save/reuse questions in the Question Bank.
14. Analyze real difficulty based on student performance later.

---

## 5. Exam Types

Exam types must be configurable per school.

### 5.1 Default Exam Types

Seed the following exam types for each school:

```txt
Class Test
Quiz
Mid-Term Exam
End of Term Exam
End of Academic Year / Promotion Exam
Mock Exam
Entrance Exam
Placement Test
Remedial Assessment
Practical Exam
Oral Exam
Project-Based Assessment
```

### 5.2 Exam Type Settings

Each exam type should support:

```ts
type ExamType = {
  id: string;
  schoolId: string;

  name: string;
  description?: string;

  requiresApproval: boolean;
  appearsOnReportCard: boolean;
  contributesToFinalGrade: boolean;
  canBePrinted: boolean;
  allowCandidateNumbers: boolean;
  allowAnswerSheet: boolean;

  allowedQuestionTypes: ExamQuestionType[];

  status: "active" | "inactive" | "archived";

  createdAt: Date;
  updatedAt: Date;
};
```

---

## 6. Question Types

### 6.1 V1 Question Types

V1 should support:

```txt
Multiple Choice
True / False
Short Answer
Essay / Theory
Structured Question
Fill in the Blank
Matching
```

### 6.2 V2 Question Types

V2 can add:

```txt
Diagram Labeling
Comprehension Passage
Practical / Experiment
Oral Question
Image-Based Question
Multi-Part Question
```

### 6.3 TypeScript Enum

```ts
type ExamQuestionType =
  | "multiple_choice"
  | "true_false"
  | "short_answer"
  | "essay"
  | "structured"
  | "fill_blank"
  | "matching"
  | "diagram_labeling"
  | "comprehension"
  | "practical"
  | "oral"
  | "image_based";
```

---

## 7. Multiple Choice Questions

Multiple-choice questions must support a configurable number of options.

Examples:

```txt
2 choices
3 choices
4 choices
5 choices
custom
```

Each MCQ should support:

```ts
type ExamQuestionOption = {
  id: string;
  label: string; // A, B, C, D
  text: string;
  isCorrect?: boolean;
};
```

Teacher must be able to:

- add/remove options,
- mark correct answer,
- allocate marks,
- include an explanation,
- decide whether the answer key should print,
- optionally randomize option order later.

---

## 8. Essay, Theory, and Structured Questions

Essay and structured questions must support:

- question prompt,
- marks allocation,
- expected answer,
- marking guide,
- rubric,
- sub-questions,
- optional image/diagram attachment.

Example:

```txt
1. Explain three causes of water pollution. [10 marks]
   a. State two examples of water pollutants. [4 marks]
   b. Explain one effect of water pollution on human health. [6 marks]
```

Sub-question model:

```ts
type ExamSubQuestion = {
  label: string; // a, b, c
  prompt: string;
  marks: number;
  expectedAnswer?: string;
  markingGuide?: string;
};
```

---

## 9. Handling Illustrations, Drawings, and Diagrams

Some exam questions need images, diagrams, charts, maps, graphs, circuits, or drawings.

### 9.1 V1 Approach: Image/File Attachment

For V1, support uploading image/diagram attachments per question using the existing EduSentrix upload system.

Use cases:

```txt
Map
Graph
Biology diagram
Geometry figure
Circuit diagram
Chart
Comprehension image
Picture prompt
```

Attachment model:

```ts
type ExamQuestionAttachment = {
  id: string;
  type: "image" | "pdf" | "diagram" | "audio" | "file";
  url: string;
  uploadKey?: string;
  fileName?: string;
  mimeType?: string;
  caption?: string;
  altText?: string;
  displayMode: "above_question" | "below_question" | "inline";
};
```

### 9.2 V2 Approach: Diagram Editor

Later, add a simple diagram/drawing editor that supports:

- arrows,
- lines,
- shapes,
- labels,
- simple diagrams,
- number lines,
- geometry diagrams.

Save outputs as SVG or PNG and attach them to the question.

### 9.3 V2/V3 Approach: AI-Assisted Diagrams

Leo can later generate simple diagrams, but generated diagrams must always require teacher review before being attached to exam papers.

Flow:

```txt
AI generates illustration
→ Teacher reviews
→ Teacher edits/replaces if needed
→ Attach to question
```

---

## 10. Exam Paper Structure

Exam papers must support sections.

Example:

```txt
Section A: Objective Test
Answer all questions. 20 marks.

Section B: Theory
Answer any three questions. 30 marks.
```

### 10.1 Exam Paper Model

```ts
type ExamPaperStatus =
  | "draft"
  | "submitted"
  | "needs_revision"
  | "approved"
  | "printed"
  | "completed"
  | "archived";


type ExamPaper = {
  id: string;
  schoolId: string;

  title: string;
  examTypeId: string;

  academicYearId: string;
  termId?: string;

  scope: "class_group" | "grade_wide";
  gradeId: string;
  classGroupId?: string;
  classGroupIds?: string[];
  subjectId: string;

  teacherId?: string;
  leadSetterId?: string;
  contributorIds?: string[];
  setBy?: string;
  createdBy: string;
  ownerRole: "teacher" | "admin" | "academic_head";

  durationMinutes?: number;
  totalMarks: number;

  instructions?: string;
  candidateInstructions?: string;

  status: ExamPaperStatus;

  sourceMode: "manual" | "ai_assisted" | "question_bank" | "mixed";

  scheduledExamDate?: Date;

  submittedAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;

  completedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
};
```

### 10.2 Paper Scope, Ownership, and Multi-Stream Grades

Exam papers must support both class-specific papers and common grade-wide papers.

```txt
Class-specific paper:
JHS 2A English End of Term Examination

Grade-wide/common paper:
JHS 2 English End of Term Examination
Applies to JHS 2A, JHS 2B, and JHS 2C
```

For grades with multiple class groups where different teachers teach the same
subject in different streams, the paper still belongs to the school. Teachers
are roles on the paper, not owners of the paper.

```txt
Paper belongs to school.
Lead setter is responsible for setting it.
Contributors may suggest or edit questions if allowed.
Admin / academic head reviews or sets the paper officially.
```

Recommended workflow for a common grade paper:

```txt
Admin/HOD creates exam paper
→ selects Grade-wide paper
→ selects grade + subject + applicable class groups
→ system shows teachers assigned to that subject in those class groups
→ admin chooses lead setter
→ optional contributors are added automatically or manually
→ lead setter builds paper
→ contributors may suggest/review if enabled
→ paper is submitted
→ admin/HOD approves
→ one common PDF is printed for all selected class groups
```

Admin/HOD may also set the paper directly without assigning a teacher as lead
setter. This is required for centralized exams, common papers, entrance exams,
placement tests, and cases where the school wants a standard paper across all
streams.

Roles on an exam paper:

```txt
createdBy = user who created the record
teacherId = responsible teacher if applicable
leadSetterId = main setter for the paper
contributorIds = teachers/departments contributing questions
setBy = admin/head who officially set or issued the paper
approvedBy = admin/head who approved it
```

### 10.3 Exam Paper Section Model

```ts
type ExamPaperSection = {
  id: string;
  schoolId: string;
  examPaperId: string;

  title: string; // e.g. Section A
  instructions?: string;
  order: number;
  marks: number;

  createdAt: Date;
  updatedAt: Date;
};
```

### 10.4 Exam Question Model

```ts
type ExamQuestionDifficulty = "easy" | "medium" | "hard" | "mixed";


type ExamQuestion = {
  id: string;
  schoolId: string;

  examPaperId?: string;
  sectionId?: string;

  questionBankItemId?: string;

  type: ExamQuestionType;

  prompt: string;
  plainTextPrompt?: string;

  options?: ExamQuestionOption[];
  subQuestions?: ExamSubQuestion[];

  marks: number;
  difficulty: ExamQuestionDifficulty;

  topic?: string;
  subtopic?: string;

  curriculumNodeIds?: string[];
  schemeItemIds?: string[];
  lessonIds?: string[];
  lessonNoteIds?: string[];

  expectedAnswer?: string;
  markingGuide?: string;
  explanation?: string;

  attachments?: ExamQuestionAttachment[];

  order: number;

  createdBy: string;
  teacherId?: string;

  source: "manual" | "ai_generated" | "question_bank" | "imported";

  createdAt: Date;
  updatedAt: Date;
};
```

---

## 11. Question Bank

The Question Bank must be a standalone school-owned repository.

### 11.1 Question Bank Item Model

```ts
type QuestionBankItemStatus =
  | "draft"
  | "curated"
  | "approved"
  | "needs_review"
  | "archived";


type QuestionBankItem = {
  id: string;
  schoolId: string;

  subjectId: string;
  gradeId: string;
  classGroupIds?: string[];

  curriculumId?: string;
  curriculumNodeIds?: string[];
  schemeItemIds?: string[];
  lessonIds?: string[];
  lessonNoteIds?: string[];

  type: ExamQuestionType;

  prompt: string;
  plainTextPrompt?: string;

  options?: ExamQuestionOption[];
  subQuestions?: ExamSubQuestion[];

  marks: number;

  teacherIntendedDifficulty?: "easy" | "medium" | "hard" | "mixed";
  aiEstimatedDifficulty?: "easy" | "medium" | "hard" | "mixed";
  performanceDifficulty?: "easy" | "medium" | "hard" | "mixed";

  topic?: string;
  subtopic?: string;
  tags?: string[];

  expectedAnswer?: string;
  markingGuide?: string;
  explanation?: string;

  attachments?: ExamQuestionAttachment[];

  createdBy: string;
  originalTeacherId?: string;

  firstUsedExamPaperId?: string;
  lastUsedExamPaperId?: string;
  usedCount: number;

  source:
    | "manual"
    | "ai_generated"
    | "imported"
    | "past_exam"
    | "copied";

  status: QuestionBankItemStatus;

  createdAt: Date;
  updatedAt: Date;
};
```

### 11.2 Question Bank Requirements

The Question Bank must support:

- search,
- filters by subject, grade, term, topic, difficulty, type,
- reuse question in a new paper,
- duplicate and edit question,
- view previous usage,
- view performance difficulty when available,
- curate/approve/archive questions,
- prevent accidental teacher ownership lock-in.

---

## 12. Past Papers

Do not physically “move” questions out of exam papers.

Instead:

```txt
Exam paper is completed/archived.
Questions are saved or linked to Question Bank.
Completed paper appears under Past Papers.
```

Flow:

```txt
Exam period ends
→ Admin/teacher marks exam paper as completed
→ System prompts: Add questions to Question Bank?
→ Teacher/admin reviews metadata
→ Questions are saved/linked into Question Bank
→ Exam paper appears in Past Papers
```

Past papers should support:

- viewing completed papers,
- duplicating a past paper,
- reusing selected questions,
- exporting again,
- seeing metadata such as term, teacher, class, subject, and performance.

---

## 13. AI / Leo Question Generation

AI must generate draft questions only. It must never publish or approve exam questions automatically.

### 13.1 AI Sources

AI can generate questions from:

```txt
Completed Lessons
Published Lessons
Approved Lesson Notes
Active Scheme of Work
Curriculum Indicators
Subject
Grade/Class Level
Exam Type
Teacher-selected topics
Question Bank examples
```

### 13.2 AI Generation Inputs

```ts
type AiExamQuestionGenerationInput = {
  schoolId: string;
  subjectId: string;
  gradeId: string;
  classGroupId?: string;
  academicYearId: string;
  termId?: string;

  examTypeId: string;

  sourceTypes: Array<
    | "completed_lessons"
    | "published_lessons"
    | "approved_lesson_notes"
    | "scheme_of_work"
    | "curriculum"
    | "question_bank"
  >;

  lessonIds?: string[];
  lessonNoteIds?: string[];
  schemeItemIds?: string[];
  curriculumNodeIds?: string[];

  difficulty: "easy" | "medium" | "hard" | "mixed";

  questionPlan: {
    type: ExamQuestionType;
    count: number;
    marksPerQuestion?: number;
    numberOfChoices?: number;
  }[];

  totalMarks?: number;
  durationMinutes?: number;
};
```

### 13.3 AI Generation Flow

```txt
Teacher opens AI Question Generator
→ selects subject/class/exam type/source material/difficulty/question mix
→ Leo generates draft questions
→ teacher reviews editable preview
→ teacher selects questions to add
→ selected questions are added to the exam paper as draft questions
```

### 13.4 AI Review UI

Generated questions must appear in a teacher-review screen, not as raw JSON.

Each generated question should be editable and selectable.

Actions:

```txt
Add selected to exam paper
Save selected to question bank
Discard
Regenerate
Adjust difficulty
```

### 13.5 AI Quality Checker

Leo should later support a quality checker that verifies:

- total marks correctness,
- duplicate questions,
- unclear wording,
- answer leakage,
- missing marking guide,
- alignment with covered lessons,
- difficulty balance,
- whether the paper is too easy or too difficult.

---

## 14. Difficulty Model

Difficulty must support three separate concepts.

### 14.1 Teacher Intended Difficulty

Set manually or selected during AI generation.

```txt
Easy
Medium
Hard
Mixed
```

### 14.2 AI Estimated Difficulty

Estimated by Leo based on content and learner level.

### 14.3 Performance-Based Difficulty

Calculated after student results are entered.

Example rule:

```txt
80%+ correct = Easy
40%–79% correct = Medium
Below 40% correct = Hard
```

Store performance-based difficulty on the Question Bank item after results analysis.

---

## 15. Exam Blueprint

Before generating or writing questions, teachers should be able to create an exam blueprint.

Example:

```txt
Section A: 20 MCQs × 1 mark = 20 marks
Section B: 5 short answers × 4 marks = 20 marks
Section C: 2 essays × 10 marks = 20 marks
Total: 60 marks
Duration: 90 minutes
```

Blueprint model:

```ts
type ExamBlueprint = {
  id: string;
  schoolId: string;
  examPaperId: string;

  totalMarks: number;
  durationMinutes?: number;

  sections: {
    title: string;
    questionType: ExamQuestionType;
    numberOfQuestions: number;
    marksPerQuestion?: number;
    totalMarks: number;
    difficultyMix?: {
      easy?: number;
      medium?: number;
      hard?: number;
    };
  }[];

  createdAt: Date;
  updatedAt: Date;
};
```

---

## 16. Printable PDF Export

Printable export is a critical feature.

The module must export:

```txt
Question Paper PDF
Answer Key PDF
Marking Scheme PDF
Combined Teacher Copy
Student Copy Without Answers
```

### 16.1 PDF Export Options

```ts
type ExamPaperExportOptions = {
  includeSchoolLogo: boolean;
  includeSchoolName: boolean;
  includeExamTitle: boolean;
  includeDuration: boolean;
  includeTotalMarks: boolean;
  includeCandidateNumberField: boolean;
  includeStudentNameField: boolean;
  includeClassField: boolean;
  includeAnswerSpaces: boolean; // V1 default: false

  includeAnswerKey: boolean;
  includeMarkingGuide: boolean;

  shuffleQuestionOrder: boolean;
  shuffleMultipleChoiceOptions: boolean;

  outputType:
    | "student_question_paper"
    | "answer_key"
    | "marking_scheme"
    | "teacher_combined_copy";
};
```

### 16.2 PDF Layout Requirements

For V1, the student-facing exam paper PDF must be a clean question-only paper.
Schools are assumed to provide separate answer booklets unless they explicitly
enable answer spaces later.

Student question paper PDF must include:

- school logo,
- school name,
- exam title,
- subject,
- class/grade,
- term/academic year,
- duration,
- total marks,
- candidate number field,
- student name field,
- clear section headers,
- marks displayed beside questions,
- image/diagram attachments.

Student question paper PDF must not include:

- answer spaces by default,
- answer keys,
- marking guides,
- expected answers.

Answer spaces may be supported later as an optional export setting, but the
default should remain `includeAnswerSpaces: false`.

PDF generation must support:

- page breaks that avoid splitting images badly,
- separate answer key export,
- separate marking scheme export,
- teacher combined copy containing questions plus answers/marking guide.

---

## 17. Approval Workflow

Exam papers should support review and approval before printing.

### 17.1 Workflow

```txt
Teacher creates exam paper
→ Teacher submits for review
→ Academic head/admin reviews
→ Approves / requests revision / rejects
→ Approved paper can be printed/exported
→ After exam period, paper becomes completed/past paper
```

### 17.2 Status Transitions

```txt
draft → submitted
submitted → approved
submitted → needs_revision
submitted → archived/rejected if supported
needs_revision → submitted
approved → printed
printed → completed
completed → archived
```

### 17.3 Review Model

```ts
type ExamPaperReview = {
  id: string;
  schoolId: string;
  examPaperId: string;

  reviewerId: string;

  decision: "approved" | "needs_revision" | "rejected";
  comment?: string;

  createdAt: Date;
};
```

Review UI must show:

- paper metadata,
- sections,
- all questions,
- total marks validation,
- AI quality warnings if available,
- review history,
- approval/revision/rejection comments.

---

## 18. Permissions

Suggested permissions:

```txt
exams.read
exams.create
exams.update
exams.delete
exams.submit
exams.review
exams.approve
exams.print
exams.complete
exams.archive

examQuestions.create
examQuestions.update
examQuestions.delete
examQuestions.attachments.manage

questionBank.read
questionBank.create
questionBank.update
questionBank.curate
questionBank.archive
questionBank.reuse

examTypes.manage
examSettings.manage
examAi.use
examAnalytics.view
```

### 18.1 Teacher

Can:

- create papers for assigned subjects/classes,
- create or lead common grade-wide papers when assigned as lead setter,
- add/edit draft questions,
- contribute to papers where added as contributor,
- use AI if allowed,
- submit for review,
- export only if approved or school allows draft export,
- reuse approved question bank items.

### 18.2 Academic Head / Admin

Can:

- create/set exam papers for any subject, grade, or class group,
- create grade-wide/common papers across multiple class groups,
- assign lead setters and contributors,
- set centralized papers directly without assigning a teacher,
- import or duplicate past papers,
- review papers,
- approve/request revision/reject,
- edit or lock approved papers when school policy allows,
- manage exam types,
- manage question bank curation,
- view analytics.

Admin paper-setting flow:

```txt
Admin opens Examinations
→ Create Paper
→ Select exam type, subject, grade/class, academic period
→ Choose Class-specific or Grade-wide/Common paper
→ If grade-wide, select the class groups covered
→ Assign lead setter and contributors, or set directly
→ Build manually / use Question Bank / use Leo
→ Approve immediately if allowed or send for review
→ Export/print
```

### 18.3 Student

V1: No direct exam paper access.

V2:

- may view past questions/practice sets if enabled.

### 18.4 Parent

No exam paper access by default.

Parents may later see exam schedules or published results, not confidential papers.

---

## 19. Frontend Pages

### 19.1 Teacher Pages

```txt
/teacher/examinations
/teacher/examinations/new
/teacher/examinations/[examPaperId]
/teacher/examinations/[examPaperId]/builder
/teacher/examinations/[examPaperId]/preview
/teacher/examinations/[examPaperId]/export
/teacher/question-bank
/teacher/question-bank/[questionId]
```

### 19.2 Admin / Academic Head Pages

```txt
/admin/examinations
/admin/examinations/review
/admin/examinations/[examPaperId]/review
/admin/question-bank
/admin/examination-settings
/admin/examination-analytics
```

### 19.3 Student Pages — V2

```txt
/student/past-questions
/student/exam-practice
```

---

## 20. UI Requirements

The UI must match the premium EduSentrix platform style.

Use existing premium design patterns:

- glass cards,
- dark premium surfaces,
- gradient accents,
- polished empty states,
- consistent badges,
- responsive layout,
- smooth modals/drawers,
- Sonner toasts,
- confirmation dialogs.

### 20.1 Required Components

The exam builder must use platform-standard components:

```txt
PremiumSelect / PremiumDropdown
Custom Date Picker
Card
Button
Badge
ResponsiveModal / Drawer
Textarea
Input
File Upload / UploadThing integration
Skeleton states
Empty states
```

Do not use raw `<select>` or rough unstyled form elements in final UI.

### 20.2 Builder UX

Exam paper builder should have:

- paper metadata panel,
- section list,
- question list,
- question editor drawer/modal,
- marks summary,
- total marks validation,
- AI generation panel,
- question bank picker,
- preview button,
- export button.

### 20.3 Question Editor UX

Question editor must dynamically change based on question type.

For MCQ:

- prompt,
- options,
- number of choices,
- correct answer,
- marks,
- explanation.

For essay/structured:

- prompt,
- marks,
- subquestions,
- expected answer,
- marking guide,
- attachments.

---

## 21. Backend API Endpoints

### 21.1 Exam Types

```txt
GET    /api/examinations/exam-types
POST   /api/examinations/exam-types
PATCH  /api/examinations/exam-types/:id
DELETE /api/examinations/exam-types/:id
```

### 21.2 Teacher Exam Papers

```txt
GET    /api/teacher/examinations
POST   /api/teacher/examinations
GET    /api/teacher/examinations/:examPaperId
PATCH  /api/teacher/examinations/:examPaperId
DELETE /api/teacher/examinations/:examPaperId
POST   /api/teacher/examinations/:examPaperId/submit
POST   /api/teacher/examinations/:examPaperId/complete
```

### 21.3 Sections

```txt
POST   /api/teacher/examinations/:examPaperId/sections
PATCH  /api/teacher/examination-sections/:sectionId
DELETE /api/teacher/examination-sections/:sectionId
POST   /api/teacher/examinations/:examPaperId/sections/reorder
```

### 21.4 Questions

```txt
POST   /api/teacher/examinations/:examPaperId/questions
PATCH  /api/teacher/examination-questions/:questionId
DELETE /api/teacher/examination-questions/:questionId
POST   /api/teacher/examinations/:examPaperId/questions/reorder
POST   /api/teacher/examination-questions/:questionId/attachments
DELETE /api/teacher/examination-question-attachments/:attachmentId
```

### 21.5 Review

```txt
GET    /api/admin/examinations/review
GET    /api/admin/examinations/:examPaperId/review
POST   /api/admin/examinations/:examPaperId/review
```

Review payload:

```ts
{
  decision: "approved" | "needs_revision" | "rejected";
  comment?: string;
}
```

### 21.5A Admin Paper Setting

```txt
GET    /api/admin/examinations
POST   /api/admin/examinations
GET    /api/admin/examinations/:examPaperId
PATCH  /api/admin/examinations/:examPaperId
DELETE /api/admin/examinations/:examPaperId
POST   /api/admin/examinations/:examPaperId/submit
POST   /api/admin/examinations/:examPaperId/approve
POST   /api/admin/examinations/:examPaperId/complete
```

Admin-created papers use the same `ExamPaper`, `ExamPaperSection`, and
`ExamQuestion` models as teacher-created papers. The API must enforce school
scope and must record `createdBy`, `ownerRole`, `setBy`, `leadSetterId`, and
`contributorIds` where applicable.

### 21.6 Question Bank

```txt
GET    /api/question-bank
POST   /api/question-bank
GET    /api/question-bank/:questionId
PATCH  /api/question-bank/:questionId
DELETE /api/question-bank/:questionId
POST   /api/question-bank/:questionId/reuse
POST   /api/question-bank/bulk-add-from-exam/:examPaperId
```

### 21.7 AI / Leo

```txt
POST /api/leo/examinations/generate-questions
POST /api/leo/examinations/check-quality
POST /api/leo/examinations/generate-marking-guide
POST /api/leo/examinations/suggest-difficulty
POST /api/leo/examinations/generate-blueprint
```

### 21.8 Export

```txt
POST /api/teacher/examinations/:examPaperId/export
GET  /api/teacher/examinations/:examPaperId/export/:exportJobId
```

---

## 22. Integration With Existing Modules

### 22.1 Curriculum & Scheme of Work

Exam questions can link to:

- curriculum nodes,
- scheme items,
- coverage status,
- term/week planning.

AI generation should be able to use covered scheme items for the exam period.

### 22.2 Lesson Notes

Questions can be generated from approved lesson notes.

### 22.3 Lessons

Questions can be generated from published/completed lessons.

### 22.4 Assignments and Quizzes

Future: allow teachers to adapt previous quiz/assignment questions into exam papers.

### 22.5 Results and Reports

After marks/results are entered, update:

- question performance,
- performance difficulty,
- topic weaknesses,
- exam analytics.

### 22.6 Notifications

Notify academic heads/admins when:

- exam paper is submitted,
- paper needs revision,
- paper is approved.

Do not notify students/parents with confidential exam content.

---

## 23. Implementation Phases

### Phase 1 — Core Data Models and Permissions

Build:

- ExamType,
- ExamPaper,
- ExamPaperSection,
- ExamQuestion,
- ExamQuestionAttachment,
- QuestionBankItem,
- ExamPaperReview,
- permissions.

### Phase 2 — Exam Paper Builder

Build teacher-facing builder with:

- paper metadata,
- sections,
- question creation,
- MCQ choices,
- essay/structured questions,
- marks allocation,
- image attachments.

### Phase 3 — PDF Export

Build:

- student question paper PDF,
- answer key PDF,
- marking scheme PDF,
- teacher combined copy.

### Phase 4 — Review Workflow

Build:

- submit for review,
- admin review desk,
- approve/request revision/reject,
- review history.

### Phase 5 — Question Bank

Build:

- save completed questions to bank,
- search/filter bank,
- reuse questions,
- past papers.

### Phase 6 — AI Question Generation

Build:

- AI generator from lessons/scheme/lesson notes,
- difficulty selection,
- teacher review/edit screen,
- add selected questions to paper.

### Phase 7 — Analytics and Difficulty

Build:

- performance-based difficulty,
- question usage history,
- topic weakness analytics,
- exam quality insights.

### Phase 8 — Advanced V2 Features

Build:

- diagram editor,
- diagram labeling questions,
- paper versioning,
- online exams,
- OMR-style answer sheets,
- Word/PDF question import,
- student past question practice.

---

## 24. Completion Verification Checklist

A development task is incomplete unless these checks pass.

### 24.1 Exam Paper Creation

- Teacher can create paper for assigned subject/class.
- Teacher cannot create paper for unauthorized class/subject.
- Exam type is required.
- Academic year/term/class/subject are properly linked.
- Total marks can be calculated from sections/questions.

### 24.2 Question Builder

- MCQ supports configurable number of choices.
- MCQ requires a correct answer when answer key is enabled.
- Essay/structured questions support marks and marking guide.
- Subquestions correctly contribute to total marks.
- Questions can include image/diagram attachments.
- Attachments appear correctly in preview and PDF export.

### 24.3 AI Generation

- AI can generate draft questions from selected sources.
- AI output is editable before insertion.
- AI content is never auto-published or auto-approved.
- Difficulty selection affects generation request.
- Generated questions can be added to paper.

### 24.4 Review Workflow

- Teacher can submit paper for review.
- Admin/academic head can approve/request revision/reject.
- Request revision requires a comment.
- Rejected papers cannot be printed as approved papers.
- Approved papers can be exported/printed.
- Review history is visible.

### 24.5 Question Bank

- Completed exam questions can be saved to Question Bank.
- Question Bank items are school-owned, not teacher-owned.
- Creator/original teacher metadata is preserved.
- Questions can be searched and reused.
- Used count and last-used metadata update.

### 24.6 PDF Export

- Student copy excludes answers.
- Student copy excludes answer spaces by default.
- Student copy assumes answers are written in a separate answer booklet.
- Answer key includes correct MCQ answers.
- Marking scheme includes expected answers/marking guides.
- School logo/name and exam metadata display correctly.
- Question images/diagrams render correctly.
- Essay answer spaces render when enabled.

### 24.7 Security

- Students cannot access draft/approved confidential exam papers.
- Parents cannot access confidential exam papers.
- Teachers cannot access other teachers’ draft papers unless allowed.
- Teachers cannot set grade-wide/common papers unless assigned as lead setter/contributor or granted permission.
- Admins/academic heads can set centralized papers and assign lead setters/contributors.
- Admin review routes require proper permissions.
- AI usage respects school/user limits.

### 24.8 UI Consistency

- UI uses premium EduSentrix components.
- No raw unstyled select fields in final UI.
- Custom date picker is used for exam dates.
- Empty states, loading states, and toasts are present.
- Builder is responsive.

---

## 25. Final Product Positioning

This module should be positioned as:

```txt
Smart Examinations & Question Bank
```

Value proposition:

```txt
Create printable exams, generate AI-assisted questions from completed lessons, approve papers, and build a reusable school-owned question bank.
```

This module strengthens EduSentrix because it completes the academic cycle:

```txt
Scheme of Work tells what should be taught.
Lesson Notes plan how it is taught.
Lessons help students learn it.
Examinations test whether students understood it.
Question Bank preserves institutional knowledge.
AI helps teachers create better papers faster.
Analytics improves future teaching.
```
