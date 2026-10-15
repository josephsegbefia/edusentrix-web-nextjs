# EduSentrix Teacher Bulk Import V2

## Implementation report

**Date:** 14 October 2026  
**Status:** Implemented staged identity import and guided teacher setup workflow  
**Primary surface:** Admin → Teachers → Bulk import

## 1. Executive summary

Teacher Bulk Import V2 changes the import from a spreadsheet-to-teacher shortcut into a controlled onboarding workflow.

The administrator can upload an existing CSV, XLS, or XLSX file even when its columns do not match the EduSentrix template. Leo is used to interpret the source headers and identify the useful identity columns. The upload stage takes only the teacher identity data needed to begin setup:

- teacher name;
- phone number; and
- email address.

Other spreadsheet columns are ignored at the identity boundary. They are not treated as teacher relationships and are not used to create homerooms, subjects, or teaching assignments automatically.

After analysis, no teacher has been created yet. Each staged teacher is opened one at a time in a four-step wizard that follows the existing create-teacher experience. The administrator can edit the imported values, choose a homeroom, select teaching class groups and subject offerings from the school catalog, optionally upload an avatar, and create the teacher through the existing teacher-creation API.

The result is safer and easier to understand: Leo helps interpret messy input, while the administrator remains the final decision-maker for school-specific relationships.

## 2. Product decision implemented

The current V2 flow is intentionally split into two stages:

```text
CSV/XLS/XLSX upload
        ↓
Leo-assisted identity/header understanding
        ↓
Identity-only staged teacher queue
        ↓
Administrator setup wizard, one teacher at a time
        ↓
Existing teacher creation contract
```

The upload is not a bulk relationship assignment tool. Homerooms, subjects, class groups, and teaching assignments are selected during the guided setup stage from the school’s active catalog.

## 3. End-to-end administrator experience

### 3.1 Upload

The administrator opens the bulk teacher import modal and may:

1. download the identity template;
2. select a CSV, XLS, or XLSX workbook; and
3. start background analysis.

The template is intentionally minimal:

```csv
Teacher Name,Phone,Email
Joseph Morgan Stanley,0240000000,joseph.stanley@example.com
```

The template is recommended, not mandatory. Schools may upload their existing staff workbook without first reformatting it.

The upload boundary accepts files up to 5 MB. The current upload route is:

```text
POST /api/admin/teachers/bulk-create
```

No teacher is created by this request.

### 3.2 Background preparation

The file is stored in the existing `TeacherImportJob` and queued through the existing background import engine. The workflow is identified as:

```text
identity_setup_v1
```

The background analysis:

- reads CSV, XLS, and XLSX formats;
- identifies candidate worksheets;
- preserves source row numbers and source identity values;
- invokes Leo for header interpretation when no explicit mapping is supplied;
- limits accepted mapped fields to the identity contract; and
- prepares the staged rows for the setup wizard.

Analysis does not create teachers, users, homerooms, subject profiles, or teaching assignments.

### 3.3 Guided setup wizard

Each staged teacher is handled individually. Imported identity values are prefilled but remain editable.

#### Step 1 — Personal details

The administrator can review and edit:

- first name;
- last name;
- email;
- phone;
- employee ID; and
- department.

Status is selected using the create-teacher-style choice cards. The imported identity values remain visible as the source suggestion.

The platform does not have a separate middle-name field. Middle-name information is retained rather than discarded:

```text
Source name: Joseph Morgan Stanley
First name:  Joseph Morgan
Last name:   Stanley
```

The original full name remains available as `sourceFullName`, and the source identity values remain available for audit and review.

#### Step 2 — Homeroom

Homeroom is optional. The administrator can:

- search active class groups;
- choose “No homeroom”; or
- select one class-group card.

The class-group list is loaded from the current school and displays the grade context where available. The search and selectable-card interaction is shared visually with the teaching-assignment step.

#### Step 3 — Teaching assignments

Teaching assignments use the same searchable, selectable class-group experience as homeroom.

For each assignment, the administrator can:

- search active class groups;
- select a class-group card;
- select only subject offerings available for that class context;
- add another class group; or
- remove an assignment row.

Changing a selected class group clears that assignment’s subject choices so stale subject selections cannot follow the teacher to a different class.

The subject list is sourced from active `SubjectOffering` records and filtered by grade context. This keeps the wizard aligned with the school’s configured academic catalog rather than accepting arbitrary spreadsheet subject text.

#### Step 4 — Photo and create

The administrator may upload a teacher avatar. The photo step is optional and can be skipped.

The final confirmation summarizes the teacher identity, homeroom state, and number of subject/class assignments. Creation is performed through:

```text
POST /api/admin/teachers/create
```

The wizard sends the existing teacher creation shape, including:

- identity fields;
- optional employee ID and department;
- status;
- optional photo URL;
- homeroom class-group ID; and
- subject-offering/class-group teaching assignments.

## 4. Leo’s responsibility

Leo is used where it adds value: understanding school spreadsheets that do not use the official headers.

Leo may help identify that columns such as the following represent the supported identity fields:

```text
Staff Name
Mobile Number
Personal Email
Teacher Full Name
Contact
```

The returned mapping is constrained to the identity field allow-list. Leo cannot use a source column to create a subject, grade, class group, homeroom, or teaching assignment during upload.

If Leo is unavailable or returns unusable output, the import remains safe. The parser falls back to the permitted identity interpretation, and the administrator can correct the staged identity values in the wizard. Provider failure does not authorize automatic relationship creation.

The school catalog remains authoritative for the second stage:

- class groups come from active school `ClassGroup` records;
- subjects come from active school `SubjectOffering` records; and
- persistence validates that selected IDs belong to the active school.

## 5. Input and data-retention contract

### Accepted upload formats

| Format | Supported | Notes |
|---|---:|---|
| CSV | Yes | First usable row is treated as the header row. |
| XLS | Yes | Workbook sheets are inspected. |
| XLSX | Yes | Workbook sheets are inspected. |

### Identity fields accepted at upload

| Field | Accepted from source | Notes |
|---|---:|---|
| Full/teacher name | Yes | Split for platform creation while preserving the original source name. |
| Phone | Yes | Normalized as an identity value, not used for relationship mapping. |
| Email | Yes | Normalized to lowercase for staged identity review. |

### Fields intentionally excluded from upload staging

| Field | Upload behavior | Where it is completed |
|---|---|---|
| Employee ID | Ignored from source upload | Step 1, editable field |
| Department | Ignored from source upload | Step 1, editable field |
| Status | Not imported from the identity file | Step 1 status choice |
| Homeroom | Ignored from source upload | Step 2 catalog picker |
| Subjects | Ignored from source upload | Step 3 subject offerings |
| Grades/classes taught | Ignored from source upload | Step 3 class-group picker |
| Avatar | Ignored from source upload | Step 4 optional upload |

Unknown spreadsheet columns are not copied into the staged identity payload. This avoids accidentally treating irrelevant school-specific columns as platform data.

## 6. Save and resume behavior

The import is durable and resumable.

During setup, the administrator can select **Save and resume later**. The current teacher’s editable identity values, status, homeroom, assignment selections, and photo reference are saved to the existing import job.

When the bulk import modal is opened again, it checks:

```text
GET /api/admin/teachers/imports?active=1
```

If an unfinished import exists, the modal presents:

- the uploaded filename;
- the number of staged teacher identities;
- the current import state;
- **Resume setup**; and
- **Start over**.

Starting over requires confirmation and cancels the unfinished draft. Resuming continues from the first staged teacher that has not been marked completed.

Each created teacher is marked independently. If a later teacher needs attention, previously created teachers remain created and the administrator can resume the remaining queue.

## 7. Server-side safety controls

The setup API is school-admin protected and school-scoped:

```text
PATCH /api/admin/teachers/imports/[id]/setup
```

Before persisting setup data, it verifies:

- the administrator has school-admin access;
- the import belongs to the active school;
- the import uses the new `identity_setup_v1` workflow;
- the import is in `review_ready` state;
- the selected homeroom is a valid active class group in the school;
- selected teaching class groups are valid active class groups in the school;
- selected subject offerings are valid active offerings in the school; and
- each selected subject offering is configured for the selected class where class-level restrictions exist.

Photo URLs are resolved through the existing school-scoped persisted-photo helper. The wizard does not write directly to MongoDB.

The final teacher creation continues to use the existing authorization and domain validation in the teacher-create route.

## 8. Persistence model

V2 reuses the existing `TeacherImportJob` rather than introducing a new import collection.

The job stores:

- source filename and import metadata;
- selected worksheet and column mappings;
- parsed identity rows;
- source row numbers and source identity values;
- setup status for each row;
- edited identity fields;
- homeroom class-group ID;
- subject-offering IDs;
- explicit setup assignments;
- optional photo URL;
- created teacher ID; and
- final import result.

`BackgroundJob` remains the execution receipt for background analysis. `TeacherImportJob` remains the source of truth for the staged review/setup state.

When all staged teachers are complete, the import is marked completed and the retained upload bytes are released according to the existing workflow cleanup behavior.

## 9. New and legacy workflow boundary

New uploads use:

```text
identity_setup_v1
```

Older staged imports may still use:

```text
legacy_relationship_review
```

The legacy review surface is retained for backward compatibility with old jobs. New identity imports are routed directly to the guided setup wizard and do not use the old spreadsheet relationship-review UI.

This separation prevents an old job shape from being silently interpreted as a new identity-only job.

## 10. Relevant implementation map

| Area | Implementation |
|---|---|
| Upload boundary | `src/app/api/admin/teachers/bulk-create/route.ts` |
| Active draft lookup | `src/app/api/admin/teachers/imports/route.ts` |
| Setup persistence | `src/app/api/admin/teachers/imports/[id]/setup/route.ts` |
| Guided wizard | `src/components/admin/teachers/import/TeacherImportSetupWizard.tsx` |
| Import modal and resume entry point | `src/components/modals/ImportTeachersCSVModal.tsx` |
| Identity analysis | `src/lib/teachers/analyze-teacher-identity-import.ts` |
| CSV/XLS/XLSX parsing | `src/lib/teachers/parse-teacher-import.ts` |
| Identity template | `src/lib/teachers/teacher-import-template.ts` |
| Existing teacher creation | `src/app/api/admin/teachers/create/route.ts` |
| Import persistence model | `src/models/TeacherImportJob.ts` |
| Identity regression tests | `tests/teacher-import-identity.test.ts` |

## 11. Verification evidence

The focused identity test suite covers the most important V2 contract points:

- middle-name tokens are retained in the platform-compatible first name;
- irrelevant source columns are excluded from the identity staging payload; and
- the downloadable template contains only the intended identity fields.

The focused suite currently passes:

```text
3 tests passed
0 tests failed
```

The wizard has also passed targeted ESLint and `git diff --check` verification during the UI finishing work. A full repository TypeScript check remains affected by unrelated existing errors in other application areas; no errors were reported for the edited teacher setup wizard.

These checks are static/local evidence. They do not substitute for a signed-in browser run against a deployed Cloudflare/Hetzner/Coolify environment, a live Leo provider response, or a production Inngest delivery test.

## 12. Acceptance checklist

- [x] Upload accepts CSV, XLS, and XLSX files.
- [x] Official identity template contains only Teacher Name, Phone, and Email.
- [x] Non-relevant source columns are ignored at the identity staging boundary.
- [x] Leo assists with source-header interpretation when mappings are not explicitly supplied.
- [x] Upload analysis does not create teachers.
- [x] Full names preserve middle-name tokens instead of discarding them.
- [x] Imported identity values are prefilled and editable.
- [x] Homeroom is optional and selected from active school class groups.
- [x] Teaching assignments use searchable, selectable class-group cards.
- [x] Subject choices are constrained to active school subject offerings.
- [x] Avatar upload is optional.
- [x] Setup can be saved and resumed later.
- [x] Each teacher is created through the established teacher creation API.
- [x] School scope and catalog IDs are validated server-side.
- [x] Legacy jobs remain distinguishable from new identity setup jobs.

## 13. Recommended next operational check

Before treating the workflow as production-ready, perform one signed-in end-to-end test with a representative school workbook:

1. upload a workbook containing extra irrelevant columns;
2. confirm Leo or the safe fallback maps only name, phone, and email;
3. verify no teacher is created during analysis;
4. edit one imported name and confirm the middle-name behavior;
5. choose a homeroom and at least two teaching class groups;
6. select subject offerings from each class group;
7. save and close the wizard;
8. reopen the teacher import and resume setup;
9. upload an optional avatar; and
10. create the teacher and verify the resulting teacher, homeroom, subject assignments, and school scope.

This test should be run with the real authentication session, school catalog, Leo configuration, background worker, storage provider, and deployed application—not only against local static checks.
