# EduSentrix Curriculum & Scheme of Work Module — Gap Report and Recommended Fixes

## Purpose

This document lists the gaps found in the current EduSentrix Curriculum & Scheme of Work implementation when compared against the **EduSentrix Curriculum & Scheme of Work Module — Development Spec**.

It is intended for software engineers and AI coding agents working on the EduSentrix codebase.

The goal is to make the module a reliable academic planning backbone for:

```txt
Curriculum Framework
→ Scheme of Work
→ Lesson Notes
→ Lessons
→ Flashcards / Resources / Assignments / Assessments
→ Coverage Analytics
```

---

## Current Overall Assessment

The module exists and has a strong foundation, but it is currently closer to a **Phase 1 / partial Phase 2 implementation**, not the complete development spec.

The current codebase already includes:

- Scheme of Work models.
- Scheme item models.
- Scheme review model.
- Import job model.
- Curriculum models.
- Teacher scheme pages.
- Admin scheme review page.
- Lesson Note scheme linking.
- Basic coverage summary.
- School-level academic planning settings.
- Import routes for CSV/Excel/PDF-style workflows.
- Early Leo/AI planning hooks.

However, there are gaps in:

- data model completeness,
- academic period linkage,
- approval workflow,
- permissions,
- premium UI compliance,
- date picker usage,
- import richness,
- curriculum framework depth,
- active scheme conflict prevention,
- audit logging,
- coverage analytics,
- and full CRUD features.

---

## Strong Existing Foundations to Preserve

### 1. School Academic Planning Settings

The project already has useful academic planning settings in `SchoolSettings`.

These should be preserved and enforced consistently:

```ts
academicPlanning?: {
  enableSchemeOfWork: boolean;
  requireSchemeLinkForLessonNotes: boolean;
  allowTeacherSchemeCreation: boolean;
  requireSchemeApproval: boolean;
  allowSchemeImport: boolean;
  allowPdfSchemeImport: boolean;
  allowAiSchemeDrafting: boolean;
  defaultSchemeApprovalRole: "school_admin" | "academic_head" | "department_head";
  coverageUpdateMode: "manual" | "suggested" | "automatic";
};
```

### 2. Lesson Note Integration Foundation

The Lesson Note model already includes optional scheme links:

```ts
schemeId?: Types.ObjectId;
schemeItemIds?: Types.ObjectId[];
```

This is correct and should remain optional to avoid breaking existing Lesson Notes.

### 3. Lesson Note Wizard Should Remain Additive

The existing `LessonNoteSchemeLinkPanel` follows the correct idea:

- does not replace the Lesson Note wizard,
- adds optional scheme linking,
- uses premium select components,
- respects the current Lesson Note flow.

This should be preserved and improved.

### 4. Lessons Inherit Scheme Context

The Lessons API already appears to carry `schemeId` and `schemeItemIds` from Lesson Notes into Lessons.

This matches the intended architecture:

```txt
Scheme Item → Lesson Note → Lesson
```

---

# Gap 1 — `SchemeOfWork` Model Is Too Shallow

## Current Gap

The current `SchemeOfWork` model appears to rely on fields such as:

```ts
academicYearLabel?: string;
termLabel?: string;
curriculumId?: ObjectId;
curriculumSubjectId?: ObjectId;
gradeId?: ObjectId;
subjectId?: ObjectId;
ownerTeacherId?: ObjectId;
```

The spec requires stronger academic references and metadata.

## Why This Is a Problem

Using labels instead of real IDs makes it harder to:

- connect schemes to actual academic periods,
- filter by current term,
- avoid duplicate active schemes,
- support academic-year rollover,
- produce accurate coverage reports,
- align Lesson Notes and Lessons to the correct term,
- support future timetable/assessment integrations.

## Recommended Fix

Update `SchemeOfWork` to include:

```ts
type SchemeOfWork = {
  schoolId: ObjectId;

  curriculumId?: ObjectId;
  curriculumSubjectId?: ObjectId;

  academicYearId: ObjectId;
  termId: ObjectId;

  gradeId: ObjectId;
  classGroupId?: ObjectId | null;
  subjectId: ObjectId;

  title: string;
  description?: string;

  ownerTeacherId?: ObjectId | null;
  createdBy: ObjectId;
  submittedBy?: ObjectId | null;
  approvedBy?: ObjectId | null;
  activatedBy?: ObjectId | null;

  sourceType:
    | "manual"
    | "csv_import"
    | "excel_import"
    | "pdf_import"
    | "ai_generated"
    | "copied";

  sourceFileUrl?: string;
  sourceFileKey?: string;

  version: number;
  copiedFromSchemeId?: ObjectId | null;

  status:
    | "draft"
    | "submitted"
    | "needs_revision"
    | "approved"
    | "active"
    | "archived"
    | "rejected";

  createdAt: Date;
  updatedAt: Date;
};
```

Keep `academicYearLabel` and `termLabel` only as optional denormalized display fields if needed.

## Priority

**High**

---

# Gap 2 — Status Workflow Does Not Fully Match the Spec

## Current Gap

Current statuses are closer to:

```ts
"draft" | "in_review" | "approved" | "active" | "archived"
```

The spec expects:

```ts
"draft"
| "submitted"
| "needs_revision"
| "approved"
| "active"
| "archived"
| "rejected"
```

## Why This Is a Problem

The current workflow does not fully support:

- teacher submission,
- request changes,
- resubmission,
- rejection,
- review timeline,
- clear academic head feedback loops.

## Recommended Fix

Replace or map `in_review` to `submitted`.

Add missing statuses:

```ts
type SchemeOfWorkStatus =
  | "draft"
  | "submitted"
  | "needs_revision"
  | "approved"
  | "active"
  | "archived"
  | "rejected";
```

Add review actions:

```txt
POST /api/admin/schemes/:id/review
POST /api/admin/schemes/:id/request-revision
POST /api/admin/schemes/:id/reject
GET  /api/admin/schemes/:id/reviews
```

Preferred generic review endpoint:

```ts
POST /api/admin/schemes/:id/review

Body:
{
  decision: "approved" | "needs_revision" | "rejected";
  comment?: string;
}
```

## Priority

**High**

---

# Gap 3 — `SchemeItem` Model Is Too Limited

## Current Gap

Current `SchemeItem` fields appear to include:

```ts
weekNumber;
sequence;
title;
learningObjective;
notes;
curriculumNodeIds;
suggestedLessonTemplateType;
suggestedDurationMinutes;
status;
coverageStatus;
```

The spec requires richer academic planning fields.

## Why This Is a Problem

The scheme cannot become a true academic backbone if it only stores a title and one objective.

For NaCCA-style planning, each item should support:

- strand,
- sub-strand,
- content standard,
- indicator,
- topic,
- subtopic,
- learning objectives,
- core competencies,
- teaching resources,
- assessment ideas,
- planned dates,
- linked Lesson Notes,
- linked Lessons,
- linked Assignments/Assessments.

Without these, Lesson Notes cannot be meaningfully prefilled from the scheme.

## Recommended Fix

Extend `SchemeItem` like this:

```ts
type SchemeItem = {
  schoolId: ObjectId;
  schemeId: ObjectId;

  weekNumber: number;
  lessonOrder?: number;
  sequence: number;

  topic: string;
  subtopic?: string;
  title?: string;

  strand?: string;
  subStrand?: string;
  contentStandard?: string;
  indicator?: string;

  learningObjectives: string[];
  coreCompetencies?: string[];
  teachingResources?: string[];
  assessmentIdeas?: string[];

  curriculumNodeIds?: ObjectId[];

  plannedStartDate?: Date;
  plannedEndDate?: Date;

  suggestedLessonTemplateType?:
    | "nacca_3_phase"
    | "classic"
    | "early_years_activity_plan"
    | "custom";

  suggestedDurationMinutes?: number;

  status: "not_started" | "in_progress" | "covered" | "skipped" | "moved" | "needs_review";

  coverageStatus: "not_started" | "in_progress" | "covered" | "skipped" | "moved" | "needs_review";

  linkedLessonNoteIds?: ObjectId[];
  linkedLessonIds?: ObjectId[];
  linkedAssignmentIds?: ObjectId[];
  linkedAssessmentIds?: ObjectId[];

  createdAt: Date;
  updatedAt: Date;
};
```

## Priority

**High**

---

# Gap 4 — Teacher Access Control Is Too Loose

## Current Gap

In the teacher scheme update logic, the edit check appears to allow any teacher to edit any draft scheme in the same school:

```ts
function canEditScheme(ctxTeacherId, scheme) {
  return String(scheme.ownerTeacherId) === String(ctxTeacherId) || scheme.status === "draft";
}
```

## Why This Is a Problem

This means Teacher A could edit Teacher B's draft scheme if the scheme is still in draft status.

That is unsafe.

## Recommended Fix

Change the edit logic to:

```ts
function canEditScheme(ctx, scheme) {
  if (ctx.isAdmin || ctx.hasPermission("schemeOfWork.updateAny")) {
    return true;
  }

  return String(scheme.ownerTeacherId) === String(ctx.teacherId);
}
```

Also enforce assigned subject/class access:

```txt
Ordinary teachers may only create/edit schemes for subjects and class groups they are assigned to.
```

## Priority

**Critical / High**

---

# Gap 5 — Teacher Scheme List Is Not Scoped Enough

## Current Gap

The teacher scheme list appears to fetch all schemes for the school first:

```ts
const query = { schoolId: ctx.schoolId };
```

It does not strongly restrict ordinary teachers to:

- their own schemes,
- active schemes for their assigned classes/subjects,
- approved schemes they can use.

## Why This Is a Problem

Teachers may see schemes they should not access.

It also creates clutter in schools with many departments.

## Recommended Fix

Teacher visibility should be:

```txt
Teacher can see:
- own draft/submitted/needs_revision schemes,
- approved/active schemes for assigned subjects/classes,
- broader schemes only if academic head/admin permission exists.
```

Use or extend a helper like:

```txt
src/lib/schemes/teacher-scheme-access.ts
```

Apply the helper consistently across:

- list endpoint,
- detail endpoint,
- update endpoint,
- item creation/update endpoints,
- import confirmation,
- lesson note linking.

## Priority

**High**

---

# Gap 6 — School Settings Are Not Enforced Consistently

## Current Gap

The app has academic planning settings, but scheme creation/import does not appear to consistently enforce:

```ts
enableSchemeOfWork;
allowTeacherSchemeCreation;
requireSchemeApproval;
allowSchemeImport;
allowPdfSchemeImport;
allowAiSchemeDrafting;
```

## Why This Is a Problem

Schools may configure rules, but users may still access actions that should be disabled.

## Recommended Fix

Before scheme creation:

```ts
const settings = await getSchoolSettings(ctx.schoolId);

if (!settings.academicPlanning?.enableSchemeOfWork) {
  return forbidden("Scheme of Work is not enabled for this school.");
}

if (!settings.academicPlanning.allowTeacherSchemeCreation && !ctx.isAdmin) {
  return forbidden("Teacher scheme creation is disabled for this school.");
}
```

Before imports:

```ts
if (!settings.academicPlanning.allowSchemeImport) {
  return forbidden("Scheme import is disabled for this school.");
}

if (fileType === "pdf" && !settings.academicPlanning.allowPdfSchemeImport) {
  return forbidden("PDF scheme import is disabled for this school.");
}
```

Before AI drafting:

```ts
if (!settings.academicPlanning.allowAiSchemeDrafting) {
  return forbidden("AI scheme drafting is disabled for this school.");
}
```

## Priority

**High**

---

# Gap 7 — Admin Review Flow Is Too Basic

## Current Gap

The admin scheme page currently appears to support basic actions:

- approve,
- activate,
- archive.

Missing:

- detailed review page,
- scheme item preview,
- reviewer comments,
- request revision,
- reject,
- approval timeline,
- filtering by status,
- filtering by academic year/term/subject/grade,
- review history.

## Recommended Fix

Add admin pages:

```txt
/admin/academics/schemes
/admin/academics/schemes/[schemeId]
/admin/academics/schemes/[schemeId]/review
/admin/academics/coverage
```

The review page should show:

- scheme metadata,
- teacher/creator,
- subject,
- grade,
- class group,
- academic year,
- term,
- scheme item table,
- review comments,
- previous review history,
- approve,
- request revision,
- reject,
- activate.

## Priority

**High**

---

# Gap 8 — Admin Approval Routes Are Missing Revision/Rejection Support

## Current Gap

Existing admin actions appear to include:

```txt
approve
activate
archive
```

Missing:

```txt
request revision
reject
review history
```

## Recommended Fix

Add:

```txt
POST /api/admin/schemes/:id/review
GET  /api/admin/schemes/:id/reviews
```

Review body:

```ts
{
  decision: "approved" | "needs_revision" | "rejected";
  comment?: string;
}
```

Update scheme status accordingly:

```txt
approved       → approved
needs_revision → needs_revision
rejected       → rejected
```

Create a `SchemeReview` record each time.

## Priority

**High**

---

# Gap 9 — Active Scheme Conflict Prevention Is Missing

## Current Gap

Activation appears to set:

```ts
scheme.status = "active";
```

without strongly checking whether another active scheme exists for the same academic context.

## Why This Is a Problem

A school could accidentally activate multiple schemes for the same:

```txt
school + academic year + term + subject + grade + class group
```

This breaks Lesson Note suggestions and coverage analytics.

## Recommended Fix

Before activation, check:

```ts
const existingActive = await SchemeOfWork.findOne({
  schoolId: scheme.schoolId,
  academicYearId: scheme.academicYearId,
  termId: scheme.termId,
  subjectId: scheme.subjectId,
  gradeId: scheme.gradeId,
  classGroupId: scheme.classGroupId ?? null,
  status: "active",
  _id: { $ne: scheme._id },
});

if (existingActive) {
  return conflict("Another active scheme already exists for this academic context.");
}
```

Alternative: allow admin to archive existing scheme during activation with explicit confirmation.

## Priority

**High**

---

# Gap 10 — Curriculum Framework Model Is Too Basic

## Current Gap

`CurriculumNode` appears to support node types such as:

```ts
"strand" | "sub_strand" | "topic" | "sub_topic" | "objective"
```

The spec requires support for NaCCA-style structure:

```ts
"strand"
| "sub_strand"
| "content_standard"
| "indicator"
| "objective"
| "competency"
| "assessment_idea"
| "resource_suggestion"
```

## Why This Is a Problem

NaCCA curriculum alignment depends heavily on:

- content standards,
- indicators,
- core competencies.

If these are not first-class node types, the system will have weak curriculum intelligence.

## Recommended Fix

Extend node kinds:

```ts
type CurriculumNodeKind =
  | "strand"
  | "sub_strand"
  | "content_standard"
  | "indicator"
  | "objective"
  | "competency"
  | "assessment_idea"
  | "resource_suggestion"
  | "topic"
  | "sub_topic";
```

Update:

- curriculum import logic,
- node selectors,
- scheme item mapping,
- Lesson Note prefilling,
- Leo context prompts,
- coverage analytics.

## Priority

**Medium / High**

---

# Gap 11 — Curriculum Model Is School-Scoped Only

## Current Gap

`Curriculum` appears to require `schoolId`.

The spec recommends supporting global/shared frameworks such as NaCCA.

## Why This Is a Problem

If every school has its own copy of NaCCA, EduSentrix will duplicate curriculum framework data unnecessarily.

This makes updates and maintenance harder.

## Recommended Fix

Update `Curriculum`:

```ts
type Curriculum = {
  schoolId?: ObjectId | null;
  isGlobal: boolean;

  name: string;
  country?: string;
  type: "national" | "international" | "custom";
  version?: string;
  status: "active" | "archived";
};
```

Query available curricula like:

```ts
{
  $or: [
    { isGlobal: true },
    { schoolId: ctx.schoolId }
  ]
}
```

## Priority

**Medium**

---

# Gap 12 — Import Rows Are Too Simplified

## Current Gap

Current parsed import rows appear to include:

```ts
weekNumber;
title;
learningObjective;
notes;
skipped;
errors;
confidence;
```

The spec expects richer import row data.

## Recommended Fix

Extend import rows:

```ts
type SchemeImportParsedRow = {
  rowNumber: number;

  weekNumber?: number;
  lessonOrder?: number;

  topic?: string;
  subtopic?: string;
  title?: string;

  strand?: string;
  subStrand?: string;
  contentStandard?: string;
  indicator?: string;

  learningObjectives?: string[];
  coreCompetencies?: string[];
  teachingResources?: string[];
  assessmentIdeas?: string[];

  plannedStartDate?: string;
  plannedEndDate?: string;

  confidence?: number;
  warnings?: string[];
  errors?: string[];
  skipped?: boolean;
};
```

Update:

```txt
src/lib/schemes/scheme-import-parse.ts
src/lib/schemes/scheme-import-pdf-ai.ts
src/app/(app)/teacher/schemes/import/page.tsx
```

## Priority

**Medium / High**

---

# Gap 13 — Import Confirmation Does Not Capture Enough Metadata

## Current Gap

Import confirmation appears to accept only limited metadata such as:

```ts
schemeTitle;
gradeId;
subjectId;
```

Missing:

- curriculumId,
- curriculumSubjectId,
- academicYearId,
- termId,
- classGroupId,
- sourceType,
- source file metadata.

## Recommended Fix

Update confirm payload:

```ts
{
  schemeTitle: string;
  description?: string;

  curriculumId?: string;
  curriculumSubjectId?: string;

  academicYearId: string;
  termId: string;

  gradeId: string;
  classGroupId?: string;
  subjectId: string;
}
```

The created `SchemeOfWork` should store:

```ts
sourceType: "csv_import" | "excel_import" | "pdf_import";
sourceFileUrl?: string;
sourceFileKey?: string;
```

## Priority

**High**

---

# Gap 14 — Duplicate, Copy, and Export Workflows Are Missing

## Current Gap

The spec requires:

- duplicate scheme,
- copy to another class,
- copy to another term/year,
- export scheme.

These do not appear complete.

## Recommended Fix

Add endpoints:

```txt
POST /api/teacher/schemes/:id/duplicate
POST /api/admin/schemes/:id/duplicate
GET  /api/teacher/schemes/:id/export
GET  /api/admin/schemes/:id/export
```

Duplicate payload:

```ts
{
  targetAcademicYearId?: string;
  targetTermId?: string;
  targetGradeId?: string;
  targetClassGroupId?: string;
  targetSubjectId?: string;
  newTitle?: string;
}
```

Export formats:

```txt
CSV
Excel
PDF later
```

## Priority

**Medium**

---

# Gap 15 — Reorder Endpoint Is Missing

## Current Gap

`SchemeItem` has `sequence`, but there does not appear to be a dedicated reorder endpoint.

## Recommended Fix

Add:

```txt
POST /api/teacher/schemes/:id/items/reorder
```

Payload:

```ts
{
  itemIds: string[];
}
```

Backend should:

- verify teacher/admin can edit scheme,
- verify all items belong to the scheme,
- update sequence values atomically if possible.

## Priority

**Medium**

---

# Gap 16 — Premium UI Component Requirements Are Not Fully Followed

## Current Gap

The spec insisted on:

- custom EduSentrix date picker,
- premium dropdown/select,
- premium UI feel.

But scheme pages appear to use raw HTML fields in several places:

```tsx
<input />
<select />
```

Affected areas likely include:

```txt
src/app/(app)/teacher/schemes/page.tsx
src/app/(app)/teacher/schemes/[id]/page.tsx
src/app/(app)/teacher/schemes/import/page.tsx
src/app/(app)/admin/schemes/page.tsx
```

## Recommended Fix

Replace raw select fields with EduSentrix premium select/dropdown components:

```tsx
<PremiumSelect />
```

or your established internal equivalent.

Replace date inputs with the custom date picker for:

- planned start date,
- planned end date,
- academic period dates,
- import-related date fields.

Use premium components consistently:

- `Card`,
- `Button`,
- `Input`,
- `Textarea`,
- `Badge`,
- `Dialog/Drawer`,
- `DataTable`,
- skeleton loaders,
- empty states,
- Sonner toasts.

## Priority

**High for UX polish**

---

# Gap 17 — Scheme Creation UI Is Too Minimal

## Current Gap

Teacher scheme creation appears to be only:

```txt
Title → Create
```

The spec expects richer metadata.

## Recommended Fix

Create a `SchemeCreateForm` component with:

Required:

```txt
Academic Year
Term
Grade
Subject
Title
```

Optional:

```txt
Class Group
Description
Curriculum Framework
Curriculum Subject
```

Use premium dropdowns and the existing premium styling system.

## Priority

**High**

---

# Gap 18 — Planned Dates Are Missing on Scheme Items

## Current Gap

`SchemeItem` does not appear to include:

```ts
plannedStartDate;
plannedEndDate;
```

## Why This Is a Problem

The spec requires teachers/admins to be able to plan when a scheme item should be taught.

This also helps with:

- week mapping,
- coverage tracking,
- current week suggestions,
- Lesson Note prefill,
- academic head reports.

## Recommended Fix

Add to `SchemeItem`:

```ts
plannedStartDate?: Date;
plannedEndDate?: Date;
```

Add UI fields using the custom EduSentrix date picker.

## Priority

**High**

---

# Gap 19 — Coverage Analytics Is Too Basic

## Current Gap

There appears to be a basic coverage summary route.

The spec also requires coverage by:

- subject,
- class group,
- teacher,
- grade,
- term,
- scheme.

## Recommended Fix

Add endpoints:

```txt
/api/teacher/coverage/by-subject
/api/teacher/coverage/by-class-group
/api/teacher/coverage/by-teacher

/api/admin/coverage/summary
/api/admin/coverage/by-subject
/api/admin/coverage/by-class-group
/api/admin/coverage/by-teacher
```

Dashboards should show:

```txt
Covered
In Progress
Not Started
Skipped
Moved
Needs Review
```

## Priority

**Medium / High**

---

# Gap 20 — Audit Logging Is Missing

## Current Gap

Major scheme actions do not appear to consistently create audit logs.

## Required Audit Events

Log the following:

```txt
scheme.created
scheme.updated
scheme.submitted
scheme.approved
scheme.needs_revision
scheme.rejected
scheme.activated
scheme.archived
scheme.duplicated
scheme.import_uploaded
scheme.import_confirmed
scheme.coverage_updated
scheme.lesson_note_linked
scheme.lesson_note_unlinked
```

## Recommended Fix

Use existing audit infrastructure, for example:

```ts
await logAuditEvent({
  schoolId,
  actorId: ctx.userId,
  action: "scheme.approved",
  entityType: "SchemeOfWork",
  entityId: scheme._id,
  metadata: {
    previousStatus,
    newStatus: scheme.status,
  },
});
```

## Priority

**Medium / High**

---

# Gap 21 — Admin Route Structure Could Be Better Organized

## Current Gap

Current admin pages appear to be under:

```txt
/admin/schemes
```

The spec recommends grouping this under academics.

## Recommended Fix

Use:

```txt
/admin/academics/schemes
/admin/academics/curriculum
/admin/academics/coverage
```

This is not urgent, but improves product organization.

## Priority

**Low / Medium**

---

# Gap 22 — Status Labels Need Better UI Presentation

## Current Gap

Raw status values such as `in_review` may appear in UI.

## Recommended Fix

Create a reusable component:

```tsx
<SchemeStatusBadge status={scheme.status} />
```

Display labels:

```txt
Draft
Submitted
Needs Revision
Approved
Active
Archived
Rejected
```

Use consistent colors and premium badge styling.

## Priority

**Medium**

---

# Gap 23 — Import Preview UI Needs More Review Controls

## Current Gap

The import preview exists but appears table-like and simplified.

## Recommended Fix

Improve it with:

- editable cells,
- row-level errors,
- row-level warnings,
- confidence badge,
- skip/include row toggle,
- drawer/modal for full row details,
- validation summary,
- ability to correct topic/objective/indicator before confirmation.

Columns should include:

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
Planned Dates
Confidence
Warnings
Actions
```

## Priority

**Medium**

---

# Gap 24 — Empty States and Feedback States Need Improvement

## Current Gap

Some pages may show plain empty areas or basic loading states.

## Recommended Fix

Add premium empty states:

```txt
No schemes of work yet.
Create one manually, import from Excel, or ask Leo to draft one.
```

Add:

- skeleton loaders,
- error cards,
- retry buttons,
- Sonner success/error toasts,
- disabled states for unavailable actions.

## Priority

**Medium**

---

# Gap 25 — Lesson Note Scheme Linking Can Be Smarter

## Current Gap

The Lesson Note scheme link panel exists and is a good start, but it can better support:

- current week suggestions,
- auto-prefill from selected scheme item,
- no-overwrite confirmations,
- display of strand/indicator/objectives,
- multiple scheme item linking.

## Recommended Fix

Enhance the panel to:

1. Detect current week from term dates.
2. Show suggested scheme item for the teacher's subject/class/grade.
3. Allow selecting one or more items.
4. Show item summary:

```txt
Week
Topic
Indicator
Objectives
Resources
```

5. Offer an `Apply to Lesson Note` button.
6. Confirm before overwriting existing lesson note fields.

## Priority

**Medium / High**

---

# Gap 26 — Scheme Link Should Remain Optional for Backward Compatibility

## Current Gap

This is currently handled well, but it must remain a hard rule.

## Required Rule

Existing Lesson Notes must not break.

Scheme linking should remain optional unless the school setting says:

```ts
requireSchemeLinkForLessonNotes: true
```

## Recommended Fix

Keep this rule enforced in validation:

```txt
If requireSchemeLinkForLessonNotes = false:
  Lesson Notes can be created without scheme links.

If requireSchemeLinkForLessonNotes = true:
  Lesson Notes require valid schemeId and schemeItemIds.
```

## Priority

**Must Preserve**

---

# Gap 27 — Scheme Should Not Bypass Lesson Notes

## Required Rule

The architecture must remain:

```txt
Scheme → Lesson Note → Lesson
```

Not:

```txt
Scheme → Lesson
```

## Recommended Fix

Lessons should continue to be created from Lesson Notes.

The Lesson should inherit scheme data from the source Lesson Note:

```ts
Lesson.sourceLessonNoteId = lessonNote._id;
Lesson.schemeId = lessonNote.schemeId;
Lesson.schemeItemIds = lessonNote.schemeItemIds;
```

## Priority

**Must Preserve**

---

# Gap 28 — PDF/AI Import Is Started but Should Remain Review-First

## Current Gap

There is some PDF/AI import support, but the parsed structure is not rich enough.

## Required Rule

PDF/AI import must never directly create an active scheme.

Correct flow:

```txt
Upload PDF/document
→ Parse/extract rows
→ Show editable preview
→ User reviews and corrects rows
→ Confirm import
→ Create draft scheme
→ Submit for approval
→ Admin approves/activates
```

## Recommended Fix

Ensure PDF/AI import creates only:

```txt
SchemeImportJob
Parsed rows
Draft Scheme after confirmation
```

Never auto-activate imported content.

## Priority

**High**

---

# Gap 29 — AI/Leo Planning Should Be Controlled by Settings

## Current Gap

AI hooks exist, but AI usage should be strictly gated by settings and plan access.

## Recommended Fix

Before AI scheme generation:

```ts
if (!settings.academicPlanning.allowAiSchemeDrafting) {
  return forbidden("AI scheme drafting is disabled.");
}

if (!subscription.hasFeature("leo_scheme_generation")) {
  return forbidden("Leo scheme generation is not available on this plan.");
}
```

AI output should create a draft only.

## Priority

**Medium / High**

---

# Gap 30 — Full CRUD Should Be Completed

## Current Gap

Basic CRUD exists, but not all full lifecycle actions are complete.

## Required Full CRUD / Actions

Implement:

```txt
Create scheme
View scheme
Edit scheme
Delete draft scheme
Archive approved/active scheme
Duplicate scheme
Copy scheme to another class
Copy scheme to another term/year
Import scheme
Export scheme
Submit for approval
Approve scheme
Request revision
Reject scheme
Activate scheme
Deactivate/archive scheme
View coverage
Update scheme item status
Link lesson notes
Unlink lesson notes
Reorder scheme items
```

## Priority

**High**

---

# Recommended Implementation Plan

## Chunk 1 — Fix Data Models

Update:

```txt
src/models/SchemeOfWork.ts
src/models/SchemeItem.ts
src/models/SchemeImportJob.ts
src/models/Curriculum.ts
src/models/CurriculumNode.ts
```

Add:

- `academicYearId`,
- `termId`,
- `classGroupId`,
- `sourceType`,
- `version`,
- `plannedStartDate`,
- `plannedEndDate`,
- strand/sub-strand/content standard/indicator,
- learning objectives array,
- teaching resources array,
- assessment ideas array,
- global curriculum framework support.

## Chunk 2 — Fix Status and Review Workflow

Add statuses:

```txt
submitted
needs_revision
rejected
```

Add routes:

```txt
POST /api/admin/schemes/:id/review
GET  /api/admin/schemes/:id/reviews
```

## Chunk 3 — Tighten Permissions

Fix:

- teacher scheme list access,
- teacher edit access,
- scheme item edit access,
- import confirmation access,
- Lesson Note scheme linking access.

## Chunk 4 — Enforce School Settings

Enforce academic planning settings in:

- scheme creation,
- scheme import,
- PDF import,
- AI drafting,
- Lesson Note scheme link requirement.

## Chunk 5 — Improve Scheme Create/Edit UI

Build:

```txt
SchemeCreateForm
SchemeItemEditor
SchemeItemTable
SchemeItemDrawer
SchemeStatusBadge
SchemeReviewPanel
SchemeApprovalTimeline
```

Use:

- custom EduSentrix date picker,
- premium dropdown/select,
- premium input/textarea/card/table/button components.

## Chunk 6 — Improve Import Workflow

Extend parsed rows.

Add:

- richer preview,
- row validation,
- confidence badges,
- editable cells,
- skip row,
- warnings/errors.

## Chunk 7 — Improve Lesson Note Integration

Enhance `LessonNoteSchemeLinkPanel` with:

- current week suggestions,
- scheme item summaries,
- safe prefill,
- no-overwrite confirmation,
- multi-item linking.

## Chunk 8 — Add Coverage Dashboards

Add teacher/admin coverage analytics by:

- subject,
- class group,
- teacher,
- grade,
- term,
- scheme.

## Chunk 9 — Add Audit Logging

Log all major scheme actions.

## Chunk 10 — Add Copy/Duplicate/Export

Add scheme duplication and export features.

---

# Priority Summary

## Critical / High Priority

1. Fix teacher access control bug.
2. Add `academicYearId` and `termId` to SchemeOfWork.
3. Add `classGroupId` support.
4. Add richer `SchemeItem` academic fields.
5. Add planned dates to SchemeItem.
6. Add `needs_revision` and `rejected` statuses.
7. Add request-revision/reject review workflow.
8. Enforce school academic planning settings.
9. Prevent multiple active schemes for the same academic context.
10. Replace raw selects with premium dropdowns.
11. Use custom date picker for all date fields.
12. Improve scheme creation form.
13. Keep Lesson Note scheme links optional unless required by settings.
14. Ensure PDF/AI import remains review-first.

## Medium Priority

1. Add duplicate/copy/export.
2. Add reorder endpoint.
3. Add richer import row fields.
4. Add audit logging.
5. Add admin detail/review page.
6. Add better empty/loading/error states.
7. Add coverage by subject/class/teacher.
8. Add Sonner toasts.
9. Add status badge component.
10. Improve import preview UX.

## Lower Priority

1. Move admin scheme routes under `/admin/academics/schemes`.
2. Add global curriculum framework management UI.
3. Expand Leo planning workflows after manual workflows are stable.
4. Add PDF export for schemes.

---

# Final Assessment

The current Curriculum & Scheme of Work module is a good start, but it does not yet fully satisfy the development spec.

Current rating by area:

| Area | Status |
|---|---|
| Core models | Partial |
| School settings | Good foundation |
| Teacher scheme CRUD | Partial |
| Admin review workflow | Basic |
| Scheme item depth | Too shallow |
| Import workflow | Partial but promising |
| PDF/AI import | Started but shallow |
| Lesson Note integration | Good foundation |
| Lessons integration | Good foundation |
| Coverage | Basic |
| Permissions | Needs tightening |
| Premium UI compliance | Needs work |
| Custom date picker usage | Missing/incomplete |
| Premium dropdown usage | Inconsistent |
| Audit logging | Missing/incomplete |
| Curriculum framework | Basic, not full spec |

The most important next step is to fix the **data model, permissions, review workflow, and school-setting enforcement** before polishing the UI.

Once those foundations are solid, the UI should be upgraded to the premium EduSentrix standard using the custom date picker, premium dropdowns, and consistent premium interface components.
