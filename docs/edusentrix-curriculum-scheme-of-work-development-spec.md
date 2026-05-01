# EduSentrix Curriculum & Scheme of Work Module — Development Spec

## 1. Document Purpose

This specification defines the **Curriculum & Scheme of Work** module for EduSentrix.

The module introduces a structured academic planning layer that connects school curriculum selection, termly scheme of work planning, lesson notes, lessons, assignments, assessments, and curriculum coverage analytics.

This document is intended for:

- software engineers,
- AI coding agents,
- product designers,
- backend developers,
- frontend developers,
- QA/test engineers.

The implementation must be modular, scalable, multi-tenant, and consistent with EduSentrix’s existing premium UI/UX direction.

---

## 2. Product Context

EduSentrix already supports curriculum selection during school setup.

Currently, that curriculum selection mainly controls the **Lesson Note wizard behavior**, such as:

- which lesson note template is loaded,
- which labels appear,
- which hints appear,
- which examples appear,
- which optional fields appear,
- which validation rules apply.

This must continue.

The new module expands curriculum support from simple wizard configuration into a full academic planning framework.

The new architecture should become:

```txt
School Curriculum Setting
→ Curriculum Framework
→ Scheme of Work
→ Lesson Notes
→ Lessons
→ Flashcards / Assignments / Assessments
→ Coverage Analytics
```

---

## 3. Core Product Principle

The **Curriculum & Scheme of Work** module must not break or replace the existing Lesson Note module.

The relationship should be:

```txt
Curriculum Framework = official or school-defined academic structure
Scheme of Work = termly teaching plan
Lesson Notes = teacher planning and preparation
Lessons = student-facing learning and delivery layer
Coverage = planned vs taught academic progress
```

The correct flow is:

```txt
Curriculum selected at school setup
↓
Curriculum framework becomes available
↓
Academic head/admin/teacher creates a scheme of work
↓
Scheme is reviewed and approved
↓
Teacher links lesson notes to scheme items
↓
Lessons are generated from lesson notes
↓
Flashcards, resources, assignments, and assessments are published
↓
Coverage analytics are updated
```

Do not bypass Lesson Notes.

Correct:

```txt
Scheme of Work → Lesson Note → Lesson
```

Wrong:

```txt
Scheme of Work → Lesson
```

At least for the current EduSentrix architecture, Lessons must continue to feed from Lesson Notes.

---

## 4. Key Requirement: Do Not Break Existing Lesson Notes

Before implementation, engineers or AI agents must verify the existing Lesson Note module.

They must inspect:

- existing Lesson Note models,
- existing Lesson Note APIs,
- current wizard flow,
- existing wizard UI components,
- how subject and class group context are detected,
- how grade is inferred from class group,
- how curriculum presets are resolved,
- existing template types,
- existing lesson note status workflow,
- existing approval/review workflow if any,
- existing permissions,
- existing links to teacher, subject, grade, class group, term, and academic year,
- existing storage format for lesson note fields.

The new module must integrate with the existing Lesson Note module through **optional links**, not destructive schema changes.

Existing lesson notes must continue working even if no Scheme of Work exists.

---

## 5. Current Lesson Note Behavior to Preserve

The Lesson Note module currently knows the context for which the lesson note is being created:

```txt
Teacher
→ Assigned subject
→ Class group
→ Grade/level
→ Curriculum
→ Correct lesson note wizard preset
```

This behavior must continue.

Teachers should not manually choose:

- “Primary template”,
- “JHS template”,
- “KG template”,
- “NaCCA variant”,
- “Classic variant”.

The system must infer this automatically from:

- `schoolId`,
- `curriculumId`,
- `teacherId`,
- `subjectId`,
- `classGroupId`,
- `gradeId`,
- `educationLevel`,
- academic year,
- term.

The existing Lesson Note wizard look and feel must not change.

Enhancements should be additive and contextual only.

---

## 6. Curriculum and Template Clarification

For schools using the NaCCA curriculum, Primary and JHS lesson notes are not fundamentally separate templates. They can use the same **NaCCA 3-Phase Lesson Note** base, with different variants.

Recommended template architecture:

```txt
Lesson Note Templates

1. NaCCA 3-Phase Lesson Note
   - Primary variant
   - JHS variant

2. Classic Lesson Note
   - General variant
   - Primary variant
   - JHS variant

3. Early Years Activity Plan
   - Creche variant
   - Nursery variant
   - KG1 variant
   - KG2 variant

4. Custom School Template
```

The Curriculum & Scheme of Work module must not create a duplicate lesson note wizard. It only provides structured academic planning data that the existing wizard can optionally consume.

---

## 7. Module Name and Positioning

Recommended visible module name:

```txt
Curriculum & Scheme of Work
```

Alternative shorter sidebar label:

```txt
Curriculum
```

Recommended navigation grouping:

```txt
Academics
 ├── Subjects
 ├── Curriculum & Scheme of Work
 ├── Lesson Notes
 ├── Lessons
 ├── Assignments
 ├── Assessments
 └── Reports
```

The module should be positioned as:

> Plan what will be taught, align lesson notes to the curriculum, and track academic coverage across terms.

---

## 8. Goals

The module should allow schools to:

1. Store or reference curriculum frameworks.
2. Create termly schemes of work.
3. Allow teachers to create scheme drafts.
4. Allow academic heads/admins to review and approve schemes.
5. Link lesson notes to scheme items.
6. Track what has been planned, taught, skipped, moved, or completed.
7. Provide curriculum coverage analytics.
8. Support imports from CSV/Excel in earlier phases.
9. Support PDF/AI-assisted extraction in later phases.
10. Keep full manual CRUD support at all times.

---

## 9. Non-Goals

The module should not initially become:

- a textbook hosting platform,
- a full content marketplace,
- a replacement for Lesson Notes,
- a replacement for Lessons,
- a compulsory dependency for existing lesson note creation,
- a giant PDF repository,
- a public curriculum piracy tool.

The goal is structured academic planning, not uncontrolled content storage.

---

## 10. Core Concepts

### 10.1 School Curriculum Setting

This already exists during school setup.

It answers:

```txt
Which curriculum does this school run?
```

Examples:

- NaCCA,
- Cambridge,
- Montessori-inspired,
- British,
- American,
- Custom.

This setting currently controls Lesson Note presets.

In the new system, it should also determine which curriculum framework and scheme-of-work options are available.

---

### 10.2 Curriculum Framework

The Curriculum Framework is the structured academic backbone.

It answers:

```txt
What subjects, strands, sub-strands, content standards, indicators, competencies, and objectives exist in this curriculum?
```

Example:

```txt
NaCCA
→ Basic 5
→ Science
→ Strand
→ Sub-strand
→ Content Standard
→ Indicator
```

The system should support national, international, and custom curriculum frameworks.

---

### 10.3 Scheme of Work

A Scheme of Work is the school’s termly teaching plan.

It answers:

```txt
What will be taught, in which term, in which week, for which subject and class/grade?
```

Example:

```txt
JHS 1 Integrated Science - Term 1
Week 1: Introduction to Science
Week 2: Laboratory Safety
Week 3: States of Matter
Week 4: Properties of Matter
```

A Scheme of Work belongs to a school and may be created by an admin, academic head, department head, or subject teacher.

---

### 10.4 Scheme Item

A Scheme Item is one row or teaching block inside a Scheme of Work.

It may include:

- week number,
- topic,
- subtopic,
- strand,
- sub-strand,
- content standard,
- indicator,
- learning objectives,
- teaching resources,
- assessment ideas,
- planned dates,
- coverage status.

---

### 10.5 Coverage

Coverage tracks whether planned curriculum items have actually been taught or addressed.

Coverage states include:

```txt
Not Started
In Progress
Covered
Skipped
Moved
Needs Review
```

Coverage should initially be confirmed manually. Later, it may be inferred from approved/taught lesson notes, timetable data, published lessons, assignments, and assessments.

---

## 11. User Roles

### 11.1 Teacher

A teacher can:

- view approved/active schemes for assigned subjects/classes,
- create scheme drafts if enabled by school settings,
- edit own draft schemes,
- submit schemes for review,
- link lesson notes to scheme items,
- view coverage for assigned classes/subjects,
- suggest item status updates,
- create lesson notes from scheme items.

### 11.2 Academic Head / Department Head

An academic head can:

- create schemes,
- review submitted schemes,
- approve schemes,
- request revisions,
- reject schemes,
- activate schemes,
- view coverage reports,
- monitor teachers’ planning progress.

### 11.3 School Admin

A school admin can:

- manage all schemes,
- manage curriculum settings,
- activate/archive schemes,
- configure approval workflows,
- configure teacher scheme permissions,
- import schemes,
- view school-wide reports.

### 11.4 Super Admin / Platform Admin

A platform admin may:

- manage global curriculum framework templates,
- seed NaCCA or other curriculum structures,
- manage versioned curriculum frameworks,
- support schools with setup.

Platform admin features may be delayed depending on product priority.

---

## 12. Permissions

Use EduSentrix’s existing RBAC/permission system.

Recommended permissions:

```txt
curriculumFramework.read
curriculumFramework.manage

schemeOfWork.read
schemeOfWork.create
schemeOfWork.update
schemeOfWork.delete
schemeOfWork.submit
schemeOfWork.review
schemeOfWork.approve
schemeOfWork.activate
schemeOfWork.archive
schemeOfWork.duplicate
schemeOfWork.export

schemeItem.create
schemeItem.update
schemeItem.delete
schemeItem.reorder
schemeItem.updateCoverage

schemeImport.upload
schemeImport.review
schemeImport.confirm
schemeImport.cancel

coverage.view
coverage.update
coverage.reports.view

lessonNoteSchemeLink.create
lessonNoteSchemeLink.remove
```

Access rules:

- Teachers can only manage schemes for assigned subjects/class groups unless granted broader permissions.
- Academic heads can manage schemes within their assigned department/level if department scoping exists.
- School admins can manage all school schemes.
- Platform admins can manage global framework templates.

---

## 13. School-Level Settings

Add school-level academic planning settings.

```ts
type AcademicPlanningSettings = {
  schoolId: string;

  enableSchemeOfWork: boolean;
  requireSchemeLinkForLessonNotes: boolean;

  allowTeacherSchemeCreation: boolean;
  requireSchemeApproval: boolean;

  allowSchemeImport: boolean;
  allowPdfSchemeImport: boolean;
  allowAiSchemeDrafting: boolean;

  defaultSchemeApprovalRole: "school_admin" | "academic_head" | "department_head";

  coverageUpdateMode: "manual" | "suggested" | "automatic";

  createdAt: Date;
  updatedAt: Date;
};
```

Recommended defaults:

```txt
enableSchemeOfWork: true for new schools, false or opt-in for existing schools
requireSchemeLinkForLessonNotes: false
allowTeacherSchemeCreation: true
requireSchemeApproval: true
allowSchemeImport: true
allowPdfSchemeImport: false in V1
allowAiSchemeDrafting: false in V1
coverageUpdateMode: manual or suggested
```

Important:

`requireSchemeLinkForLessonNotes` must default to `false` to avoid breaking existing lesson note workflows.

---

## 14. Backend Data Models

The exact implementation can use Mongoose models because EduSentrix uses MongoDB/Mongoose.

All models must include `schoolId` for multi-tenancy where applicable.

All queries must be scoped by `schoolId` unless the model is intentionally global.

---

### 14.1 Curriculum

Represents a curriculum family or framework.

```ts
type Curriculum = {
  _id: string;

  name: string; // e.g. NaCCA Standards-Based Curriculum
  country?: string; // Ghana
  type: "national" | "international" | "custom";
  version?: string; // e.g. 2019, CCP, school-custom-2026

  description?: string;
  status: "active" | "archived";

  isGlobal: boolean;
  schoolId?: string; // present for school-specific custom curriculum

  createdBy?: string;

  createdAt: Date;
  updatedAt: Date;
};
```

Notes:

- Global curricula can be seeded by platform admin.
- School-specific curricula can be created later.

---

### 14.2 CurriculumSubject

Represents a subject or learning area within a curriculum.

```ts
type CurriculumSubject = {
  _id: string;

  curriculumId: string;
  schoolId?: string;

  name: string; // Mathematics, Science, Language & Literacy
  code?: string;

  educationLevel: "early_years" | "primary" | "jhs" | "shs" | "other";
  gradeIds?: string[];

  status: "active" | "archived";
  order: number;

  createdAt: Date;
  updatedAt: Date;
};
```

---

### 14.3 CurriculumNode

Represents hierarchical curriculum structure.

```ts
type CurriculumNode = {
  _id: string;

  curriculumId: string;
  curriculumSubjectId: string;
  schoolId?: string;

  parentId?: string;

  type:
    | "strand"
    | "sub_strand"
    | "content_standard"
    | "indicator"
    | "objective"
    | "competency"
    | "assessment_idea"
    | "resource_suggestion";

  code?: string;
  title: string;
  description?: string;

  gradeId?: string;
  educationLevel?: "early_years" | "primary" | "jhs" | "shs" | "other";

  order: number;
  status: "active" | "archived";

  metadata?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
};
```

This supports different curriculum structures without hardcoding only NaCCA.

---

### 14.4 SchemeOfWork

Represents a termly scheme of work.

```ts
type SchemeOfWork = {
  _id: string;
  schoolId: string;

  curriculumId: string;
  academicYearId: string;
  termId: string;

  gradeId: string;
  classGroupId?: string;
  subjectId: string;

  title: string;
  description?: string;

  createdBy: string;
  submittedBy?: string;
  approvedBy?: string;

  status:
    | "draft"
    | "submitted"
    | "needs_revision"
    | "approved"
    | "active"
    | "archived"
    | "rejected";

  sourceType:
    | "manual"
    | "csv_import"
    | "excel_import"
    | "pdf_import"
    | "ai_generated"
    | "copied";

  sourceFileUrl?: string;
  sourceFileKey?: string;

  submittedAt?: Date;
  approvedAt?: Date;
  activatedAt?: Date;
  archivedAt?: Date;

  version: number;
  copiedFromSchemeId?: string;

  notes?: string;

  createdAt: Date;
  updatedAt: Date;
};
```

Important indexes:

```txt
schoolId + academicYearId + termId + subjectId + gradeId
schoolId + classGroupId + subjectId + status
schoolId + status
```

---

### 14.5 SchemeItem

Represents one teaching block inside a scheme.

```ts
type SchemeItem = {
  _id: string;
  schoolId: string;
  schemeId: string;

  weekNumber: number;
  lessonOrder?: number;

  plannedStartDate?: Date;
  plannedEndDate?: Date;

  topic: string;
  subtopic?: string;

  strand?: string;
  subStrand?: string;
  contentStandard?: string;
  indicator?: string;

  curriculumNodeIds?: string[];

  learningObjectives: string[];
  coreCompetencies?: string[];
  teachingResources?: string[];
  assessmentIdeas?: string[];

  notes?: string;

  status:
    | "not_started"
    | "in_progress"
    | "covered"
    | "skipped"
    | "moved"
    | "needs_review";

  linkedLessonNoteIds?: string[];
  linkedLessonIds?: string[];
  linkedAssignmentIds?: string[];
  linkedAssessmentIds?: string[];

  coverageUpdatedBy?: string;
  coverageUpdatedAt?: Date;
  coverageNote?: string;

  order: number;

  createdAt: Date;
  updatedAt: Date;
};
```

Important indexes:

```txt
schoolId + schemeId
schoolId + schemeId + weekNumber
schoolId + status
```

---

### 14.6 SchemeReview

Stores review/approval activity.

```ts
type SchemeReview = {
  _id: string;
  schoolId: string;
  schemeId: string;

  reviewerId: string;

  status: "approved" | "needs_revision" | "rejected";
  comment?: string;

  createdAt: Date;
};
```

---

### 14.7 SchemeImportJob

Tracks import jobs from CSV/Excel/PDF/AI.

```ts
type SchemeImportJob = {
  _id: string;
  schoolId: string;

  uploadedBy: string;

  sourceType: "csv" | "excel" | "pdf" | "docx" | "manual_paste" | "ai";
  fileUrl?: string;
  fileKey?: string;
  fileName?: string;

  curriculumId?: string;
  academicYearId?: string;
  termId?: string;
  gradeId?: string;
  classGroupId?: string;
  subjectId?: string;

  status:
    | "uploaded"
    | "processing"
    | "parsed"
    | "needs_review"
    | "confirmed"
    | "failed"
    | "cancelled";

  parsedRows?: SchemeImportParsedRow[];
  errorMessage?: string;

  createdSchemeId?: string;

  createdAt: Date;
  updatedAt: Date;
};

type SchemeImportParsedRow = {
  rowNumber: number;

  weekNumber?: number;
  topic?: string;
  subtopic?: string;
  strand?: string;
  subStrand?: string;
  contentStandard?: string;
  indicator?: string;
  learningObjectives?: string[];
  teachingResources?: string[];
  assessmentIdeas?: string[];

  confidence?: "high" | "medium" | "low";
  warnings?: string[];
  errors?: string[];
};
```

---

### 14.8 LessonNote Integration Fields

Do not rewrite the LessonNote model blindly.

After verifying the existing model, add optional fields only if missing:

```ts
type LessonNoteSchemeFields = {
  schemeId?: string;
  schemeItemIds?: string[];
};
```

Rules:

- These fields must be optional.
- Existing lesson notes must remain valid.
- Existing Lesson Note APIs must continue to work.
- Lesson Note creation must not require a scheme unless school settings explicitly require it.

---

### 14.9 Lesson Integration Fields

The Lessons module should inherit scheme links from the source Lesson Note where possible.

```ts
type LessonSchemeFields = {
  schemeId?: string;
  schemeItemIds?: string[];
};
```

---

## 15. Backend API Design

Base route recommendation:

```txt
/api/curriculum
/api/schemes
/api/scheme-imports
/api/coverage
```

Use existing EduSentrix authentication and school scoping middleware.

All write actions must verify permissions.

---

### 15.1 Curriculum Framework APIs

```txt
GET    /api/curricula
GET    /api/curricula/:curriculumId
GET    /api/curricula/:curriculumId/subjects
GET    /api/curriculum-subjects/:subjectId/nodes
GET    /api/curriculum-nodes/search
```

Admin/platform-only APIs:

```txt
POST   /api/curricula
PATCH  /api/curricula/:curriculumId
POST   /api/curriculum-subjects
PATCH  /api/curriculum-subjects/:subjectId
POST   /api/curriculum-nodes
PATCH  /api/curriculum-nodes/:nodeId
DELETE /api/curriculum-nodes/:nodeId
```

---

### 15.2 Scheme of Work APIs

```txt
GET    /api/schemes
POST   /api/schemes
GET    /api/schemes/:schemeId
PATCH  /api/schemes/:schemeId
DELETE /api/schemes/:schemeId
POST   /api/schemes/:schemeId/duplicate
POST   /api/schemes/:schemeId/submit
POST   /api/schemes/:schemeId/review
POST   /api/schemes/:schemeId/activate
POST   /api/schemes/:schemeId/archive
GET    /api/schemes/:schemeId/export
```

Query filters for `GET /api/schemes`:

```txt
academicYearId
termId
gradeId
classGroupId
subjectId
status
createdBy
search
page
limit
```

---

### 15.3 Scheme Item APIs

```txt
GET    /api/schemes/:schemeId/items
POST   /api/schemes/:schemeId/items
PATCH  /api/scheme-items/:itemId
DELETE /api/scheme-items/:itemId
POST   /api/schemes/:schemeId/items/reorder
PATCH  /api/scheme-items/:itemId/coverage
```

Coverage update payload:

```ts
type UpdateCoveragePayload = {
  status: "not_started" | "in_progress" | "covered" | "skipped" | "moved" | "needs_review";
  coverageNote?: string;
};
```

---

### 15.4 Scheme Import APIs

V1/V2 import APIs:

```txt
POST   /api/scheme-imports/upload
GET    /api/scheme-imports/:importJobId
PATCH  /api/scheme-imports/:importJobId/parsed-rows
POST   /api/scheme-imports/:importJobId/confirm
POST   /api/scheme-imports/:importJobId/cancel
```

V1 should support CSV/Excel first.

V2 should support PDF parsing and AI extraction.

No parsed import should become active automatically.

All imports must produce an editable preview first.

---

### 15.5 Lesson Note Link APIs

```txt
POST   /api/lesson-notes/:lessonNoteId/link-scheme-items
DELETE /api/lesson-notes/:lessonNoteId/link-scheme-items/:schemeItemId
GET    /api/lesson-notes/suggested-scheme-items
```

Suggested scheme items query:

```txt
subjectId
classGroupId
gradeId
academicYearId
termId
weekNumber
search
```

This endpoint powers the existing Lesson Note wizard without forcing a redesign.

---

### 15.6 Coverage Analytics APIs

```txt
GET /api/coverage/summary
GET /api/coverage/by-subject
GET /api/coverage/by-class-group
GET /api/coverage/by-teacher
GET /api/coverage/scheme/:schemeId
```

Summary response should include:

```ts
type CoverageSummary = {
  totalItems: number;
  notStarted: number;
  inProgress: number;
  covered: number;
  skipped: number;
  moved: number;
  needsReview: number;
  coveragePercentage: number;
};
```

---

## 16. Import Workflows

### 16.1 Manual Creation

Manual CRUD is required from V1.

Flow:

```txt
Create Scheme
→ Add scheme items manually
→ Save draft
→ Submit for review
→ Academic head/admin reviews
→ Approve
→ Activate
```

Manual creation must support:

- adding rows,
- editing rows,
- deleting rows,
- reordering rows,
- copying rows,
- duplicating schemes,
- saving drafts.

---

### 16.2 CSV/Excel Import

Recommended for Phase 2.

Flow:

```txt
Upload CSV/Excel
→ Parse rows
→ Show editable preview
→ Highlight validation errors
→ User fixes rows
→ Save as draft scheme
→ Submit for review
→ Approve/activate
```

Required preview columns:

```txt
Week
Topic
Subtopic
Strand
Sub-strand
Content Standard
Indicator
Objectives
Resources
Assessment Ideas
Warnings/Errors
```

Do not create active schemes directly from imports.

---

### 16.3 PDF Import

Recommended for Phase 3/V2.

Flow:

```txt
Upload PDF
→ User selects curriculum, grade, subject, term
→ System extracts text/tables
→ System identifies possible scheme rows
→ System assigns confidence scores
→ Editable preview table is shown
→ User reviews and edits
→ Save as draft scheme
→ Submit for approval
```

Confidence levels:

```txt
High
Medium
Low
Needs Review
```

Rows with low confidence must be visually highlighted.

PDF extraction should not be trusted blindly.

---

### 16.4 AI-Assisted Drafting

Recommended for V2/V3.

Flow:

```txt
User selects curriculum, subject, grade, term, number of weeks
→ Leo drafts scheme of work
→ User reviews table
→ User edits
→ Save as draft
→ Submit for approval
```

Leo must never directly activate a scheme.

Human review is mandatory.

---

## 17. Approval Workflow

### 17.1 Teacher-Created Scheme

```txt
Teacher creates draft
↓
Teacher submits
↓
Academic Head/Admin reviews
↓
Reviewer approves, rejects, or requests revision
↓
If approved, scheme can be activated
```

### 17.2 Admin-Created Scheme

```txt
Admin creates scheme
↓
Admin may save as draft, approve, or activate depending on permission
```

### 17.3 Revision Flow

```txt
Submitted
→ Needs Revision
→ Teacher edits
→ Submitted again
→ Approved
```

### 17.4 Status Rules

- `draft`: editable by creator and authorized admins.
- `submitted`: locked for creator unless recalled or reviewer requests changes.
- `needs_revision`: editable by creator.
- `approved`: approved but not necessarily active.
- `active`: used by Lesson Notes and coverage tracking.
- `archived`: read-only historical record.
- `rejected`: read-only unless duplicated into new draft.

---

## 18. Lesson Note Integration

### 18.1 Existing Flow Must Continue

Current Lesson Note flow:

```txt
Teacher opens lesson note wizard
→ System detects subject/class group/grade/curriculum
→ Correct wizard preset loads
→ Teacher creates lesson note
```

This must remain functional without schemes.

### 18.2 New Optional Scheme Link

Enhanced flow:

```txt
Teacher opens Lesson Note wizard
→ System detects subject/class group/grade/term
→ System checks for active scheme
→ Suggested scheme items are shown
→ Teacher selects relevant scheme item(s)
→ Topic/objectives/standards/resources can prefill into current wizard fields
→ Teacher continues with same wizard UI
```

### 18.3 UI Rule

Do not redesign the Lesson Note wizard.

Only add contextual section/component:

```txt
Suggested from Scheme of Work
```

or:

```txt
Link this lesson note to a planned curriculum item
```

This section must use the existing premium UI style.

### 18.4 Field Mapping

When a scheme item is selected, map values into lesson note fields where possible:

```txt
SchemeItem.topic → LessonNote.topic
SchemeItem.subtopic → LessonNote.subtopic
SchemeItem.learningObjectives → LessonNote.objectives
SchemeItem.teachingResources → LessonNote.teachingMaterials
SchemeItem.indicator → LessonNote.indicator/curriculum field
SchemeItem.contentStandard → LessonNote.contentStandard field
SchemeItem.coreCompetencies → LessonNote.coreCompetencies field
```

Only prefill empty fields or ask for confirmation before overwriting existing teacher-entered content.

### 18.5 Required Safeguard

Do not require scheme links by default.

`requireSchemeLinkForLessonNotes` must remain configurable and disabled by default.

---

## 19. Lessons Module Integration

The Lessons module should remain built on Lesson Notes.

Flow:

```txt
Scheme Item
↓
Lesson Note
↓
Lesson
↓
Flashcards / Resources / Practice / Assignments
```

When a Lesson is created from a Lesson Note, it should inherit:

- `schemeId`,
- `schemeItemIds`,
- subject,
- class group,
- grade,
- term,
- curriculum references.

This allows Lessons, flashcards, assignments, and analytics to be curriculum-aware without bypassing Lesson Notes.

---

## 20. Coverage Tracking

Coverage must be introduced gradually.

### 20.1 V1 Coverage

Manual or suggested.

Example:

```txt
Teacher links lesson note to scheme item
→ Lesson note is approved/taught
→ System suggests marking item as covered
→ Teacher/Admin confirms
```

### 20.2 V2 Coverage

More automated.

Possible signals:

- Lesson Note approved,
- Lesson Note marked taught,
- Lesson published,
- Timetable entry completed,
- assignment linked,
- assessment linked.

### 20.3 Coverage Dashboard

Show:

- total planned items,
- covered items,
- not started,
- in progress,
- skipped,
- moved,
- needs review,
- coverage percentage.

Views:

```txt
By class group
By subject
By teacher
By term
By scheme
By grade
```

---

## 21. Frontend Pages

The implementation should follow EduSentrix’s premium dashboard style.

All pages must be responsive.

Use existing app layout patterns.

---

### 21.1 Admin / Academic Head Pages

```txt
/admin/academics/curriculum
/admin/academics/schemes
/admin/academics/schemes/new
/admin/academics/schemes/[schemeId]
/admin/academics/schemes/[schemeId]/edit
/admin/academics/schemes/[schemeId]/review
/admin/academics/schemes/import
/admin/academics/coverage
```

---

### 21.2 Teacher Pages

```txt
/teacher/schemes
/teacher/schemes/new
/teacher/schemes/[schemeId]
/teacher/schemes/[schemeId]/edit
/teacher/schemes/import
/teacher/coverage
```

Teacher pages must only show assigned subjects/classes unless permissions allow more.

---

### 21.3 Lesson Note Wizard Integration UI

Inside existing Lesson Note wizard:

```txt
Suggested from Scheme of Work
```

Component behavior:

- show active scheme item suggestions for the class/subject/term,
- allow search/filter,
- allow selecting one or multiple scheme items,
- show topic, week, objectives, and indicator summary,
- prefill fields only after user confirms selection,
- do not change the wizard layout structure.

---

## 22. Frontend Components

Required components:

```txt
SchemeListView
SchemeStatusBadge
SchemeFilters
SchemeCreateForm
SchemeItemTable
SchemeItemRowEditor
SchemeItemDrawer
SchemeReviewPanel
SchemeApprovalTimeline
SchemeImportUploader
SchemeImportPreviewTable
SchemeCoverageCards
CoverageProgressBar
CoverageBySubjectChart
CoverageByClassTable
SuggestedSchemeItemsPicker
CurriculumNodeSelector
SchemeDuplicateDialog
SchemeArchiveDialog
```

---

## 23. UI/UX Requirements

EduSentrix has a premium UI direction. This module must follow it strictly.

### 23.1 Premium Feel

The UI must feel:

- clean,
- modern,
- spacious,
- professional,
- school-admin friendly,
- not cluttered,
- consistent with the current EduSentrix dashboard.

Use:

- premium cards,
- soft shadows,
- rounded corners,
- subtle gradients where already used,
- clear spacing,
- readable typography,
- animated transitions only where useful,
- clear status badges.

### 23.2 Required Custom Components

Engineers must use EduSentrix’s existing/custom UI components where available.

Specifically:

1. Use the **custom EduSentrix Date Picker** for all date fields.
2. Use the **premium EduSentrix Dropdown / Select** component for all select fields.
3. Use existing premium input, textarea, button, modal/drawer, table, badge, and card components.
4. Do not introduce a random third-party date picker or select component directly into this module.
5. If a missing feature is needed in the custom component, extend the existing custom component instead of replacing it.

Required fields that must use the custom date picker:

- planned start date,
- planned end date,
- academic year date fields where shown,
- import metadata dates if editable,
- coverage update dates if manually editable.

Required fields that must use the premium dropdown:

- curriculum,
- academic year,
- term,
- grade,
- class group,
- subject,
- status,
- source type,
- week number where rendered as select,
- coverage status,
- approval action,
- education level.

### 23.3 Do Not Clutter the UI

Use progressive disclosure.

Default view should show:

- week,
- topic,
- subtopic,
- objectives summary,
- status,
- actions.

Details like content standard, indicator, resources, and assessment ideas can be shown in:

- drawer,
- expandable row,
- detail panel,
- edit modal.

### 23.4 Import Preview UX

The import preview table must be clear and safe.

Rows should show:

- errors,
- warnings,
- confidence score,
- editable cells,
- row actions,
- skip row option.

Low-confidence rows must be highlighted.

Users must explicitly confirm before creating a draft scheme.

---

## 24. React Query Hooks

Use TanStack React Query with native fetch according to EduSentrix conventions.

Recommended hooks:

```ts
useSchemes(filters)
useScheme(schemeId)
useCreateScheme()
useUpdateScheme()
useDeleteScheme()
useSubmitScheme()
useReviewScheme()
useActivateScheme()
useArchiveScheme()
useDuplicateScheme()

useSchemeItems(schemeId)
useCreateSchemeItem()
useUpdateSchemeItem()
useDeleteSchemeItem()
useReorderSchemeItems()
useUpdateSchemeItemCoverage()

useSchemeImportJob(importJobId)
useUploadSchemeImport()
useUpdateParsedImportRows()
useConfirmSchemeImport()
useCancelSchemeImport()

useCoverageSummary(filters)
useCoverageBySubject(filters)
useCoverageByClassGroup(filters)

useSuggestedSchemeItemsForLessonNote(params)
useLinkLessonNoteToSchemeItems()
useUnlinkLessonNoteSchemeItem()
```

React Query requirements:

- invalidate scheme lists after create/update/delete,
- invalidate scheme detail after item updates,
- invalidate coverage after coverage updates,
- invalidate lesson note detail after linking scheme items,
- handle loading, error, empty, and success states consistently,
- use existing toast/notification provider for success/error feedback.

---

## 25. Validation Rules

Use Zod schemas on frontend where applicable and backend validation as final authority.

### 25.1 Scheme Validation

Required:

- curriculumId,
- academicYearId,
- termId,
- gradeId,
- subjectId,
- title.

Optional:

- classGroupId,
- description.

Rules:

- active scheme should not conflict with another active scheme for same school + academic year + term + subject + grade + class group unless versioning/parallel schemes are intentionally allowed.
- teachers cannot create schemes for unassigned subjects/classes unless permitted.

### 25.2 Scheme Item Validation

Required:

- schemeId,
- weekNumber,
- topic,
- at least one learning objective unless school settings allow blank objectives.

Rules:

- weekNumber must be positive.
- plannedEndDate cannot be before plannedStartDate.
- order must be unique within scheme or auto-normalized.
- status must be one of allowed statuses.

### 25.3 Import Validation

Each imported row must be validated.

Row errors should not crash the import.

Invalid rows should be marked for correction or skipping.

---

## 26. Development Phases

## Phase 0: Discovery and Existing Module Verification

Before coding, verify the current Lesson Note module.

Deliverables:

- current LessonNote model review,
- current LessonNote API review,
- current wizard flow review,
- current UI component inventory,
- list of fields available for mapping,
- list of missing fields,
- integration plan that does not break existing behavior.

Acceptance criteria:

- engineers can explain how Lesson Notes currently work,
- scheme integration points are identified,
- no destructive migration is planned,
- existing lesson note creation remains unchanged.

---

## Phase 1: Core Scheme of Work Foundation

Build:

- SchemeOfWork model,
- SchemeItem model,
- SchemeReview model,
- AcademicPlanningSettings model or config extension,
- CRUD APIs,
- permissions,
- basic admin/teacher pages,
- manual scheme item management,
- submit/review/approve/activate/archive workflow.

Frontend:

- scheme list,
- scheme creation form,
- scheme detail page,
- scheme item table,
- scheme item editor,
- review panel,
- status badges.

Acceptance criteria:

- teacher can create draft scheme if allowed,
- teacher can submit scheme,
- academic head/admin can approve or request revision,
- approved scheme can be activated,
- active scheme appears in scheme list,
- UI uses custom date picker and premium dropdowns,
- layout matches EduSentrix premium style.

---

## Phase 2: Lesson Note Integration

Build:

- optional scheme fields on LessonNote,
- suggested scheme items endpoint,
- link/unlink APIs,
- existing wizard integration component.

Frontend:

- `SuggestedSchemeItemsPicker`,
- prefill logic,
- link/unlink display on lesson note detail,
- preserve existing wizard look and feel.

Acceptance criteria:

- lesson notes can still be created without a scheme,
- active scheme items are suggested based on subject/class/grade/term,
- selecting a scheme item can prefill topic/objectives/resources,
- existing wizard structure is not redesigned,
- existing lesson notes remain valid.

---

## Phase 3: Coverage Tracking

Build:

- coverage status updates,
- coverage summary APIs,
- coverage dashboards,
- coverage by subject/class/teacher views,
- manual coverage confirmation.

Acceptance criteria:

- users can view coverage percentage,
- users can update scheme item coverage status,
- linked lesson notes contribute to coverage suggestions,
- reports are scoped by school and permissions.

---

## Phase 4: CSV/Excel Import

Build:

- UploadThing or approved upload flow for import files,
- import job model,
- CSV parser,
- Excel parser,
- editable preview table,
- validation warnings/errors,
- confirm import into draft scheme.

Acceptance criteria:

- user uploads CSV/Excel,
- parsed rows appear in editable preview,
- invalid rows show errors,
- user can edit or skip rows,
- confirmation creates draft scheme only,
- scheme still requires review/approval depending on settings.

---

## Phase 5: PDF Import and AI-Assisted Extraction

Build later after manual/import foundation is stable.

Build:

- PDF upload,
- text/table extraction,
- AI-assisted row extraction,
- confidence scoring,
- review table,
- safe draft creation.

Acceptance criteria:

- user uploads PDF,
- platform extracts possible scheme rows,
- rows have confidence scores,
- low-confidence rows are highlighted,
- no active scheme is created without review,
- user confirms before saving draft.

---

## Phase 6: Advanced Curriculum Framework

Build:

- curriculum framework management,
- curriculum subjects,
- curriculum nodes,
- search and selection,
- mapping nodes to scheme items,
- platform-level seeded templates,
- school custom curriculum support.

Acceptance criteria:

- schemes can link to curriculum nodes,
- lesson notes can inherit curriculum node links,
- coverage can be tracked by curriculum node/indicator,
- custom school curriculum can be supported.

---

## Phase 7: Leo Academic Planning Assistant

Build:

- generate scheme draft from curriculum,
- suggest missing objectives,
- recommend pacing,
- identify uncovered topics,
- generate catch-up plan,
- generate revision plan.

Acceptance criteria:

- Leo outputs drafts only,
- human review is mandatory,
- AI output is editable,
- AI actions are logged/auditable.

---

## 27. Error Handling

Backend errors should return consistent response shapes.

Examples:

```ts
type ApiErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
```

Common error codes:

```txt
SCHEME_NOT_FOUND
SCHEME_ITEM_NOT_FOUND
SCHEME_ALREADY_ACTIVE
SCHEME_CONFLICT
INSUFFICIENT_PERMISSION
INVALID_STATUS_TRANSITION
IMPORT_PARSE_FAILED
IMPORT_ROW_VALIDATION_FAILED
LESSON_NOTE_NOT_FOUND
SCHEME_LINK_NOT_ALLOWED
```

Frontend must show user-friendly messages using EduSentrix’s toast/notification system.

---

## 28. Audit Logging

Important actions should be auditable.

Log:

- scheme created,
- scheme updated,
- scheme submitted,
- scheme approved,
- scheme rejected,
- scheme revision requested,
- scheme activated,
- scheme archived,
- import uploaded,
- import confirmed,
- scheme item coverage updated,
- lesson note linked to scheme item,
- lesson note unlinked from scheme item.

Audit log fields:

```ts
type AuditLog = {
  schoolId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
};
```

---

## 29. Security and Multi-Tenancy

Requirements:

- all data must be scoped by `schoolId`,
- never expose another school’s schemes,
- validate user role and permission on every write action,
- teacher access must be limited to assigned subjects/classes unless permission allows broader access,
- file uploads must be validated by type and size,
- imported content must be sanitized,
- AI-generated content must be treated as draft only,
- no PDF/import should overwrite existing active scheme without explicit user action.

---

## 30. Performance Requirements

The scheme item table may grow large, so:

- paginate scheme lists,
- virtualize or paginate large scheme item tables if needed,
- debounce search inputs,
- index common query fields,
- avoid loading all curriculum nodes at once,
- lazy-load expanded details,
- use React Query caching.

---

## 31. Empty States

Provide premium empty states.

Examples:

### No scheme created

```txt
No scheme of work yet
Create a scheme manually, import one, or copy from a previous term.
```

### No active scheme found in Lesson Note wizard

```txt
No active scheme found for this subject and class.
You can still create your lesson note normally.
```

### No coverage data

```txt
Coverage data will appear once lesson notes are linked to scheme items.
```

---

## 32. Success States

Use toast notifications.

Examples:

```txt
Scheme created successfully.
Scheme submitted for review.
Scheme approved successfully.
Scheme activated successfully.
Scheme item linked to lesson note.
Coverage updated.
Import confirmed and draft scheme created.
```

---

## 33. Testing Requirements

### 33.1 Backend Tests

Test:

- scheme creation,
- scheme update,
- scheme deletion/archive,
- scheme submission,
- review transitions,
- invalid status transitions,
- permission checks,
- school scoping,
- scheme item CRUD,
- coverage updates,
- lesson note linking,
- import validation.

### 33.2 Frontend Tests

Test:

- scheme creation form validation,
- premium dropdown behavior,
- custom date picker behavior,
- scheme item editing,
- review flow,
- import preview editing,
- Lesson Note wizard scheme suggestion component,
- empty/loading/error states.

### 33.3 Integration Tests

Test:

```txt
Create scheme → add items → submit → approve → activate → create lesson note → link scheme item → update coverage
```

Test that lesson note creation still works without scheme enabled.

---

## 34. Acceptance Criteria Summary

The module is acceptable when:

1. Schools can create and manage schemes of work.
2. Teachers can create drafts and submit for review if enabled.
3. Academic heads/admins can approve and activate schemes.
4. Scheme items can be linked to existing lesson notes.
5. Existing Lesson Note wizard look and feel remains intact.
6. Lesson notes can still be created without schemes.
7. Coverage analytics works at a basic level.
8. Manual CRUD works fully.
9. CSV/Excel import supports editable preview before saving when implemented.
10. PDF/AI import does not auto-save active schemes when implemented.
11. UI uses custom EduSentrix date picker.
12. UI uses premium EduSentrix dropdown/select.
13. UI follows EduSentrix’s premium dashboard design.
14. All data is school-scoped and permission-protected.
15. All major actions are auditable.

---

## 35. Final Product Direction

This module should make EduSentrix academically intelligent without adding bloat.

The goal is not to dump curriculum PDFs into the system.

The goal is to create a clean planning backbone:

```txt
Curriculum Framework
→ Scheme of Work
→ Lesson Notes
→ Lessons
→ Assignments / Assessments / Flashcards
→ Coverage Analytics
```

The module must feel natural inside EduSentrix, not like a separate app.

The teacher experience should be:

> “EduSentrix already knows my subject, class, grade, and curriculum. It suggests the right scheme items and helps me create aligned lesson notes faster.”

The school leadership experience should be:

> “We can see what was planned, what has been taught, what is behind, and which classes or subjects need attention.”

The technical architecture must remain safe:

- no breaking existing Lesson Notes,
- optional scheme links,
- progressive rollout,
- clean RBAC,
- strict school scoping,
- premium UI consistency.

