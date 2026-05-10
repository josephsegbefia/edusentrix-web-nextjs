# EduSentrix Scheme of Learning Import & Lesson Notes Integration Spec

## 1. Purpose

This specification consolidates the product direction for replacing confusing manual curriculum-framework entry with an import-first **Scheme of Learning** workflow.

The feature should let schools upload official GES/NaCCA-style scheme documents, review the extracted weekly plan, and use those scheme rows as the direct planning source for Lesson Notes.

This document is intended for:

- product designers,
- frontend engineers,
- backend engineers,
- AI/Leo workflow implementers,
- QA engineers,
- future coding agents.

## 2. Product Clarification

The current UI uses the term **Curriculum Framework**, but for the Ghana/GES workflow this is not the clearest user-facing concept.

Recommended terminology:

| Current / Internal | User-Facing Term | Meaning |
| --- | --- | --- |
| Curriculum | Curriculum / Programme | Broad official programme such as GES/NaCCA, Cambridge, British |
| Curriculum Framework | Learning Structure | Background structure derived from scheme rows |
| Scheme of Work | Scheme of Learning | Term-by-term weekly plan teachers follow |
| Curriculum Node | Strand / Sub-strand / Standard / Indicator | Background structured references |
| Lesson Note | Lesson Note | Daily/period teacher planning document |

The user-facing product flow should be:

```txt
Curriculum / Programme
→ Scheme of Learning
→ Lesson Notes
→ Lessons
→ Coverage Analytics
```

Lesson Notes must be based on Scheme of Learning rows when a relevant scheme exists.

## 3. Sample Document Shape

The attached GES-style PDF example contains a structured term scheme table:

```txt
FIRST TERM SCHEME OF LEARNING
SUBJECT: CAREER TECHNOLOGY

Columns:
- Week
- Week ending
- Strand
- Sub-strand
- Content standard
- Indicator(s)
- Resources
```

This should become the canonical import shape for Ghana/GES scheme documents.

The system must preserve these fields. It must not flatten the document into only `title`, `learningObjective`, and `notes`.

## 4. Core Product Principle

Manual scheme creation should remain possible, but it should not be the main mental model.

The primary workflow should be:

```txt
Upload official scheme document
→ Extract rows
→ Review and correct
→ Tie to grade, subject, term, academic year
→ Create or update Scheme of Learning
→ Lesson Notes are created from scheme rows
```

Manual entry should use the same structured table as the import review screen, so users are never asked to build an abstract framework first.

## 5. Navigation and UI Positioning

Recommended navigation labels:

- Admin sidebar: **Schemes of Learning**
- Teacher sidebar: **Schemes of Learning**
- Legacy/admin advanced page: **Learning Structure** or **Curriculum Structure**

Avoid making “Curriculum Frameworks” the primary label.

Recommended pages:

```txt
/admin/schemes-of-learning
/admin/schemes-of-learning/import
/admin/schemes-of-learning/[id]
/teacher/schemes
/teacher/schemes/import
/teacher/schemes/[id]
```

Internal routes can be migrated gradually. UI copy should move first.

## 6. Scheme Creation Must Start With Context

Every Scheme of Learning must be tied to the correct academic context.

Required fields:

- school,
- curriculum/programme,
- academic year,
- term,
- grade,
- subject.

Optional fields:

- class group, when a scheme is class-specific,
- owner teacher,
- source document URL/key,
- source publisher/version,
- import confidence summary.

The UI must not ask users to invent a title first.

Title should auto-generate from context:

```txt
Basic 7 Career Technology - First Term Scheme of Learning
```

Recommended duplicate check:

```txt
schoolId + academicYearId + termId + gradeId + subjectId + classGroupId/null
```

If a matching scheme exists, show:

```txt
A Basic 7 Career Technology First Term scheme already exists.
Open it, replace it from this import, or create a new version.
```

## 7. Clean Wizard UX

The import/create experience should use a clean wizard similar in spirit to the Lesson Notes wizard: focused, step-based, and uncluttered.

Do not show everything at once.

Recommended wizard:

### Step 1: Scheme Context

Goal: identify exactly what this scheme belongs to.

Fields:

- curriculum/programme,
- academic year,
- term,
- grade,
- subject,
- class group optional,
- document source optional.

Leo can suggest context from the file name or extracted header:

```txt
"This looks like Basic 7 Career Technology, First Term. Use these?"
```

### Step 2: Upload Source

Goal: upload or choose the source.

Supported initial formats:

- PDF,
- DOC/DOCX,
- CSV/XLSX,
- manual table entry.

PDF/DOC import should explain:

```txt
Upload the official scheme document. We will extract weekly rows and ask you to review before saving.
```

### Step 3: Review Extracted Rows

Goal: verify the imported scheme table.

Use columns matching GES documents:

- Week,
- Week ending,
- Strand,
- Sub-strand,
- Content standard,
- Indicator(s),
- Resources,
- Notes.

Do not use a dense spreadsheet that feels overwhelming. Use a responsive table with:

- compact rows on desktop,
- expandable row details on mobile,
- validation badges,
- confidence highlights,
- inline edit only when needed.

Rows with issues should be grouped or filterable:

- Missing week,
- Missing strand,
- Missing indicator,
- Low confidence,
- Duplicate week.

### Step 4: Leo Review

Goal: help users clean up the scheme without manual busywork.

Leo should suggest:

- missing subject/grade/term from document text,
- normalized strand names,
- split multiple indicators into separate indicator chips,
- resource cleanup,
- likely duplicate rows,
- revision/examination weeks,
- inconsistent week dates,
- whether the scheme appears incomplete.

Leo must not silently save changes. Suggestions must be reviewable and reversible.

### Step 5: Confirm and Publish

Goal: create a clean draft or active scheme.

Actions:

- Save as draft,
- Submit for review,
- Publish/activate, if user has permission,
- Replace existing scheme version, if allowed.

Show a final summary:

- grade,
- subject,
- term,
- total weeks,
- teaching rows,
- revision rows,
- examination rows,
- low-confidence rows remaining.

## 8. Data Model Recommendations

Current models already provide a foundation:

- `SchemeOfWork`,
- `SchemeItem`,
- `SchemeImportJob`,
- `Curriculum`,
- `CurriculumSubject`,
- `CurriculumNode`.

Recommended naming in code can remain `SchemeOfWork`, but UI should say **Scheme of Learning**.

### 8.1 SchemeOfWork

Ensure these fields are required or strongly enforced for new scheme-of-learning records:

```ts
schoolId: ObjectId;
curriculumId?: ObjectId | null;
academicYearId: ObjectId;
termId: ObjectId;
academicPeriodId?: ObjectId | null;
gradeId: ObjectId;
subjectId: ObjectId;
classGroupId?: ObjectId | null;
ownerTeacherId?: ObjectId | null;
title: string;
sourceType: "manual" | "csv_import" | "excel_import" | "pdf_import" | "doc_import" | "ai_generated" | "copied";
sourceFileUrl?: string | null;
sourceFileKey?: string | null;
status: "draft" | "submitted" | "needs_revision" | "approved" | "active" | "archived" | "rejected";
version: number;
```

Add or enforce an index for duplicate prevention:

```ts
{
  schoolId: 1,
  academicYearId: 1,
  termId: 1,
  gradeId: 1,
  subjectId: 1,
  classGroupId: 1,
  status: 1
}
```

Business rule:

- only one active scheme should exist for a grade/subject/term/class context,
- drafts and archived versions may coexist.

### 8.2 SchemeItem

The current `SchemeItem` already has many useful fields. Expand and consistently use them:

```ts
weekNumber?: number | null;
plannedEndDate?: Date | null; // week ending
title?: string | null;
strand?: string | null;
subStrand?: string | null;
contentStandard?: string | null;
indicator?: string | null;
indicators?: string[]; // recommended addition
teachingResources?: string[];
notes?: string | null;
curriculumNodeIds: ObjectId[];
status: SchemeItemStatus;
coverageStatus: SchemeItemCoverageStatus;
```

Recommended additions:

```ts
rowType?: "teaching" | "revision" | "examination" | "holiday" | "other";
sourceRowIndex?: number | null;
parseConfidence?: number | null;
weekEndingLabel?: string | null; // retain original text when date parsing is uncertain
```

### 8.3 SchemeImportJob

The current import job row shape is too flat for official scheme PDFs.

Expand parsed rows from:

```ts
weekNumber;
title;
learningObjective;
notes;
confidence;
```

To:

```ts
rowIndex: number;
weekNumber: number | null;
weekEnding: string | null;
strand: string | null;
subStrand: string | null;
contentStandard: string | null;
indicators: string[];
resources: string[];
title: string | null;
notes: string | null;
rowType: "teaching" | "revision" | "examination" | "holiday" | "other";
skipped: boolean;
errors: string[];
confidence?: number | null;
rawText?: string | null;
```

## 9. Import Extraction Requirements

### 9.1 PDF

For text-based PDFs:

- extract text using the existing PDF parser,
- detect likely tables,
- use deterministic parsing for common GES table layouts where possible,
- use Leo/AI only to resolve messy rows or unclear structure.

For scanned PDFs:

- show a clear message if no text is extractable,
- later support OCR.

### 9.2 DOC/DOCX

Add support for Word documents because schools may receive official schemes as `.doc` or `.docx`.

Recommended approach:

- extract table rows when actual Word tables exist,
- fallback to text extraction,
- pass structured table text to the same normalizer.

### 9.3 Spreadsheet

Spreadsheet import should support both old simple headers and new rich headers.

Accepted rich headers:

```txt
week
week ending
strand
sub strand
content standard
indicator
indicators
resources
```

### 9.4 Normalization

Normalize:

- `WEE K` → `Week`,
- `SUB STRAND` → `Sub-strand`,
- line-wrapped dates,
- multi-line indicators,
- comma-separated resources,
- `REVISION` and `EXAMINATION` rows.

Do not discard original text. Store raw source snippets for audit/debug where practical.

## 10. Learning Structure Derivation

The system should derive background curriculum structure from scheme rows.

For each teaching row:

```txt
Strand
→ Sub-strand
→ Content Standard
→ Indicator
```

Recommended behavior:

- match existing `CurriculumNode` by normalized title/code,
- create missing nodes only after user confirmation,
- link `SchemeItem.curriculumNodeIds` to matched/created nodes,
- avoid asking users to manually create the structure first.

This turns the old “Curriculum Framework” into a background learning structure that supports filtering, lesson alignment, and analytics.

## 11. Leo Assistance

Leo should act as a guided academic planning assistant, not an opaque importer.

Leo can:

- infer grade/subject/term from document header and file name,
- detect scheme table columns,
- split indicators and resources,
- identify revision/exam weeks,
- flag suspicious rows,
- suggest missing titles from sub-strand/indicator,
- suggest lesson-note objectives from the scheme row,
- suggest a pacing issue when weeks are missing or duplicated,
- suggest a clean scheme title.

Leo must:

- show confidence,
- explain why a row is flagged,
- let the user accept/reject suggestions,
- never activate a scheme without explicit user action.

## 12. Lesson Notes Improvements

The Lesson Notes feature should become scheme-aware without becoming cluttered.

### 12.1 Creation Flow

When a teacher creates a lesson note, the system should first look for active schemes matching:

```txt
schoolId
academicYearId
termId
gradeId / classGroupId
subjectId
teacher assignment
```

If matching scheme rows exist, show:

```txt
Create from Scheme of Learning
```

Recommended flow:

```txt
Select class and subject
→ Show current term scheme rows
→ Choose row/week/topic
→ Lesson Note wizard opens prefilled
```

Do not make teachers manually re-enter:

- strand,
- sub-strand,
- content standard,
- indicators,
- resources,
- week,
- subject,
- grade.

### 12.2 Prefill Mapping

When creating a Lesson Note from a scheme row:

| Scheme Item | Lesson Note |
| --- | --- |
| strand | curriculum.strand or curriculum metadata |
| subStrand | curriculum.subStrand or curriculum metadata |
| contentStandard | curriculum.contentStandard |
| indicators | curriculum.indicators |
| teachingResources | resources/references |
| title/subStrand | topic/title |
| weekNumber | lesson context |
| plannedEndDate | week-ending context |
| curriculumNodeIds | scheme link metadata |

The teacher should focus on:

- lesson objectives,
- starter,
- teaching and learning activities,
- differentiation,
- assessment,
- homework,
- reflection.

### 12.3 Scheme Link Panel

Improve the existing `LessonNoteSchemeLinkPanel` into a clearer “Scheme of Learning” section.

Recommended UI:

- compact current-week card,
- “Linked scheme row” badge,
- option to change row,
- show strand/sub-strand/indicator summary,
- show coverage status.

Avoid a large generic selector unless the teacher chooses “Change”.

### 12.4 Leo in Lesson Notes

Leo can use the selected scheme row to suggest:

- lesson objectives,
- phase/starter activity,
- teaching activities,
- assessment questions,
- differentiation,
- teaching resources,
- homework,
- likely lesson duration,
- prior knowledge prompts.

Leo should not overwrite teacher work. Suggestions should be inserted field-by-field.

### 12.5 Coverage Tracking

Each scheme row should show lesson-note and teaching progress:

```txt
No lesson note
Draft lesson note
Submitted
Approved
Taught / covered
Skipped
Moved
Needs review
```

Recommended actions from a scheme row:

- Create lesson note,
- Continue draft,
- View approved lesson note,
- Mark covered,
- Move to another week,
- Add coverage note.

### 12.6 Teacher Dashboard

Teacher dashboard should surface:

```txt
This week's Scheme of Learning
```

For each assigned class/subject:

- week,
- topic/sub-strand,
- indicator(s),
- lesson-note status,
- primary action.

Example:

```txt
Basic 7 Career Technology
Week 5: Environmental Health
Action: Create lesson note
```

## 13. Admin / Academic Head Review

Admins and academic heads need visibility without clutter.

Recommended views:

- Scheme library grouped by grade, subject, term,
- Import status,
- Active scheme conflicts,
- Low-confidence imports,
- Scheme coverage by class/subject,
- Lesson note completion by scheme row.

Review workflow:

```txt
Draft
→ Submitted
→ Approved
→ Active
```

If approval is disabled for the school, authorized users may activate directly.

## 14. UI Design Requirements

The Scheme of Learning UI must be calm and task-focused.

Requirements:

- use a wizard for import/create,
- one main decision per step,
- avoid nested cards,
- avoid exposing internal IDs/codes unless advanced,
- use clear icons for upload, review, warning, publish,
- keep tables scannable,
- use expandable row detail instead of overcrowding columns on mobile,
- use status badges sparingly,
- keep Leo suggestions in a side panel or collapsible assistant area,
- make primary action obvious on every step.

The UI should visually align with the Lesson Notes wizard, not with a heavy admin database table.

## 15. Permissions and Settings

Use existing academic planning settings:

```ts
enableSchemeOfWork;
requireSchemeLinkForLessonNotes;
allowTeacherSchemeCreation;
requireSchemeApproval;
allowSchemeImport;
allowPdfSchemeImport;
allowAiSchemeDrafting;
defaultSchemeApprovalRole;
coverageUpdateMode;
```

Recommended permission behavior:

- Admin/academic head can import and activate schemes.
- Teacher can import if `allowTeacherSchemeCreation` and `allowSchemeImport` are enabled.
- Upload/import is available only when the school curriculum programme is `ghana_nacca`.
- PDF/DOC AI extraction requires AI/PDF import permission and school setting.
- Teachers can create lesson notes from active schemes.
- Lesson notes may require scheme links if configured.

## 16. Implementation Phases

### Phase 1: Naming and Context Hardening

- Rename user-facing UI to “Scheme of Learning”.
- Require grade, subject, academic year, and term during creation/import.
- Auto-generate titles.
- Add duplicate detection.
- Retire the standalone `/admin/curricula` UI and redirect it to `/admin/schemes`.

### Phase 2: Rich Import Rows

- Expand `SchemeImportJob.parsedRows`.
- Update PDF AI extraction schema.
- Update CSV/XLSX import mapping.
- Add review UI with GES-style columns.
- Preserve confidence and validation errors.

### Phase 3: Scheme Item Mapping

- Map rich parsed rows into `SchemeItem`.
- Add `rowType`, `parseConfidence`, `sourceRowIndex`, and `weekEndingLabel` if needed.
- Store resources as `teachingResources`.
- Store multiple indicators cleanly.

### Phase 4: Learning Structure Derivation

- Match/create `CurriculumNode` records from strand/sub-strand/content standard/indicator.
- Link scheme rows to curriculum nodes.
- Keep this mostly behind the scenes.

### Phase 5: Lesson Note Integration

- Add “Create from Scheme of Learning” entry point.
- Prefill lesson note curriculum fields from scheme row.
- Improve `LessonNoteSchemeLinkPanel`.
- Add Leo field suggestions from selected scheme row.
- Track lesson-note status against each scheme row.

### Phase 6: Dashboard and Analytics

- Add teacher “This week’s scheme” cards.
- Add admin coverage views.
- Add scheme completion and lesson-note coverage analytics.

## 17. Acceptance Criteria

The feature is successful when:

- A user can upload a GES-style scheme PDF and get recognizable weekly rows.
- The scheme cannot be saved without grade, subject, academic year, and term.
- The imported rows preserve strand, sub-strand, content standard, indicators, and resources.
- Low-confidence rows are visible and editable before confirmation.
- The saved scheme is easy to find by grade, subject, and term.
- Teachers can create Lesson Notes from scheme rows.
- Lesson Notes are prefilled with curriculum alignment and resources.
- Scheme rows show whether lesson notes exist and whether coverage has happened.
- Leo suggestions are useful but never silently destructive.
- Manual creation uses the same clean table/wizard pattern as import review.

## 17.1 Implementation Status

Implemented:

- Teacher and admin Scheme of Learning import flows.
- GES-style PDF, CSV, and XLSX row extraction into week, week ending, strand, sub-strand, content standard, indicators, resources, row type, and raw source text.
- Clean admin import wizard with upload, context selection, row review, and approved scheme creation.
- Required period, grade, class, and subject context before confirmed imports become schemes.
- Duplicate protection for the same period, grade, class, and subject.
- Learning Structure derivation into curriculum, curriculum subject, and curriculum nodes.
- Lesson Note linking and one-click Lesson Note creation from approved/active scheme rows.
- Teacher dashboard card for this week’s active Scheme of Learning rows.
- Linked Lesson Note counts on scheme rows.
- PDF import now follows the base Scheme of Learning import gate; there is no separate PDF-only school setting gate.

## 18. Non-Goals

Initial implementation should not attempt:

- full OCR for scanned PDFs,
- automatic activation without review,
- replacing the Lesson Notes module,
- bypassing Lesson Notes to create Lessons directly,
- complex curriculum standards authoring before scheme import works,
- automatic correction of official source documents without user approval.

## 19. Open Questions

- Should imported official GES schemes be stored globally for reuse across schools, or per school only?
- Should schools be able to share cleaned import templates?
- Should a scheme be grade-level only, or should every class group receive its own active copy?
- Should revision and examination rows generate Lesson Note prompts, or remain planning markers only?
- How strict should duplicate active scheme prevention be for schools with multiple streams?
