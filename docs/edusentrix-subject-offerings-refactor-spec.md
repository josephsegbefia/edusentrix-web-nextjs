# EduSentrix Subject Offerings Refactor Specification

## 1. Purpose

EduSentrix currently treats `Subject` as a mostly flat school-wide directory. This is no longer sufficient for a curriculum-aware School OS because the same subject name can mean different things across curriculum levels.

Example:

- Mathematics - Lower Primary
- Mathematics - Upper Primary
- Mathematics - JHS
- Cambridge Primary Mathematics
- British Key Stage 3 Mathematics

These should not all share the same operational subject identity or subject code.

This specification introduces **Subject Offerings** as the actual academic subject unit used across EduSentrix.

The goal is to refactor the platform now, while there are no real production schools, so future modules can work cleanly with curriculum, lesson notes, lessons, schemes of work, class schedules, gradebook, exams, reports, and AI.

---

## 2. Core Principle

EduSentrix must separate:

```txt
Subject = broad subject family/catalog item
Subject Offering = how that subject exists in a specific curriculum, stage, grade band, and grade range
```

### Example

```txt
Subject:
Mathematics

Subject Offerings:
- NaCCA Lower Primary Mathematics     NACCA-LP-MATH
- NaCCA Upper Primary Mathematics     NACCA-UP-MATH
- NaCCA JHS Mathematics               NACCA-JHS-MATH
- Cambridge Primary Mathematics       CAMB-PRI-MATH
- British Key Stage 3 Mathematics     BRIT-KS3-MATH
```

Operational modules should use `subjectOfferingId`, not the generic `subjectId`.

---

## 3. Why This Refactor Is Needed

The current flat subject model creates these problems:

1. A school can only have one subject named `Mathematics` because of uniqueness rules.
2. Upper Primary Mathematics and JHS Mathematics cannot have different codes cleanly.
3. Lesson note presets must infer too much from grade/class context.
4. Scheme of Work cannot reliably map to subject-level curriculum standards.
5. Examinations and Question Bank may mix questions across levels.
6. Timetable/class schedule creation can assign inappropriate subjects to grades.
7. Teacher assignments are too broad when based only on generic subjects.
8. Reports and analytics cannot distinguish subject level properly.
9. Future curriculum support becomes messy for Cambridge, British, IB, American, Montessori, and custom curricula.

---

## 4. Target Architecture

```txt
Curriculum
  → Subject Template / Offering Template
    → Subject Family
      → School Subject Offering
        → Class Group Subject Assignment
          → Teacher Assignment
            → Lesson Notes / Lessons / Schemes / Exams / Reports
```

---

## 5. Model Definitions

## 5.1 Subject Model

The `Subject` model becomes a broad school-specific subject family.

### Required file

```txt
src/models/Subject.ts
```

### Target shape

```ts
type SubjectCategory =
  | "core"
  | "elective"
  | "learning_area"
  | "co_curricular"
  | "custom";

type Subject = {
  _id: ObjectId;
  schoolId: ObjectId;

  name: string; // Mathematics
  normalizedKey: string; // mathematics

  category?: SubjectCategory;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
};
```

### Indexes

```ts
SubjectSchema.index(
  { schoolId: 1, normalizedKey: 1 },
  { unique: true }
);
```

### Notes

- `Subject` should not carry curriculum/stage/grade-band details.
- `Subject` should mainly support grouping, reporting, and subject-family analytics.
- Existing `Subject` data in test schools can be migrated into subject families.

---

## 5.2 SubjectOffering Model

Create a new model:

```txt
src/models/SubjectOffering.ts
```

### Target shape

```ts
type CurriculumCode =
  | "ghana_nacca"
  | "cambridge"
  | "ib_pyp"
  | "ib_myp"
  | "british_nc"
  | "american"
  | "montessori"
  | "custom"
  | "hybrid";

type SubjectOfferingStage =
  | "creche"
  | "nursery"
  | "kg"
  | "lower_primary"
  | "upper_primary"
  | "jhs"
  | "shs"
  | "cambridge_primary"
  | "cambridge_lower_secondary"
  | "british_key_stage_1"
  | "british_key_stage_2"
  | "british_key_stage_3"
  | "ib_pyp"
  | "ib_myp"
  | "american_elementary"
  | "american_middle"
  | "custom";

type SubjectOfferingGradeBand =
  | "preschool"
  | "lower_primary"
  | "upper_primary"
  | "jhs"
  | "shs"
  | "custom";

type LessonNoteTemplateVariant =
  | "early_years_activity_plan"
  | "nacca_primary"
  | "nacca_jhs"
  | "classic"
  | "custom";

type SubjectOffering = {
  _id: ObjectId;
  schoolId: ObjectId;

  subjectId: ObjectId;

  curriculumCode: CurriculumCode;
  curriculumId?: ObjectId | null;

  subjectFamily: string; // Mathematics
  displayName: string; // Mathematics - JHS
  shortName: string; // Mathematics

  code: string; // NACCA-JHS-MATH

  stage: SubjectOfferingStage;
  gradeBand: SubjectOfferingGradeBand;
  gradeIds: ObjectId[];

  category: SubjectCategory;

  lessonNoteTemplateVariant?: LessonNoteTemplateVariant;
  assessmentProfileId?: ObjectId | null;
  reportCardGroup?: string;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
};
```

### Indexes

```ts
SubjectOfferingSchema.index(
  { schoolId: 1, curriculumCode: 1, code: 1 },
  { unique: true }
);

SubjectOfferingSchema.index({ schoolId: 1, subjectId: 1 });
SubjectOfferingSchema.index({ schoolId: 1, stage: 1 });
SubjectOfferingSchema.index({ schoolId: 1, gradeBand: 1 });
SubjectOfferingSchema.index({ schoolId: 1, gradeIds: 1 });
```

---

## 6. NaCCA Grade Band Mapping

For Ghana NaCCA schools, use the following grade bands:

```txt
preschool:
- Creche
- Nursery
- KG1
- KG2

lower_primary:
- Basic 1 / Primary 1
- Basic 2 / Primary 2
- Basic 3 / Primary 3

upper_primary:
- Basic 4 / Primary 4
- Basic 5 / Primary 5
- Basic 6 / Primary 6

jhs:
- JHS 1
- JHS 2
- JHS 3

shs:
- SHS 1
- SHS 2
- SHS 3
```

The grade band should be derived from the `Grade` model’s code, stage, and order where possible.

---

## 7. Recommended NaCCA Subject Offerings

## 7.1 Preschool / Early Years

```txt
NACCA-EY-COMM-LANG     Communication & Language
NACCA-EY-NUM           Numeracy Readiness
NACCA-EY-CREATIVE      Creative Play / Creative Arts
NACCA-EY-MUSIC-MOVE    Music & Movement
NACCA-EY-STORY         Story Time
NACCA-EY-PHYSICAL      Physical Development
NACCA-EY-HYGIENE       Health & Hygiene Routines
NACCA-EY-SENSORY       Sensory Play
NACCA-EY-SOCIAL        Personal, Social & Emotional Development
```

## 7.2 Lower Primary

```txt
NACCA-LP-ENG       English Language - Lower Primary
NACCA-LP-MATH      Mathematics - Lower Primary
NACCA-LP-SCI       Science - Lower Primary
NACCA-LP-OWOP      Our World and Our People - Lower Primary
NACCA-LP-RME       Religious and Moral Education - Lower Primary
NACCA-LP-CARTS     Creative Arts - Lower Primary
NACCA-LP-COMP      Computing - Lower Primary
NACCA-LP-GHL       Ghanaian Language - Lower Primary
NACCA-LP-PE        Physical Education - Lower Primary
```

## 7.3 Upper Primary

```txt
NACCA-UP-ENG       English Language - Upper Primary
NACCA-UP-MATH      Mathematics - Upper Primary
NACCA-UP-SCI       Science - Upper Primary
NACCA-UP-OWOP      Our World and Our People - Upper Primary
NACCA-UP-RME       Religious and Moral Education - Upper Primary
NACCA-UP-CARTS     Creative Arts - Upper Primary
NACCA-UP-COMP      Computing - Upper Primary
NACCA-UP-GHL       Ghanaian Language - Upper Primary
NACCA-UP-PE        Physical Education - Upper Primary
NACCA-UP-FRE       French - Upper Primary
```

## 7.4 JHS

```txt
NACCA-JHS-ENG       English Language - JHS
NACCA-JHS-MATH      Mathematics - JHS
NACCA-JHS-SCI       Science - JHS
NACCA-JHS-SOC       Social Studies - JHS
NACCA-JHS-COMP      Computing - JHS
NACCA-JHS-RME       Religious and Moral Education - JHS
NACCA-JHS-CAD       Creative Arts and Design - JHS
NACCA-JHS-CTECH     Career Technology - JHS
NACCA-JHS-GHL       Ghanaian Language - JHS
NACCA-JHS-PEH       Physical Education and Health - JHS
NACCA-JHS-FRE       French - JHS
```

---

## 8. Non-NaCCA Curriculum Support

Subject offerings must be generated from curriculum-specific templates.

Supported curriculum groups should include:

```txt
Cambridge:
- Cambridge Primary
- Cambridge Lower Secondary

British National Curriculum:
- EYFS
- Key Stage 1
- Key Stage 2
- Key Stage 3

IB:
- PYP
- MYP

American:
- Elementary
- Middle School

Montessori:
- Practical Life
- Sensorial
- Language
- Mathematics
- Cultural Studies

Custom / Hybrid:
- School-defined stages and subject offerings
```

Do not create curriculum-specific models. Use the same `SubjectOffering` model with curriculum metadata.

---

## 9. Curriculum Subject Template Registry

Upgrade the existing curriculum template registry.

### Likely existing file

```txt
src/constants/curriculum-subject-templates.ts
```

### Target template shape

```ts
type CurriculumSubjectOfferingTemplate = {
  curriculumCode: CurriculumCode;

  subjectFamily: string;       // Mathematics
  displayName: string;         // Mathematics - JHS
  shortName: string;           // Mathematics
  code: string;                // NACCA-JHS-MATH

  stage: SubjectOfferingStage;
  gradeBand: SubjectOfferingGradeBand;
  gradeCodes: string[];        // ["JHS1", "JHS2", "JHS3"]

  category: SubjectCategory;

  lessonNoteTemplateVariant?: LessonNoteTemplateVariant;
  assessmentProfile?: string;
  reportCardGroup?: string;

  isDefault: boolean;
};
```

### Required behavior

The school setup flow must use this registry to suggest offerings based on:

```txt
school curriculum
school type
created grades
supported stages
```

---

## 10. School Setup Flow Improvements

## 10.1 Current problem

The current subject setup flow recommends flat subjects and does not properly preserve codes, curriculum, grade bands, or stage metadata.

## 10.2 Target flow

```txt
1. School selects curriculum during setup.
2. School creates/selects grades offered.
3. EduSentrix derives grade bands/stages.
4. EduSentrix loads curriculum-aware subject offering templates.
5. Admin reviews grouped offerings.
6. Admin selects offerings the school will use.
7. System creates subject families where needed.
8. System creates subject offerings with correct metadata.
9. System auto-suggests class group assignments based on grade coverage.
10. Admin reviews assignments before saving.
```

## 10.3 Setup UI requirements

The subject setup step should be grouped by stage/grade band.

Example:

```txt
NaCCA Subject Setup

Preschool / Early Years
☑ Communication & Language       NACCA-EY-COMM-LANG
☑ Numeracy Readiness             NACCA-EY-NUM

Lower Primary
☑ English Language               NACCA-LP-ENG
☑ Mathematics                    NACCA-LP-MATH
☑ Science                        NACCA-LP-SCI

Upper Primary
☑ English Language               NACCA-UP-ENG
☑ Mathematics                    NACCA-UP-MATH
☑ Science                        NACCA-UP-SCI

JHS
☑ English Language               NACCA-JHS-ENG
☑ Mathematics                    NACCA-JHS-MATH
☑ Science                        NACCA-JHS-SCI
☑ Career Technology              NACCA-JHS-CTECH
```

Each offering row/card should show:

```txt
Display name
Code
Curriculum badge
Grade coverage
Category
Lesson note preset
```

## 10.4 UX rules

- Use the existing premium UI style.
- Use premium dropdowns/selects.
- Avoid raw `<select>` elements.
- Show grouped cards, not one long flat list.
- Show warning badges for offerings that do not match any created grade.
- Allow custom offering creation for hybrid/custom schools.
- Allow deselecting optional offerings.
- Required/default offerings should be preselected.

---

## 11. `/admin/subjects?view=cards` Refactor

This page should become the **Subject Offerings Directory**.

### Existing route

```txt
/admin/subjects?view=cards
```

### Target purpose

The page should manage and visualize the school’s active curriculum-aware subject offerings.

## 11.1 Recommended tabs

For NaCCA schools:

```txt
All
Preschool
Lower Primary
Upper Primary
JHS
SHS
Custom
```

For other curricula, use curriculum-specific groups:

```txt
Cambridge Primary
Cambridge Lower Secondary
British Key Stage 1
British Key Stage 2
British Key Stage 3
IB PYP
IB MYP
American Elementary
American Middle School
Custom
```

## 11.2 Filters

Add filters for:

```txt
Curriculum
Stage
Grade band
Category
Grade coverage
Active status
Assigned / unassigned
Teacher assigned / unassigned
```

## 11.3 Subject offering card content

Each card should show:

```txt
Mathematics - JHS
NACCA-JHS-MATH
Curriculum: NaCCA
Covers: JHS 1, JHS 2, JHS 3
Category: Core
Assigned Classes: 3
Assigned Teachers: 2
Status: Active
```

## 11.4 Actions

Each offering should support:

```txt
View
Edit Offering
Assign to Class Groups
Assign Teachers
Deactivate
Duplicate as Custom
```

## 11.5 Backward display compatibility

Where space is limited, display `shortName`:

```txt
Mathematics
```

Where clarity is needed, display `displayName` and code:

```txt
Mathematics - JHS · NACCA-JHS-MATH
```

---

## 12. Backend API Requirements

## 12.1 Subject family APIs

Existing `/api/admin/subjects` can remain for subject families, but it must not be the main operational academic subject endpoint.

## 12.2 New subject offering APIs

Create:

```txt
GET    /api/admin/subject-offerings
POST   /api/admin/subject-offerings
GET    /api/admin/subject-offerings/[id]
PATCH  /api/admin/subject-offerings/[id]
DELETE /api/admin/subject-offerings/[id]

POST   /api/admin/subject-offerings/bulk
POST   /api/admin/subject-offerings/setup-from-curriculum
POST   /api/admin/subject-offerings/[id]/assign-class-groups
POST   /api/admin/subject-offerings/[id]/assign-teachers
```

## 12.3 `GET /api/admin/subject-offerings`

Supports query params:

```txt
curriculumCode
stage
gradeBand
gradeId
category
isActive
search
view
```

Response should include:

```ts
type SubjectOfferingListItem = {
  id: string;
  subjectId: string;
  subjectFamily: string;
  displayName: string;
  shortName: string;
  code: string;
  curriculumCode: string;
  stage: string;
  gradeBand: string;
  gradeIds: string[];
  category: string;
  lessonNoteTemplateVariant?: string;
  assignedClassGroupCount: number;
  assignedTeacherCount: number;
  isActive: boolean;
};
```

## 12.4 `POST /api/admin/subject-offerings/setup-from-curriculum`

Payload:

```ts
type SetupSubjectOfferingsPayload = {
  curriculumCode: CurriculumCode;
  selectedOfferingCodes: string[];
  gradeIds: string[];
  autoAssignToMatchingClassGroups: boolean;
};
```

Response:

```ts
type SetupSubjectOfferingsResult = {
  createdSubjects: number;
  createdOfferings: number;
  assignedClassGroups: number;
  skippedExisting: number;
  warnings: string[];
};
```

## 12.5 Validation rules

- `code` must be unique per school/curriculum.
- `gradeIds` must belong to the same school.
- Offering stage/grade band must match grade coverage.
- Custom offerings may override grade-band rules with explicit admin confirmation.
- Inactive offerings cannot be newly assigned to class groups.
- Deactivating an offering with active schedules/lesson notes/exams should require confirmation and show impact.

---

## 13. Class Group Integration

## 13.1 Current issue

Class groups currently use subject IDs.

Target change:

```ts
classGroup.subjectOfferingIds: ObjectId[];
```

## 13.2 Assignment compatibility

When assigning subject offerings to a class group:

1. Load class group grade.
2. Load subject offering gradeIds / gradeBand.
3. Validate compatibility.
4. Block invalid assignment unless offering is custom and admin confirms.

Example invalid case:

```txt
NACCA-JHS-MATH cannot be assigned to Basic 2.
```

## 13.3 Class group assignment UI

In the class group editor, the subject selection UI should show offerings grouped by stage.

For the current class group grade, prioritize compatible offerings.

Example for JHS 1:

```txt
Recommended for JHS 1
☑ Mathematics - JHS          NACCA-JHS-MATH
☑ Science - JHS              NACCA-JHS-SCI
☑ Social Studies - JHS       NACCA-JHS-SOC

Other offerings
⚠ Mathematics - Upper Primary NACCA-UP-MATH
```

---

## 14. Teacher Assignment Integration

Teacher assignments must reference `subjectOfferingId`.

Target shape:

```ts
type TeacherAssignment = {
  schoolId: ObjectId;
  teacherId: ObjectId;
  classGroupId: ObjectId;
  subjectOfferingId: ObjectId;
  subjectId?: ObjectId; // optional denormalized family reference
};
```

## Rules

- A teacher should be assigned to the exact offering they teach.
- A teacher assigned to `NACCA-JHS-MATH` is not automatically assigned to `NACCA-UP-MATH`.
- Teacher dashboard/class filters should display `shortName`, but detail screens should show `displayName` and code where useful.

---

## 15. Class Schedule / Timetable Integration

This is critical.

Class schedules should use `subjectOfferingId`, not `subjectId`.

## 15.1 Timetable slot target shape

```ts
type TimetableSlot = {
  schoolId: ObjectId;
  classGroupId: ObjectId;
  subjectOfferingId: ObjectId;
  subjectId?: ObjectId;
  teacherId?: ObjectId;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  periodId?: ObjectId;
};
```

## 15.2 Subject offering presentation during class schedule creation

When creating a class schedule for a class group, the subject dropdown must show only compatible subject offerings by default.

### Example for JHS 1 Gold

```txt
Subject Offering Dropdown

Recommended for JHS 1 Gold
- Mathematics - JHS · NACCA-JHS-MATH
- English Language - JHS · NACCA-JHS-ENG
- Science - JHS · NACCA-JHS-SCI
- Social Studies - JHS · NACCA-JHS-SOC

Other active offerings
- Mathematics - Upper Primary · NACCA-UP-MATH  ⚠ Not recommended for JHS 1
```

## 15.3 Dropdown display format

Each option should show:

```txt
shortName / displayName
code
stage / grade coverage
assigned teacher availability indicator
```

Compact option:

```txt
Mathematics - JHS
NACCA-JHS-MATH · JHS 1–JHS 3
```

## 15.4 Filtering rules

Default filter:

```txt
Only offerings assigned to this class group
```

If no offerings have been assigned to the class group, show:

```txt
No subjects assigned to this class group yet.
Assign subjects first or choose from compatible offerings.
```

Optional fallback:

```txt
Show compatible unassigned offerings
```

Do not silently allow incompatible offerings.

## 15.5 Teacher dropdown dependency

After selecting a subject offering, the teacher dropdown should show:

```txt
Teachers assigned to this class group + subject offering
```

Then optionally:

```txt
Other teachers who can teach this subject family
Other active teachers
```

Use warning badges for non-assigned teachers.

## 15.6 Conflict validation

When saving a timetable slot, validate:

- subject offering is active;
- subject offering is compatible with class group grade;
- subject offering is assigned to class group, unless override is explicitly allowed;
- teacher is assigned to subject offering/class group, unless override is allowed;
- teacher has no overlapping slot;
- class group has no overlapping slot;
- slot does not conflict with break periods;
- slot falls inside the active daily schedule.

## 15.7 Schedule UI requirements

- Use premium dropdowns/selects.
- Group subject offering options.
- Use warning badges for incompatible or unassigned offerings.
- Show offering code visibly.
- Use custom date/time components where applicable.
- Avoid raw HTML selects.

---

## 16. Module-Wide Refactor Requirements

All academic modules must move from operational `subjectId` to `subjectOfferingId`.

## 16.1 Class Groups

Change:

```ts
subjectIds: ObjectId[]
```

to:

```ts
subjectOfferingIds: ObjectId[]
```

Keep `subjectIds` only temporarily if needed for migration/testing.

## 16.2 Teacher Assignments

Use:

```ts
subjectOfferingId
```

## 16.3 Lesson Notes

Add/require:

```ts
subjectOfferingId: ObjectId;
subjectId?: ObjectId;
subjectNameSnapshot?: string;
subjectOfferingCodeSnapshot?: string;
```

The lesson note wizard should infer:

```txt
curriculum
stage
grade band
lesson note template variant
labels
hints
examples
optional fields
```

from the selected/offered `SubjectOffering`.

## 16.4 Lessons

Lessons inherit `subjectOfferingId` from Lesson Notes.

```ts
Lesson {
  sourceLessonNoteId: ObjectId;
  subjectOfferingId: ObjectId;
  subjectId?: ObjectId;
}
```

## 16.5 Curriculum & Scheme of Work

Use:

```ts
SchemeOfWork.subjectOfferingId
SchemeItem.subjectOfferingId? // optional if inherited from scheme
```

## 16.6 Coverage

Coverage should group by `subjectOfferingId` and allow rollup by `subjectId` / subject family.

## 16.7 Examinations & Question Bank

Use:

```ts
ExamPaper.subjectOfferingId
QuestionBankItem.subjectOfferingId
```

Question bank filters should distinguish:

```txt
Mathematics - Upper Primary
Mathematics - JHS
```

## 16.8 Gradebook / Assessments

Use:

```ts
Assessment.subjectOfferingId
GradebookEntry.subjectOfferingId
```

## 16.9 Timetable

Use:

```ts
TimetableSlot.subjectOfferingId
```

## 16.10 Reports / Analytics

Reports should display `shortName` where compact, but group accurately by offering.

Example:

```txt
Mathematics - JHS
Mathematics - Upper Primary
```

Rollup views can aggregate by subject family:

```txt
Mathematics total across school
```

## 16.11 AI / Leo

AI prompts should receive:

```txt
subject offering name
subject offering code
curriculum
stage
grade band
grade/class group
scheme items
lesson note context
```

This improves AI generation quality for lessons, exams, schemes, and flashcards.

---

## 17. Migration Strategy

Because there are no real production schools yet, perform a clean migration.

## 17.1 Migration steps

1. Create `SubjectOffering` model.
2. Update subject setup wizard to create offerings.
3. Update class groups to use `subjectOfferingIds`.
4. Update teacher assignments to use `subjectOfferingId`.
5. Update academic modules to use `subjectOfferingId`.
6. Write a one-time migration for test schools.
7. Update seeds/test-school generator to create subject offerings directly.
8. Remove old operational `subjectId` assumptions from new code.

## 17.2 Test school migration

For existing test data:

- If school curriculum is known, map subjects to curriculum-aware offerings.
- If curriculum is unknown, create `CUSTOM-GENERAL-*` offerings.
- If data is not worth preserving, reset/reseed test schools.

## 17.3 Backward fields

During transition, models may temporarily keep:

```ts
subjectId?: ObjectId;
```

as a denormalized subject-family reference, but new writes must include:

```ts
subjectOfferingId: ObjectId;
```

---

## 18. Permissions and Access

Existing subject management permissions should be reviewed.

Recommended permissions:

```txt
subjects.read
subjects.manageFamilies
subjectOfferings.read
subjectOfferings.create
subjectOfferings.update
subjectOfferings.deactivate
subjectOfferings.assignClassGroups
subjectOfferings.assignTeachers
subjectOfferings.setupFromCurriculum
```

School admins should usually have all subject-offering permissions.

Academic heads may have read/setup/assignment permissions depending on school configuration.

Teachers should usually only read assigned offerings.

---

## 19. UI/UX Requirements

All new UI must follow the EduSentrix premium UI style.

## 19.1 Required components

Use:

```txt
PremiumSelect / PremiumDropdown
Custom Date Picker where dates are used
Premium cards
Badges
Search input
Skeleton loaders
Empty states
Confirmation modals
Sonner/busy toasts
```

Avoid:

```txt
raw HTML select
raw unstyled tables
silent failures
unclear duplicate errors
```

## 19.2 Empty states

Subject Offering Directory empty state:

```txt
No subject offerings have been set up yet.
Start from your selected curriculum or create a custom subject offering.
```

Class schedule empty state:

```txt
No compatible subject offerings are assigned to this class group.
Assign subjects before creating a timetable.
```

## 19.3 Warning patterns

Use warning badges for:

```txt
No grade coverage
No assigned class groups
No assigned teachers
Incompatible with selected class group
Inactive offering
Custom override
```

---

## 20. Completion Verification Checklist

The refactor is not complete until all checks pass.

## 20.1 Model checks

- [ ] `SubjectOffering` model exists.
- [ ] `Subject` has `normalizedKey` uniqueness per school.
- [ ] Subject offerings have unique codes per school/curriculum.
- [ ] Subject offerings store curriculum, stage, grade band, gradeIds, and lesson note variant.

## 20.2 School setup checks

- [ ] Subject setup uses curriculum-aware templates.
- [ ] NaCCA offerings are grouped by Preschool, Lower Primary, Upper Primary, and JHS.
- [ ] Non-NaCCA curricula show appropriate stage groups.
- [ ] Bulk setup preserves codes, categories, grade bands, and lesson note variants.
- [ ] Setup can auto-assign offerings to matching class groups.

## 20.3 Admin subjects page checks

- [ ] `/admin/subjects?view=cards` displays subject offerings, not only flat subjects.
- [ ] Cards show offering code, curriculum, grade coverage, category, class count, teacher count.
- [ ] Filters for curriculum/stage/grade band/category/status exist.
- [ ] Edit/assign/deactivate actions work.

## 20.4 Class group checks

- [ ] Class groups store `subjectOfferingIds`.
- [ ] Assigning incompatible offerings is blocked or explicitly warned.
- [ ] Class group subject assignment UI groups and filters offerings correctly.

## 20.5 Teacher assignment checks

- [ ] Teacher assignments use `subjectOfferingId`.
- [ ] Teacher can be assigned to JHS Mathematics without being assigned to Upper Primary Mathematics.
- [ ] Teacher dashboard displays correct offering names.

## 20.6 Class schedule/timetable checks

- [ ] Timetable slots use `subjectOfferingId`.
- [ ] Subject dropdown shows compatible offerings for the selected class group.
- [ ] Offering code and grade coverage are visible in schedule creation.
- [ ] Teacher dropdown filters by selected subject offering.
- [ ] Conflict validation checks class, teacher, breaks, and offering compatibility.
- [ ] Incompatible subject offerings are not silently assignable.

## 20.7 Academic module checks

- [ ] Lesson Notes use `subjectOfferingId`.
- [ ] Lessons inherit `subjectOfferingId` from Lesson Notes.
- [ ] Schemes of Work use `subjectOfferingId`.
- [ ] Coverage groups by `subjectOfferingId`.
- [ ] Gradebook/assessments use `subjectOfferingId`.
- [ ] Examinations and Question Bank use `subjectOfferingId`.
- [ ] Reports distinguish Upper Primary Mathematics and JHS Mathematics.

## 20.8 AI checks

- [ ] Leo receives subject offering metadata in lesson generation.
- [ ] Leo receives subject offering metadata in exam question generation.
- [ ] Leo receives stage/grade-band context for curriculum-aware outputs.

## 20.9 Regression checks

- [ ] Existing test schools can be migrated or reseeded.
- [ ] No route crashes because of missing `subjectId` assumptions.
- [ ] No old subject-selection modal discards subject code/category/stage metadata.
- [ ] All new APIs enforce school scoping.
- [ ] All affected pages use premium UI controls.

---

## 21. Recommended Implementation Order

## Chunk 1: Data foundation

- Create `SubjectOffering` model.
- Update `Subject` model.
- Add curriculum subject offering template registry.
- Add helper to derive grade bands.

## Chunk 2: APIs

- Add subject offering CRUD APIs.
- Add setup-from-curriculum API.
- Add assignment APIs for class groups and teachers.

## Chunk 3: Setup wizard

- Replace flat subject selection with grouped subject-offering setup.
- Preserve metadata during creation.
- Add auto-assignment preview.

## Chunk 4: Admin subjects page

- Refactor `/admin/subjects?view=cards` to show subject offerings.
- Add filters, tabs, and offering cards.

## Chunk 5: Class groups and teacher assignments

- Update class groups to use `subjectOfferingIds`.
- Update teacher assignments to use `subjectOfferingId`.
- Update assignment UIs.

## Chunk 6: Class schedules/timetable

- Update schedule creation to use subject offerings.
- Improve dropdown presentation and validation.
- Update timetable slot model/API/UI.

## Chunk 7: Academic modules

Update:

```txt
Lesson Notes
Lessons
Schemes of Work
Coverage
Gradebook
Assignments/Quizzes
Examinations
Question Bank
Reports
Analytics
```

## Chunk 8: Migration and seeds

- Migrate existing test data.
- Update internal test school generator.
- Update seed scripts.

## Chunk 9: QA

- Run full setup flow for NaCCA school.
- Run setup flow for custom/hybrid school.
- Create class schedules using subject offerings.
- Create lesson note, lesson, scheme, exam, and report using offering.

---

## 22. Final Expected Outcome

After this refactor, EduSentrix should treat the actual academic subject as:

```txt
Subject Offering
```

not generic `Subject`.

This enables clean support for:

```txt
NaCCA Preschool
NaCCA Lower Primary
NaCCA Upper Primary
NaCCA JHS
SHS
Cambridge
British National Curriculum
IB PYP/MYP
American
Montessori
Custom/Hybrid curricula
```

It also prevents future confusion in:

```txt
class schedules
teacher assignments
lesson notes
lessons
schemes of work
coverage
examinations
question bank
reports
AI generation
```

This refactor should be completed now, before real schools are onboarded.
