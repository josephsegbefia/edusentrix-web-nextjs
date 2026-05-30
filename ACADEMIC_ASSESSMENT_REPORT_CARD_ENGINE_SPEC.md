# EduSentrix Academic Assessment & Report Card Engine Spec

**Version:** 1.0  
**Product Area:** Academics, Teacher Studio, Gradebook, Reports, Attendance  
**Primary Roles:** School Admin, Headteacher, Homeroom Teacher, Subject Teacher, Parent, Student  
**Project:** `edusentrix-web-nextjs`  
**Implementation Style:** Small safe AI-agent slices, no broad rewrites, preserve current UI system

---

## 1. Executive Summary

EduSentrix currently has a working but limited academic marks flow:

- Teachers create assignments/quizzes in Teacher Studio.
- Students submit some work in-app.
- Teachers mark submissions.
- Marks are stored using the existing `Assessment` model.
- The teacher gradebook groups marks using hardcoded CA/exam assumptions.
- Final published results are stored using the existing `SubjectGrade` model.
- Student academic summaries currently rely on `SubjectGrade` and `TermResult`.

This spec replaces that loose flow with a proper **Academic Assessment & Report Card Engine**.

The new engine must support:

- In-app assignments and offline marks.
- School-defined grading systems.
- A/B/C, 1/2/3, descriptor-based, or custom grade labels.
- School-defined score components such as `Classroom Work 30%` and `Exam 70%`.
- Assessment plans per grade, class group, academic period, and curriculum.
- Both teacher-selected and rule-based contribution modes.
- Subject teachers recording marks only for the class/subject they teach.
- Homeroom teachers coordinating report-card creation for their class.
- Daily homeroom attendance feeding report-card attendance.
- Admin/headteacher approval before release.
- Locked report-card snapshots after release.
- Clean integration into the Student Academic Profile system.

This is not simply “Assignments v2.” Assignments become one possible source of official assessment evidence.

The core product model is:

```txt
School Grading Policy
        ↓
Assessment Plan
        ↓
Assessment Items + Assessment Scores
        ↓
Subject Results
        ↓
Class Report Card Run
        ↓
Student Report Card Snapshots
        ↓
Approved / Released Reports
```

---

## 2. Current Codebase Context

Agents must inspect the actual project before coding. Current relevant areas include:

```txt
AGENTS.md
src/models/Assessment.ts
src/models/GradingScale.ts
src/models/SubjectGrade.ts
src/models/TermResult.ts
src/models/StudentAttendance.ts
src/models/ReportTemplate.ts
src/components/teacher/gradebook/*
src/hooks/teacher/useTeacherGradebook.ts
src/hooks/teacher/useTeacherGradebookRecord.ts
src/hooks/teacher/useTeacherGradebookAssessments.ts
src/app/(app)/teacher/gradebook/*
src/app/(app)/teacher/studio/*
src/app/api/teacher/gradebook/*
src/app/api/teacher/studio/*
src/components/admin/students/detail/*
src/lib/academics/*
src/types/admin/student-academics.ts
```

Important current weaknesses to address:

1. `Assessment` mixes assessment item definition and individual student score.
2. Teacher gradebook reconstructs assessment columns from repeated score rows.
3. CA and Exam grouping is hardcoded with sets like `CA_TYPES` and `EXAM_TYPES`.
4. `GradingScale` assumes `caWeight` and `examWeight` instead of dynamic components.
5. `SubjectGrade` assumes `caTotal`, `examScore`, and `gradeLetter`.
6. Report generation and student academics rely on old `SubjectGrade`/`TermResult` assumptions.
7. There is no full report-card run workflow coordinated by homeroom teachers.
8. Daily homeroom attendance is not yet the authoritative report-card attendance source.

Agents must not blindly copy current patterns where they conflict with this spec.

---

## 3. Non-Negotiable Product Principles

### 3.1 Assessment-first, not assignment-first

The official academic record must be based on assessment items and scores. Assignments, quizzes, offline exercises, exams, projects, oral work, and practical work are all mark sources.

### 3.2 Separate recording from report contribution

A teacher may record many marks during the term. Only selected or rule-qualified marks contribute to the report card.

Every official mark item must answer:

```txt
Does this contribute to the final report card?
If yes, which score component does it contribute to?
```

### 3.3 Dynamic score components

Never hardcode CA/exam logic in new code. The school policy decides the components.

Examples:

```txt
Classroom Work 30% + Exam 70%
Homework 10% + Classwork 10% + Project 10% + Exam 70%
Oral 20% + Practical 30% + Written 50%
```

### 3.4 Grade labels must be neutral

Do not use `gradeLetter` in new models or DTOs unless preserving old compatibility.

Use:

```txt
gradeLabel
gradePoint
descriptor
```

This supports `A`, `B`, `C`, `1`, `2`, `3`, `Excellent`, `Developing`, etc.

### 3.5 Homeroom attendance is the report-card attendance source

Report-card attendance must come from daily `StudentAttendance` records where:

```txt
type = "homeroom"
```

Subject-period attendance may be used for analytics, but not the official report-card attendance summary unless a future policy explicitly allows it.

### 3.6 Released reports must be snapshots

Released reports must not change when teachers later edit marks, attendance, comments, names, or grade policies.

Use immutable report snapshots.

### 3.7 Build beside old system first

Do not delete old `Assessment`, `SubjectGrade`, `TermResult`, or existing routes immediately. Build the new engine in parallel, migrate surfaces gradually, then deprecate old paths.

---

## 4. UX and UI Standards

All new UI must follow `AGENTS.md` and the current premium glass workspace standard.

Reference surfaces:

```txt
/admin/students
/admin/students/[id]?tab=overview
src/components/admin/students/detail/StudentOverviewTab.tsx
src/lib/ui/glass-surfaces.ts
src/components/ui/glass-panel.tsx
src/components/ui/workspace-page-shell.tsx
src/components/ui/workspace-page-header.tsx
```

### 4.1 Visual direction

Use the existing EduSentrix premium style:

- Dark glass panels.
- Cyan/violet accents.
- Rounded `2xl` cards.
- Soft shadows.
- Subtle gradients.
- Clean empty states.
- Minimal, focused action buttons.
- No noisy dashboards.

### 4.2 Simplicity rule

Every page must answer:

```txt
What is the next action?
What is missing?
What is complete?
What is official vs provisional?
```

Do not overload pages with too many cards, charts, buttons, or decorative components.

### 4.3 UI building blocks

Prefer existing shared primitives before creating new ones:

```txt
GlassPanel
WorkspacePageShell
WorkspacePageHeader
glassPanelClass
glassInsetClass
Button
Card
Dialog/Drawer patterns already used in the app
Sonner/app toast conventions
TanStack React Query hooks
```

### 4.4 Truthful UI rule

No button should pretend to work. Every control must either:

1. Work fully.
2. Be disabled with a clear reason.
3. Be hidden until its backend slice exists.

---

## 5. Roles and Responsibilities

### 5.1 School Admin / Academic Admin

Can:

- Create grading policies.
- Create assessment plans.
- Configure report templates.
- Define report-card approval rules.
- Monitor class report readiness.
- Approve or return report-card runs.
- Release final reports.
- Unlock a report run only through audited correction workflow.

### 5.2 Headteacher

Can:

- Review final report-card runs.
- Add or approve headteacher comments.
- Approve reports for release.
- Return reports for correction.

### 5.3 Homeroom Teacher

Can:

- Record daily homeroom attendance.
- Open report-card preparation for assigned class group.
- Monitor subject submission readiness.
- Add class teacher comments, conduct, interest, attitude, and attendance notes if enabled.
- Request corrections from subject teachers.
- Compile report cards when ready.
- Submit class report run to admin/headteacher.

### 5.4 Subject Teacher

Can:

- Create assessment items for assigned class/subject.
- Pull marks from app assignments/quizzes.
- Record offline marks.
- Import marks if permitted.
- Mark selected/rule-based contributions.
- Preview calculated subject results.
- Add subject remarks.
- Submit subject results.
- Correct returned subject results.

### 5.5 Parent / Student

Can:

- View released report cards only.
- View published academic information according to school visibility settings.
- Download official reports when released.

They must not see draft marks unless the school explicitly enables provisional progress visibility in a later feature.

---

## 6. Core Domain Concepts

### 6.1 AcademicGradingPolicy

The school-defined policy for grade labels, boundaries, score components, rounding, pass mark, and report display behavior.

Replaces the future-facing use of old `GradingScale`.

### 6.2 AssessmentPlan

A grade/class/term-specific plan that decides how assessment items contribute to final results.

Supports both:

1. Teacher-selected contribution.
2. Rule-based contribution.

### 6.3 AssessmentItem

A mark column or assessment definition.

Examples:

```txt
Class Exercise 1
Homework 2
Group Project
Oral Reading
End of Term Exam
```

### 6.4 AssessmentScore

A student’s score for one assessment item.

### 6.5 SubjectResult

The official calculated result for one student in one subject for one academic period.

This replaces the future-facing role of `SubjectGrade`.

### 6.6 ReportCardRun

A class-level end-of-term report workflow initiated/coordinated by the homeroom teacher.

### 6.7 StudentReportCard

The official per-student report-card snapshot generated from a report-card run.

### 6.8 ReportAttendanceSnapshot

A frozen attendance summary calculated from daily homeroom attendance at report compilation time.

### 6.9 ReportApprovalLog

Audit-style timeline for report workflow events.

---

## 7. Data Model Specification

Use Mongoose models with `schoolId` scoping on all tenant-owned records.

Agents must create models in small slices. Do not create all models and all UI in one task.

### 7.1 AcademicGradingPolicy

Suggested fields:

```ts
type GradeLabelMode = "letters" | "numbers" | "descriptors" | "custom";
type RoundingRule = "none" | "nearest_integer" | "one_decimal" | "two_decimals";
type PolicyStatus = "draft" | "active" | "archived";

type ScoreComponent = {
  key: string; // e.g. classroom_work, exam
  label: string; // e.g. Classroom Work
  weight: number; // percentage weight, total must equal 100
  order: number;
  required: boolean;
  allowedAssessmentTypes: string[];
};

type GradeBoundary = {
  minPercentage: number;
  maxPercentage: number;
  gradeLabel: string;
  gradePoint?: number | null;
  descriptor?: string | null;
  isPassing?: boolean;
  colorToken?: string | null;
};
```

Model:

```txt
AcademicGradingPolicy
- _id
- schoolId
- name
- description
- curriculumCode
- gradeLabelMode
- appliesToGradeIds[]
- appliesToGradeBandCodes[]
- isDefault
- status
- scoreComponents[]
- gradeBoundaries[]
- passMark
- roundingRule
- showClassPosition
- showSubjectPosition
- showGradeKey
- allowTeacherContributionSelection
- requireAdminApprovalForPolicyChanges
- createdBy
- updatedBy
- createdAt
- updatedAt
```

Validation rules:

- Component weights must total 100.
- Boundary ranges must cover expected score range without overlap.
- Only one active default policy per school/curriculum/grade band where applicable.
- Archived policies cannot be assigned to new assessment plans.
- Policies attached to released reports must not be mutated in a way that changes old reports.

### 7.2 AssessmentPlan

Defines how a grading policy is applied for a grade/class/term.

```ts
type ContributionMode =
  | "teacher_selected"
  | "best_n"
  | "average_all"
  | "fixed_required_item"
  | "weighted_items"
  | "latest_n"
  | "drop_lowest";

type ComponentRule = {
  componentKey: string;
  contributionMode: ContributionMode;
  minItems?: number;
  maxItems?: number;
  bestN?: number;
  latestN?: number;
  dropLowestCount?: number;
  requiredAssessmentTypes?: string[];
  requiredItemLabels?: string[];
  allowManualOverride?: boolean;
  requireHomeroomApproval?: boolean;
  requireAdminApproval?: boolean;
};
```

Model:

```txt
AssessmentPlan
- _id
- schoolId
- name
- academicPeriodId
- gradingPolicyId
- appliesToGradeId
- appliesToClassGroupIds[]
- curriculumCode
- status: draft | active | locked | archived
- componentRules[]
- teacherCanCreateReportItems
- teacherCanMarkItemsAsReportContributing
- allowOfflineMarks
- allowAppAssignmentImport
- allowCsvImport
- minimumCompletionRules
- createdBy
- approvedBy
- approvedAt
- lockedAt
- createdAt
- updatedAt
```

Required contribution options:

#### Option A: Teacher-selected

Teachers choose which eligible assessment items count toward the component.

Example:

```txt
Classroom Work 30%
Contribution Mode: teacher_selected
Teacher can select classwork, homework, quiz, project, assignment.
Minimum selected items: 2
Maximum selected items: 5
```

#### Option B: Rule-based

The system automatically selects/calculates eligible items based on rules.

Examples:

```txt
Best 3 class exercises
Average all homework marks
Latest 2 quizzes
Drop the lowest class exercise
One required end-of-term exam
```

Validation rules:

- Assessment plan must reference an active grading policy.
- Component rules must map to policy component keys.
- A class group must not have two active plans for the same academic period unless explicitly versioned.
- Locked plans cannot be edited except through a versioned clone/correction process.

### 7.3 AssessmentItem

Represents one assessment column/source.

```txt
AssessmentItem
- _id
- schoolId
- academicPeriodId
- assessmentPlanId
- classGroupId
- gradeId
- subjectId
- subjectOfferingId optional
- teacherId
- title
- description
- assessmentType
- sourceType: manual | app_assignment | app_quiz | imported_csv | exam | system
- sourceRefType optional
- sourceRefId optional
- maxScore
- dateAssigned
- dateDue
- assessedAt
- componentKey optional
- contributesToReport
- contributionLockedByRule
- visibility: internal | teacher_only | visible_to_parent_after_release | visible_to_student_after_release
- status: draft | open | completed | submitted | locked | archived
- createdBy
- updatedBy
- createdAt
- updatedAt
```

Important rules:

- AssessmentItem defines the column once.
- AssessmentScore stores each student’s mark.
- App assignment and offline marks must both produce AssessmentItems when they are used in gradebook.
- `contributesToReport` can be true only when the component is allowed by the assessment plan.
- In rule-based mode, the UI may show contribution status as system-selected rather than teacher-selected.

### 7.4 AssessmentScore

```txt
AssessmentScore
- _id
- schoolId
- academicPeriodId
- assessmentItemId
- assessmentPlanId
- classGroupId
- subjectId
- studentId
- teacherId
- score
- maxScoreSnapshot
- percentage
- status: draft | recorded | missing | excused | submitted | locked
- remarks
- gradedAt
- recordedBy
- updatedBy
- sourceSubmissionId optional
- createdAt
- updatedAt
```

Validation rules:

- Score cannot be below 0.
- Score cannot exceed item max score unless an admin override policy exists.
- Locked scores cannot be changed without audited unlock/correction workflow.
- Each student can have only one score per assessment item.

### 7.5 SubjectResult

Official calculated result for one student/subject/period.

```txt
SubjectResult
- _id
- schoolId
- academicPeriodId
- assessmentPlanId
- gradingPolicyId
- classGroupId
- gradeId
- subjectId
- studentId
- teacherId
- components[]
- finalScore
- roundedFinalScore
- gradeLabel
- gradePoint
- descriptor
- isPassed
- subjectPosition
- totalStudentsForSubject
- subjectRemark
- missingRequiredItems[]
- sourceAssessmentItemIds[]
- calculationSnapshot
- status: draft | ready | submitted | returned | approved | locked
- submittedBy
- submittedAt
- returnedBy
- returnedAt
- returnReason
- approvedBy
- approvedAt
- lockedAt
- createdAt
- updatedAt
```

Component snapshot shape:

```txt
components[]
- componentKey
- label
- weight
- rawScore
- rawMaxScore
- rawPercentage
- weightedScore
- includedAssessmentItemIds[]
- excludedAssessmentItemIds[]
- calculationMode
```

### 7.6 ReportCardRun

Class-level workflow.

```txt
ReportCardRun
- _id
- schoolId
- academicPeriodId
- classGroupId
- gradeId
- homeroomTeacherId
- gradingPolicyId
- assessmentPlanId
- reportTemplateId
- status: draft | opened | collecting_marks | ready_to_compile | compiled | submitted_for_approval | returned | approved | released | archived
- openedBy
- openedAt
- compiledBy
- compiledAt
- submittedBy
- submittedAt
- approvedBy
- approvedAt
- releasedBy
- releasedAt
- releaseVisibility
- readinessSnapshot
- issueSummary
- createdAt
- updatedAt
```

Readiness should include:

```txt
subjectsExpected
subjectsSubmitted
subjectsApproved
studentsExpected
studentsComplete
missingSubjectResults
missingExamScores
missingRequiredComponents
attendanceReady
commentsReady
headteacherCommentReady
```

### 7.7 StudentReportCard

Frozen official report snapshot.

```txt
StudentReportCard
- _id
- schoolId
- academicPeriodId
- reportCardRunId
- studentId
- classGroupId
- gradeId
- gradingPolicySnapshot
- assessmentPlanSnapshot
- reportTemplateSnapshot
- studentSnapshot
- schoolSnapshot
- attendanceSnapshot
- subjectResultsSnapshot[]
- termSummarySnapshot
- commentsSnapshot
- conductSnapshot
- promotionSnapshot optional
- verificationId optional
- pdfUrl optional
- status: draft | compiled | approved | released | revoked
- compiledAt
- approvedAt
- releasedAt
- createdAt
- updatedAt
```

### 7.8 ReportAttendanceSnapshot

```txt
ReportAttendanceSnapshot
- _id
- schoolId
- academicPeriodId
- reportCardRunId
- studentId
- classGroupId
- source: homeroom_daily_attendance
- totalSchoolDays
- daysPresent
- daysAbsent
- daysLate
- daysExcused
- attendancePercentage
- calculatedFromDate
- calculatedToDate
- calculatedAt
- createdAt
- updatedAt
```

Source must be daily homeroom records from `StudentAttendance`.

### 7.9 ReportApprovalLog

```txt
ReportApprovalLog
- _id
- schoolId
- reportCardRunId
- studentReportCardId optional
- entityType: report_run | subject_result | student_report_card
- entityId
- action
- actorId
- actorRole
- note
- beforeStatus
- afterStatus
- metadata
- createdAt
```

---

## 8. Calculation Rules

### 8.1 Final score calculation

For each subject:

```txt
Final Score = Sum(component weighted scores)
```

For each component:

```txt
rawPercentage = rawScore / rawMaxScore * 100
weightedScore = rawPercentage * componentWeight / 100
```

Example:

```txt
Classroom Work component weight = 30
Classroom Work raw percentage = 88.33
Weighted score = 26.50

Exam component weight = 70
Exam raw percentage = 88.00
Weighted score = 61.60

Final score = 88.10
```

### 8.2 Teacher-selected contribution mode

- Teacher records many assessment items.
- Teacher marks eligible items as contributing.
- System validates selected item count against min/max rules.
- System calculates the component from selected items.

### 8.3 Rule-based contribution mode

- Teacher records assessment items.
- System automatically includes/excludes items based on the component rule.
- UI shows `System selected` or `Excluded by rule` badges.
- Teachers cannot manually override unless `allowManualOverride` is true.

Supported initial rules:

```txt
average_all
best_n
fixed_required_item
weighted_items
```

Supported later rules:

```txt
latest_n
drop_lowest
hybrid nested rules
```

### 8.4 Missing scores

Each assessment item should define how missing scores behave:

```txt
missingPolicy: exclude_from_average | count_as_zero | block_submission | excused
```

Default recommendation:

- Required exam item: missing score blocks submission.
- Teacher-selected classroom work: missing score excludes student from that item unless teacher marks zero intentionally.
- Rule-based best-N: missing scores are ignored unless insufficient item count exists.

### 8.5 Rounding

Use grading policy rounding rule:

```txt
none
nearest_integer
one_decimal
two_decimals
```

Store both raw and rounded values in `SubjectResult`.

### 8.6 Grade resolution

Use `AcademicGradingPolicy.gradeBoundaries`.

Do not assume grade letters.

---

## 9. Main Workflows

## 9.1 School Admin: Grading Policy Setup

Route suggestion:

```txt
/admin/academics/grading
```

UI sections:

```txt
Policies
Score Components
Grade Boundaries
Report Display Rules
```

MVP UI:

- Policy list.
- Create/edit policy drawer.
- Components editor.
- Grade boundaries editor.
- Activate policy action.

Keep it simple. Do not build a huge settings cockpit.

### Required empty state

```txt
No grading policy yet.
Create a grading policy to define score breakdowns, grade labels, and report-card rules.
```

## 9.2 School Admin: Assessment Plan Setup

Route suggestion:

```txt
/admin/academics/assessment-plans
```

UI sections:

```txt
Plan list
Plan details
Component rules
Assigned classes/grades
Activation status
```

MVP setup wizard steps:

1. Basic details.
2. Select academic period and grading policy.
3. Choose grade/class groups.
4. Configure component contribution rules.
5. Review and activate.

Must include both contribution modes:

```txt
Teacher-selected
Rule-based
```

## 9.3 Subject Teacher: Marks & Reports

Current gradebook route exists:

```txt
/teacher/gradebook
/teacher/gradebook/[classGroupId]/[subjectId]
```

New UX should evolve this surface.

Tabs:

```txt
Overview
Assessment Items
Mark Entry
Report Contribution
Final Preview
Submit
```

Header should show:

```txt
Class group
Subject
Academic period
Assessment plan
Grading policy
Status
```

Avoid clutter. Use one primary action per tab.

### Assessment Items tab

Teacher can:

- Create offline assessment item.
- Pull from app assignment/quiz.
- Edit draft items.
- Archive unused draft items.

Fields:

```txt
Title
Type
Max score
Date
Component
Contributes to report card
Source type
Visibility
```

### Mark Entry tab

Spreadsheet-like grid but clean.

Rows: students.  
Columns: assessment items.

Must support:

- Inline cell editing.
- Bulk save.
- Missing score badges.
- Score validation.
- Sticky student column if feasible.
- No over-designed charts.

### Report Contribution tab

Shows each component and included/excluded items.

For teacher-selected mode:

- Teacher can toggle eligible items.
- System shows selected count and completion.

For rule-based mode:

- System shows selected items by rule.
- Teacher sees explanation but cannot change unless override is allowed.

### Final Preview tab

Shows calculated subject result per student:

```txt
Student | Components | Final Score | Grade | Status | Issues
```

### Submit tab

Readiness checklist:

```txt
Assessment plan active
Required items created
Required scores entered
No invalid scores
Subject remarks completed if required
```

Action:

```txt
Submit subject results
```

After submission, subject results are locked until returned.

## 9.4 Teacher Studio Integration

Teacher Studio remains for assignments/quizzes/projects/resources.

When an app assignment or quiz is marked, show an action:

```txt
Add to Gradebook
```

Options:

```txt
Do not add to gradebook
Add as non-report mark
Add as report-contributing mark
```

If report-contributing:

- Choose component.
- Validate against active assessment plan.
- Create or link `AssessmentItem`.
- Create `AssessmentScore` rows from marked submissions.

Do not make every assignment automatically official.

## 9.5 Homeroom Teacher: Report Card Run

Route suggestion:

```txt
/teacher/homeroom/reports
/teacher/homeroom/reports/[classGroupId]
```

MVP page sections:

```txt
Class report status
Subject readiness
Attendance readiness
Comments readiness
Compile action
```

Top cards, maximum four:

```txt
Subjects Submitted
Students Complete
Attendance Ready
Report Status
```

Subject readiness table:

```txt
Subject | Teacher | Status | Issues | Action
```

Actions:

```txt
Open report preparation
Send reminder
Request correction
Compile report cards
Submit to admin/headteacher
```

### Homeroom report activation

Homeroom teacher starts a `ReportCardRun` for assigned class group.

If a run already exists, show the existing run.

### Attendance requirement

Before compilation, system must calculate attendance from daily homeroom attendance.

If no homeroom attendance exists:

```txt
Attendance records are missing for this period. Record or review daily homeroom attendance before compiling reports.
```

## 9.6 Admin / Headteacher Approval

Route suggestion:

```txt
/admin/reports/report-runs
/admin/reports/report-runs/[id]
```

Sections:

```txt
Run summary
Readiness checklist
Student reports
Issues
Approval timeline
```

Actions:

```txt
Approve
Return to homeroom teacher
Release to parents/students
```

Release must create or activate report verification where applicable.

---

## 10. Attendance Integration

### 10.1 Source

Use existing `StudentAttendance` with:

```txt
type = homeroom
schoolId
studentId
classGroupId
academicPeriodId
date
status
```

### 10.2 Calculation

During report-card compilation:

```txt
schoolDays = count unique homeroom attendance dates for class group and period
present = count status present
absent = count status absent
late = count status late
excused = count status excused
attendancePercentage = (present + late? configurable) / schoolDays * 100
```

Recommended MVP:

```txt
Attendance rate = present / totalSchoolDays * 100
Late is displayed separately and does not count as full present.
Excused is displayed separately.
```

Later policy can decide if late/excused count differently.

### 10.3 Snapshot

Create `ReportAttendanceSnapshot` at compilation. Store snapshot inside `StudentReportCard` too.

Released reports must display snapshot, not live attendance.

---

## 11. Report Card Content

Report cards should support dynamic policy-driven columns.

Common sections:

```txt
School header
Student details
Academic period
Attendance summary
Subject results
Dynamic score components
Total/final score
Grade label
Subject teacher remark
Class teacher comment
Headteacher comment
Conduct / interest / attitude
Promotion/reopening info where applicable
Grading key
Verification code / QR
```

For 30/70 policy:

```txt
Subject | Classroom Work | Exam | Total | Grade | Remark
```

For multi-component policy:

```txt
Subject | Homework | Classwork | Project | Exam | Total | Grade | Remark
```

Never hardcode report card columns to CA/exam only.

---

## 12. API Design Guidelines

Use current project API shape:

```json
{ "success": true, "data": {} }
{ "success": false, "error": "Message" }
```

All endpoints must:

- Authenticate first.
- Authorize with role/permission helpers.
- Scope by `schoolId`.
- Validate IDs safely.
- Validate request bodies.
- Return clear errors.
- Write audit logs for approval, submission, release, unlock, and correction events.

Suggested endpoint groups:

```txt
/api/admin/academics/grading-policies
/api/admin/academics/assessment-plans
/api/teacher/marks/gradebooks
/api/teacher/marks/assessment-items
/api/teacher/marks/scores
/api/teacher/marks/subject-results
/api/teacher/homeroom/report-runs
/api/admin/reports/report-runs
/api/admin/reports/report-runs/[id]/approve
/api/admin/reports/report-runs/[id]/release
```

Do not build all endpoints in one slice.

---

## 13. Permissions

Add or map to existing permissions carefully.

Suggested permissions:

```txt
academics.gradingPolicies.read
academics.gradingPolicies.manage
academics.assessmentPlans.read
academics.assessmentPlans.manage
academics.assessmentItems.read
academics.assessmentItems.manage
academics.scores.record
academics.scores.import
academics.subjectResults.submit
academics.subjectResults.review
academics.reportRuns.open
academics.reportRuns.compile
academics.reportRuns.approve
academics.reportRuns.release
academics.reportRuns.unlock
academics.reports.viewReleased
```

Role mapping:

- School admin: all school-level academic permissions.
- Headteacher: review/approve/release depending on school policy.
- Homeroom teacher: open/compile assigned class runs.
- Subject teacher: manage items/scores for assigned subject/class only.
- Parent/student: view released only.

---

## 14. Agent Implementation Strategy

This module is large. Agents must build it in small, reviewable slices.

### 14.1 Anti-drift rules for agents

Every agent prompt for this module must start with:

```txt
Read AGENTS.md first.
This task belongs to the Academic Assessment & Report Card Engine spec.
Do not build unrelated features.
Do not redesign unrelated pages.
Do not remove old Assessment/SubjectGrade/TermResult yet.
Keep UI aligned with the premium glass workspace standard.
Keep screens simple and uncluttered.
Return changed files, checks run, and known follow-ups.
```

### 14.2 Slice completion checklist

Every slice must end with:

```txt
- What was changed?
- What was intentionally not changed?
- Which old paths still remain?
- Which checks were run?
- What is the next slice?
```

### 14.3 Build strategy

Use this order:

1. Model and type foundations.
2. Pure calculation utilities and tests.
3. Admin policy setup UI.
4. Assessment plan setup UI.
5. Teacher gradebook v2 backend.
6. Teacher gradebook v2 UI.
7. Teacher Studio integration.
8. Homeroom report run workflow.
9. Admin approval/release workflow.
10. Report card snapshot/PDF/view integration.
11. Migration compatibility from old data.
12. Deprecate old hardcoded CA/exam paths.

Do not jump to report-card PDF before the calculation and snapshot system is stable.

---

## 15. Implementation Slices

## Slice 0 — Discovery and Safety Map

Goal: Document exact current files, routes, hooks, and models impacted.

Tasks:

- Read `AGENTS.md`.
- Inspect current gradebook, Teacher Studio, attendance, report, student academics files.
- Create a short implementation map in docs or comments for the agent session.
- Identify hardcoded CA/exam areas.
- Do not code functional changes.

Acceptance criteria:

- Agent reports relevant files.
- Agent identifies old and new boundaries.
- No source behavior changed.

## Slice 1 — Domain Types and Constants

Goal: Add shared TypeScript types/constants for new engine.

Suggested files:

```txt
src/types/academics/assessment-engine.ts
src/constants/academics/assessment-engine.ts
```

Include:

- Contribution modes.
- Report run statuses.
- Subject result statuses.
- Assessment source types.
- Attendance snapshot source.
- Grade label modes.

Acceptance criteria:

- Types compile.
- No UI changed.
- No database writes changed.

## Slice 2 — New Mongoose Models

Goal: Add new models without touching old flows.

Create models one by one or in small groups:

```txt
AcademicGradingPolicy
AssessmentPlan
AssessmentItem
AssessmentScore
SubjectResult
ReportCardRun
StudentReportCard
ReportAttendanceSnapshot
ReportApprovalLog
```

Acceptance criteria:

- Models include `schoolId` indexes.
- No duplicate index naming mistakes.
- No old model deleted.
- Importing models does not break build.

## Slice 3 — Calculation Utilities

Goal: Build pure calculation functions.

Suggested files:

```txt
src/lib/academics/assessment-engine/calculate-component.ts
src/lib/academics/assessment-engine/calculate-subject-result.ts
src/lib/academics/assessment-engine/resolve-grade-boundary.ts
src/lib/academics/assessment-engine/validate-assessment-plan.ts
```

Must support:

- Teacher-selected mode.
- `average_all` rule mode.
- `best_n` rule mode.
- `fixed_required_item` rule mode.
- Dynamic components.
- Grade boundary resolution.
- Missing required items.

Acceptance criteria:

- Unit tests cover calculation edge cases.
- No DB dependency in pure functions.
- No UI changed.

## Slice 4 — Grading Policy Admin Backend

Goal: CRUD for grading policies.

Routes:

```txt
/api/admin/academics/grading-policies
/api/admin/academics/grading-policies/[id]
/api/admin/academics/grading-policies/[id]/activate
```

Acceptance criteria:

- School-scoped.
- Admin permission required.
- Validates component weights = 100.
- Validates grade boundaries.
- Returns consistent JSON.

## Slice 5 — Grading Policy Admin UI

Goal: Simple, uncluttered grading policy page.

Route:

```txt
/admin/academics/grading
```

UI:

- Page header.
- Policy list.
- Create/edit drawer.
- Components editor.
- Grade boundary editor.
- Activate policy button.

Acceptance criteria:

- Matches glass workspace standard.
- No overcrowded cards.
- Loading/empty/error states included.
- Uses real API, not fake data.

## Slice 6 — Assessment Plan Backend

Goal: CRUD and activation for assessment plans.

Routes:

```txt
/api/admin/academics/assessment-plans
/api/admin/academics/assessment-plans/[id]
/api/admin/academics/assessment-plans/[id]/activate
```

Acceptance criteria:

- Supports both teacher-selected and rule-based contribution modes.
- Validates component rules against selected grading policy.
- Prevents duplicate active plan for same class group/period.
- School-scoped.

## Slice 7 — Assessment Plan Admin UI

Goal: Wizard for creating assessment plans.

Route:

```txt
/admin/academics/assessment-plans
```

Wizard steps:

1. Details.
2. Academic period and policy.
3. Grades/class groups.
4. Component rules.
5. Review.

Acceptance criteria:

- Both contribution options visible and understandable.
- UI is clean and guided.
- No advanced clutter in MVP.

## Slice 8 — Teacher Gradebook v2 Read API

Goal: Create a new read endpoint for gradebook v2 without replacing old route yet.

Route suggestion:

```txt
/api/teacher/marks/gradebooks/[classGroupId]/[subjectId]
```

Returns:

```txt
classGroup
subject
academicPeriod
assessmentPlan
gradingPolicy
students
assessmentItems
assessmentScores
componentSummary
readiness
```

Acceptance criteria:

- Teacher can only access assigned class/subject unless admin.
- No hardcoded CA/exam.
- Uses assessment plan components.

## Slice 9 — Assessment Item and Score Mutations

Goal: Backend for creating items and recording scores.

Routes:

```txt
/api/teacher/marks/assessment-items
/api/teacher/marks/assessment-items/[id]
/api/teacher/marks/scores/bulk
```

Acceptance criteria:

- Validates active assessment plan.
- Validates score ranges.
- Supports offline manual items.
- Supports report-contributing flag where allowed.
- Uses audit logs for bulk score updates.

## Slice 10 — Teacher Gradebook v2 UI Shell

Goal: Build UI shell with real read data but limited mutation.

Route:

```txt
/teacher/marks/[classGroupId]/[subjectId]
```

or upgrade current:

```txt
/teacher/gradebook/[classGroupId]/[subjectId]
```

Tabs:

```txt
Overview
Assessment Items
Mark Entry
Report Contribution
Final Preview
Submit
```

Acceptance criteria:

- Uses current glass UI style.
- Simple page, no clutter.
- Shows active assessment plan and policy.
- Shows empty state if no plan exists.

## Slice 11 — Teacher Assessment Item UI

Goal: Create/edit assessment items.

Acceptance criteria:

- Manual/offline mark item creation works.
- Component selection respects assessment plan.
- Contribution toggle respects contribution mode.
- App assignment source can be shown as planned/disabled until integration slice.

## Slice 12 — Teacher Mark Entry UI

Goal: Editable score grid.

Acceptance criteria:

- Inline score entry works.
- Bulk save works.
- Invalid scores clearly shown.
- Missing scores shown without visual noise.
- Query invalidation updates final preview.

## Slice 13 — Report Contribution UI

Goal: Allow teacher-selected and rule-based contribution visibility.

Acceptance criteria:

- Teacher-selected mode allows toggling eligible items.
- Rule-based mode shows included/excluded by system.
- Explains why an item counts or does not count.
- No hardcoded CA/exam labels.

## Slice 14 — Subject Result Preview and Submit

Goal: Generate and submit `SubjectResult` records.

Routes:

```txt
/api/teacher/marks/subject-results/preview
/api/teacher/marks/subject-results/submit
```

Acceptance criteria:

- Uses calculation utilities.
- Stores component snapshots.
- Locks submitted subject results.
- Shows missing requirements before submit.

## Slice 15 — Teacher Studio Link to Gradebook

Goal: Let app assignments/quizzes become assessment items.

Surfaces:

```txt
Teacher Studio assignment detail
Teacher Studio submissions after grading
```

Action:

```txt
Add to Gradebook
```

Acceptance criteria:

- Can add app assignment as non-report mark.
- Can add app assignment as report-contributing mark if policy allows.
- Creates AssessmentItem + AssessmentScores from graded submissions.
- Does not automatically make assignments official.

## Slice 16 — Homeroom Report Run Backend

Goal: Create/read report-card runs for homeroom teachers.

Routes:

```txt
/api/teacher/homeroom/report-runs
/api/teacher/homeroom/report-runs/[id]
/api/teacher/homeroom/report-runs/[id]/compile
/api/teacher/homeroom/report-runs/[id]/submit
```

Acceptance criteria:

- Only assigned homeroom teacher can open/compile class run unless admin.
- Readiness checks include subject results, attendance, comments.
- Compile creates snapshots but does not release.

## Slice 17 — Homeroom Report Run UI

Goal: Simple homeroom dashboard for report creation.

Route:

```txt
/teacher/homeroom/reports
```

Acceptance criteria:

- Shows subject readiness table.
- Shows attendance readiness.
- Shows comments readiness.
- Has clear next action.
- No cluttered analytics.

## Slice 18 — Attendance Snapshot Service

Goal: Calculate report attendance from daily homeroom attendance.

Suggested file:

```txt
src/lib/academics/reporting/build-attendance-snapshot.ts
```

Acceptance criteria:

- Uses `StudentAttendance` where `type = homeroom`.
- Creates `ReportAttendanceSnapshot`.
- Embeds snapshot in `StudentReportCard` during compilation.
- Tests cover absent/late/excused/present.

## Slice 19 — Admin Report Approval Backend

Goal: Admin/headteacher review endpoints.

Routes:

```txt
/api/admin/reports/report-runs
/api/admin/reports/report-runs/[id]
/api/admin/reports/report-runs/[id]/approve
/api/admin/reports/report-runs/[id]/return
/api/admin/reports/report-runs/[id]/release
```

Acceptance criteria:

- Permission protected.
- Writes approval logs.
- Release locks reports.
- Release creates verification metadata where appropriate.

## Slice 20 — Admin Report Approval UI

Goal: Clean approval queue.

Route:

```txt
/admin/reports/report-runs
```

Acceptance criteria:

- List runs by status.
- Detail page shows readiness and issues.
- Approve/return/release actions work.
- UI is simple and not cluttered.

## Slice 21 — StudentReportCard View Integration

Goal: Update report-card display to use snapshots.

Files likely involved:

```txt
src/components/admin/reports/ReportCardView.tsx
src/app/api/parent/reports/download/route.ts
```

Acceptance criteria:

- Dynamic component columns.
- Attendance snapshot displayed.
- Grade label not grade letter.
- Released report does not depend on live marks.

## Slice 22 — Compatibility Layer

Goal: Allow old surfaces to keep working during migration.

Tasks:

- Add adapters from `SubjectResult` to old table row shapes where necessary.
- Keep `SubjectGrade`/`TermResult` read fallback where new data missing.
- Do not delete old APIs yet.

Acceptance criteria:

- Existing parent/student report pages do not break.
- New data preferred when available.
- Old data clearly treated as legacy fallback.

## Slice 23 — Deprecation of Hardcoded CA/Exam Logic

Goal: Remove hardcoded CA/exam logic only after v2 is stable.

Tasks:

- Replace old gradebook routes or redirect to v2.
- Remove `CA_TYPES`/`EXAM_TYPES` usage from official calculations.
- Keep migration notes.

Acceptance criteria:

- No official report calculation uses hardcoded CA/exam sets.
- Old routes either removed, redirected, or marked legacy.

---

## 16. Testing Strategy

### 16.1 Unit tests

Cover:

- Component weight validation.
- Grade boundary resolution.
- Teacher-selected calculation.
- Average-all calculation.
- Best-N calculation.
- Fixed required exam calculation.
- Missing score behavior.
- Rounding.
- Attendance snapshot calculation.

### 16.2 API tests

Cover:

- Unauthorized access.
- Wrong school access.
- Teacher accessing unassigned class/subject.
- Invalid component weights.
- Duplicate active plan prevention.
- Subject result submission locks.
- Report run approval/release.

### 16.3 UI tests / manual QA

Check:

- Empty grading policy state.
- Empty assessment plan state.
- Teacher with no active plan.
- Offline mark creation.
- Teacher-selected contribution.
- Rule-based contribution.
- Homeroom report readiness.
- Missing attendance warning.
- Admin approval flow.
- Released report snapshot stability.

---

## 17. Migration Strategy

Do not migrate destructively.

### Phase 1

Build new models and APIs beside old system.

### Phase 2

New gradebook v2 surfaces use new models.

### Phase 3

Teacher Studio can push marked assignments into new assessment items.

### Phase 4

New report-card runs generate snapshots.

### Phase 5

Student Academic Profile reads new data first, old data fallback second.

### Phase 6

Legacy `SubjectGrade`/`TermResult` use is phased out from official reporting.

### Phase 7

Remove or archive old hardcoded CA/exam logic after verification.

---

## 18. AI Agent Prompt Template

Use this template for each implementation slice:

```txt
You are working inside edusentrix-web-nextjs.
Read AGENTS.md first.
This task belongs to the Academic Assessment & Report Card Engine spec.
Implement only Slice [NUMBER]: [SLICE NAME].

Do not implement future slices.
Do not remove old Assessment, SubjectGrade, or TermResult unless the slice explicitly says so.
Do not hardcode CA/exam assumptions in new code.
Use schoolId scoping everywhere.
Use existing auth/permission helpers.
Use the premium glass workspace UI standard where UI is involved.
Keep UI simple, focused, and uncluttered.
All API responses must use { success: true, data } or { success: false, error }.

Before coding, inspect the relevant files and report the plan.
After coding, report changed files, checks run, and next slice.
```

---

## 19. Final Acceptance Criteria for the Whole Engine

The engine is complete when:

- A school can define custom grading labels and boundaries.
- A school can define score breakdowns with dynamic components.
- A school can create assessment plans per grade/class/term.
- Assessment plans support teacher-selected and rule-based contribution.
- Subject teachers can record offline and in-app marks.
- Teachers can decide or view which marks contribute depending on plan rules.
- Subject results are calculated dynamically from policy components.
- Homeroom teachers can open and coordinate report-card runs.
- Report attendance comes from daily homeroom attendance.
- Admin/headteacher can approve and release reports.
- Released report cards are locked snapshots.
- Parent/student views show only released official reports.
- Student Academic Profile consumes the new result and report data.
- No official calculation relies on hardcoded CA/exam sets.

---

## 20. Product Quality Bar

This feature should feel like a serious school academic records system, not a spreadsheet hack.

The user experience should be:

- Clear.
- Calm.
- Trustworthy.
- Guided.
- Policy-driven.
- Easy for non-technical school staff.
- Safe for real academic records.

