# EduSentrix Student Academic Profile Spec

**Version:** 1.0  
**Product Area:** Student Detail, Academics Tab, Parent/Student Academic Views, Leo AI Insights  
**Depends On:** Academic Assessment & Report Card Engine  
**Primary Roles:** School Admin, Homeroom Teacher, Subject Teacher, Parent, Student  
**Project:** `edusentrix-web-nextjs`  
**Implementation Style:** Small safe AI-agent slices, linked to the new assessment/report-card engine

---

## 1. Executive Summary

The current student Academics tab is useful but based on legacy assumptions:

- `SubjectGrade` drives subject rows.
- `TermResult` drives term summaries.
- Subject scores are mostly CA/exam oriented.
- `gradeLetter` assumes letter-style grading.
- Assessment breakdowns are limited by old `Assessment` rows.
- Attendance is not fully integrated as official report-card attendance.
- AI insights do not yet understand which marks counted, which did not, or how the final report was built.

With the new **Academic Assessment & Report Card Engine**, the Student Academics tab should become a full **Student Academic Profile**.

It must answer:

```txt
What is the student’s academic story?
What is official vs provisional?
How were subject scores calculated?
Which assessments counted toward the report?
What attendance record supported the report card?
How has the student performed across periods?
What should teachers, parents, admins, and the student do next?
```

This spec updates the student academics experience to consume:

```txt
SubjectResult
StudentReportCard
ReportCardRun
AssessmentItem
AssessmentScore
AssessmentPlan
AcademicGradingPolicy
ReportAttendanceSnapshot
TeacherComment / report comments
Leo AI insights
```

The Student Academic Profile is not where teachers record marks. It is the read-only, role-aware mirror of the assessment/report-card engine.

---

## 2. Relationship to the Assessment & Report Card Engine

The two systems must be linked as follows:

```txt
Academic Assessment & Report Card Engine
- Creates policies, assessment plans, marks, subject results, report-card runs, snapshots.

Student Academic Profile
- Displays, explains, compares, and analyzes those results for one student.
```

The Academic Profile must never invent academic results. It must read from official engine outputs.

Priority order for data:

```txt
1. Released StudentReportCard snapshot
2. Approved/compiled StudentReportCard snapshot
3. Submitted/approved SubjectResult records
4. Draft/provisional SubjectResult preview data for authorized staff only
5. Legacy SubjectGrade/TermResult fallback during migration only
```

Parent and student views must only show released/allowed information.

---

## 3. Current Codebase Context

Relevant current files include:

```txt
src/types/admin/student-academics.ts
src/lib/academics/buildStudentAcademicsDTO.ts
src/hooks/admin/useStudentAcademics.ts
src/components/admin/students/detail/StudentAcademicsTab.tsx
src/components/admin/students/detail/AcademicSummaryCards.tsx
src/components/admin/students/detail/SubjectPerformanceTable.tsx
src/components/admin/students/detail/AssessmentBreakdownModal.tsx
src/components/admin/students/detail/TeacherCommentsSection.tsx
src/components/admin/students/detail/AIInsightsPanel.tsx
src/components/admin/students/detail/OverallPerformanceTrend.tsx
src/components/admin/students/detail/SubjectPerformanceOverTime.tsx
src/components/admin/students/detail/SubjectStrengthsOverview.tsx
src/app/api/admin/students/[id]/academics/route.ts
src/app/api/parent/wards/[id]/academics/route.ts
src/app/api/parent/reports/download/route.ts
src/app/(app)/student/results/page.tsx
src/app/(app)/parent/academics/page.tsx
src/lib/insights/buildStudentInsightsDTO.ts
```

Current DTO limitations:

```txt
subjects[].caPercentage
subjects[].examPercentage
subjects[].gradeLetter
summary from TermResult
breakdown from old Assessment model
```

New DTOs must support dynamic score components, official/provisional status, report-card snapshots, attendance snapshots, and role-aware visibility.

---

## 4. Product Principles

### 4.1 Official vs provisional must always be clear

For current periods, staff may see provisional progress. Parents/students should generally see only released data unless the school enables progress visibility.

Use labels such as:

```txt
In Progress
Submitted
Compiled
Approved
Released
Official Report
Projected
Provisional
```

### 4.2 Dynamic components, no hardcoded CA/exam

The Academics tab must render components from `SubjectResult.components` or report snapshots.

Do not assume CA/exam columns.

### 4.3 Snapshots for released reports

For released periods, the Academic Profile must display snapshot data from `StudentReportCard`, not live marks.

### 4.4 Attendance comes from homeroom records

For current periods, show live homeroom attendance aggregation.  
For released periods, show `ReportAttendanceSnapshot` from the report card.

### 4.5 Role-aware views

Different users see different detail levels.

- Admin: full details, readiness, missing data, official/provisional status.
- Homeroom teacher: class-level readiness and comments context.
- Subject teacher: their subject details and permitted summaries.
- Parent: released official report and parent-friendly explanations.
- Student: released results, goals, and student-friendly guidance.

### 4.6 Simple uncluttered UI

The Academics tab must remain readable. Avoid turning it into a crowded analytics dashboard.

Each section should have a clear purpose.

---

## 5. UX and UI Standards

Follow `AGENTS.md` and the premium glass workspace standard.

Use existing components where possible:

```txt
WorkspacePageShell
WorkspacePageHeader
GlassPanel
glassPanelClass
glassInsetClass
Card/Button primitives
Existing student detail tab structure
Existing AIInsightsPanel pattern, improved not bloated
```

Keep the current EduSentrix visual direction:

- Dark premium surfaces.
- Cyan/violet accents.
- Clean cards.
- Subtle gradients.
- Clear badges.
- Soft empty states.
- Minimal actions.

### 5.1 UI clutter rule

Do not show all data at once.

Use progressive disclosure:

- Summary first.
- Subject table next.
- Breakdown modal/drawer for detail.
- Trends and AI insights lower on the page.

---

## 6. New Student Academic Profile Structure

The updated Academics tab should contain:

```txt
1. Academic Period Selector
2. Term Snapshot Cards
3. Report Status / Readiness Panel
4. Subject Results Table
5. Assessment Evidence / Breakdown Modal
6. Attendance Summary
7. Performance Trends
8. Teacher and Report Comments
9. Leo AI Insights
10. Report Card Documents
```

Not every role sees every section.

---

## 7. Data Contract: StudentAcademicProfileDTO

Replace or evolve `StudentAcademicsDTO` into a versioned DTO.

Recommended new type:

```ts
type AcademicProfileVisibilityMode =
  | "admin"
  | "homeroom_teacher"
  | "subject_teacher"
  | "parent"
  | "student";

type AcademicRecordStatus =
  | "no_data"
  | "in_progress"
  | "submitted"
  | "compiled"
  | "approved"
  | "released"
  | "legacy";

type ScoreComponentDTO = {
  componentKey: string;
  label: string;
  weight: number;
  rawScore: number | null;
  rawMaxScore: number | null;
  rawPercentage: number | null;
  weightedScore: number | null;
  status: "complete" | "missing" | "not_required" | "provisional";
};
```

Full DTO:

```txt
StudentAcademicProfileDTO
- studentId
- schoolId
- classGroupId
- gradeId
- selectedPeriod
- periods[]
- visibilityMode
- recordStatus
- dataSource: report_snapshot | subject_results | live_gradebook | legacy
- summary
- reportStatus
- subjectResults[]
- attendance
- assessmentEvidenceSummary
- comments
- trends
- aiInsights
- reportCard
- permissions
```

### 7.1 Period DTO

```txt
periods[]
- academicPeriodId
- label
- startDate
- endDate
- isCurrent
- status: no_data | in_progress | compiled | approved | released | legacy
- hasReportCard
- isOfficial
```

### 7.2 Summary DTO

```txt
summary
- overallAverage
- projectedAverage
- finalAverage
- classPosition
- totalStudents
- totalSubjects
- completedSubjects
- missingSubjects
- performanceTier
- trend
- trendDelta
- riskLevel
- strongestSubject
- weakestSubject
```

Rules:

- Use `finalAverage` for released report cards.
- Use `projectedAverage` only for authorized staff when report is in progress.
- Parent/student views should not display projected scores unless school settings allow.

### 7.3 Report Status DTO

```txt
reportStatus
- status
- label
- isOfficial
- isReleased
- isProvisional
- reportCardRunId
- studentReportCardId
- releasedAt
- approvedAt
- compiledAt
- readiness
```

Readiness shape:

```txt
readiness
- subjectsExpected
- subjectsSubmitted
- subjectsApproved
- missingSubjects[]
- missingRequiredScores[]
- attendanceReady
- commentsReady
- issues[]
```

### 7.4 Subject Result DTO

```txt
subjectResults[]
- subjectId
- subjectName
- subjectCode
- teacherId
- teacherName
- status
- components[]
- finalScore
- roundedFinalScore
- gradeLabel
- gradePoint
- descriptor
- isPassed
- subjectPosition
- totalStudentsForSubject
- remark
- isOfficial
- hasBreakdown
- issueCount
```

Do not use `gradeLetter` in new DTO except as legacy fallback mapping.

### 7.5 Attendance DTO

```txt
attendance
- source: live_homeroom_attendance | report_snapshot | none
- isSnapshot
- totalSchoolDays
- daysPresent
- daysAbsent
- daysLate
- daysExcused
- attendancePercentage
- calculatedAt
- note
```

Rules:

- Current/in-progress period: use live homeroom attendance aggregation.
- Released period: use report-card attendance snapshot.
- If no attendance data exists, show a clear empty state.

### 7.6 Assessment Evidence DTO

```txt
assessmentEvidenceSummary
- countedItemsTotal
- nonCountedItemsTotal
- missingItemsTotal
- subjectsWithMissingEvidence[]
```

Breakdown endpoint should provide detailed item-level evidence for a selected subject.

### 7.7 Comments DTO

```txt
comments
- subjectComments[]
- classTeacherComment
- headteacherComment
- conduct
- interest
- attitude
- internalNotes optional admin-only
```

Released period comments come from `StudentReportCard` snapshot.

### 7.8 Trends DTO

```txt
trends
- termHistory[]
- subjectHistory
- componentHistory optional
- attendanceHistory
```

Term history should distinguish:

```txt
official released result
projected current result
legacy fallback result
```

### 7.9 Report Card DTO

```txt
reportCard
- status
- canView
- canDownload
- downloadUrl
- verificationId
- releasedAt
- templateName
```

---

## 8. Academic Period Selector

The period selector should evolve from simple term selection into an academic timeline.

Each period should show:

```txt
Term label
Status badge
Official/released indicator
```

Examples:

```txt
2025/2026 Term 1 — Released
2025/2026 Term 2 — Released
2025/2026 Term 3 — In Progress
```

Rules:

- Default to current period if it has data.
- If current has no data, default to latest released report.
- URL query param should remain supported, e.g. `?termId=`.

---

## 9. Term Snapshot Cards

Replace or evolve current `AcademicSummaryCards`.

Maximum four cards in the main row:

```txt
Average / Projected Average
Class Position / Standing
Attendance Rate
Report Status
```

For released reports:

```txt
Final Average
Official Position
Attendance Rate
Released Report
```

For in-progress staff view:

```txt
Projected Average
Submitted Subjects
Live Attendance
In Progress
```

For parent/student when not released:

```txt
No released report yet
```

Do not show provisional scores to parents/students by default.

---

## 10. Report Status / Readiness Panel

This is new.

For admin/homeroom teacher:

```txt
Report Card Status: In Progress
Subjects Submitted: 7 / 9
Missing Subjects: Science, French
Attendance: Ready
Class Teacher Comment: Pending
Headteacher Approval: Not Started
```

For released report:

```txt
Report Card Status: Released
Released on: 14 August 2026
Verification ID: EDU-XXXX
Download Report
```

For subject teacher:

Show only relevant subject status and allowed class-level summary.

For parent/student:

Show only released status or simple pending message.

---

## 11. Subject Results Table

The table must render dynamic components.

For 30/70 policy:

```txt
Subject | Classroom Work | Exam | Total | Grade | Teacher | Status
```

For multi-component policy:

```txt
Subject | Homework | Classwork | Project | Exam | Total | Grade | Teacher | Status
```

If there are too many components, avoid clutter:

- Show subject, final score, grade, status.
- Show component summary in compact chips.
- Put full component details in breakdown modal.

Row actions:

```txt
View Breakdown
View Report Row
```

No edit actions in Student Academic Profile.

---

## 12. Assessment Breakdown Modal / Drawer

Update `AssessmentBreakdownModal` to explain the full calculation path.

The modal should show:

```txt
Subject
Final score
Grade label
Policy name
Assessment plan name
Component breakdown
Counted assessments
Non-counted assessments
Missing required assessments
Calculation explanation
Teacher remark
```

Example:

```txt
Mathematics Breakdown

Classroom Work — 30%
- Class Exercise 1: 15/20 — Counts
- Homework 1: 18/20 — Counts
- Weekend Practice: 9/10 — Does not count

Exam — 70%
- End of Term Exam: 88/100 — Counts

Final: 88.1
Grade: A
```

For rule-based contribution, show why items were included:

```txt
Included by rule: Best 3 class exercises
Excluded by rule: Lowest score dropped
```

For teacher-selected contribution:

```txt
Included by teacher selection
```

---

## 13. Attendance Summary Section

Show attendance for selected period.

For current/in-progress periods:

```txt
Source: Live homeroom attendance
```

For released reports:

```txt
Source: Official report-card snapshot
```

Display:

```txt
School Days
Present
Absent
Late
Excused
Attendance Rate
```

If missing:

```txt
No homeroom attendance has been recorded for this period yet.
```

For admin/homeroom teacher, show missing-data warning if report cannot compile.

---

## 14. Performance Trends

Existing trend components can be preserved but must use new data sources.

Trends should show:

- Official released results.
- Projected current results for staff only.
- Legacy fallback indicators during migration.

Trend labels:

```txt
Official
Projected
Legacy
```

Charts should stay simple.

Recommended charts:

1. Overall average over periods.
2. Subject trend over periods.
3. Attendance trend over periods.
4. Optional component trend for staff only.

Do not add too many charts to the main tab.

---

## 15. Teacher and Report Comments

The comments section should support:

```txt
Subject teacher remarks
Class teacher comment
Headteacher comment
Conduct
Interest
Attitude
```

Rules:

- Released period: use report-card snapshot comments.
- In-progress period: use live comments/status for staff.
- Parent/student: released comments only.

Avoid showing internal correction notes to parents/students.

---

## 16. Leo AI Insights

The existing `AIInsightsPanel` should become more context-aware.

Leo should receive:

```txt
Subject results
Dynamic components
Assessment evidence
Counted vs non-counted marks
Missing scores
Attendance summary
Trends
Teacher comments
Report status
Grading policy context
```

### 16.1 Insight modes

Keep role-aware insight modes:

```txt
Admin
Teacher
Parent
Student
```

### 16.2 Admin insights

Examples:

```txt
This report is blocked because French exam score is missing.
Attendance dropped in the same period Science performance declined.
The student has strong classwork but weak exam performance.
```

### 16.3 Teacher insights

Examples:

```txt
Classroom work is stable, but exam performance needs timed practice.
Homework completion is inconsistent.
The student performs better in projects than written tests.
```

### 16.4 Parent insights

Examples:

```txt
Your child is doing well in class activities but needs more exam practice at home.
Reading practice three times a week may help English performance.
```

### 16.5 Student insights

Examples:

```txt
You are improving in Mathematics. Focus on exam practice and keep up your classwork.
```

### 16.6 AI safety and truthfulness

Leo must not invent scores, comments, diagnoses, medical explanations, or promises.

If data is incomplete, Leo should say so.

---

## 17. Role-Based Visibility

### 17.1 School Admin

Can see:

- Full subject results.
- All components.
- Report readiness.
- Missing marks.
- Attendance source.
- Official/provisional labels.
- AI admin insights.
- Report download if released.

### 17.2 Homeroom Teacher

Can see:

- All subjects for assigned class students.
- Report readiness.
- Attendance summary.
- Class teacher comments.
- Correction needs.
- AI homeroom/teacher insights.

### 17.3 Subject Teacher

Can see:

- Their subject breakdown in detail.
- Student’s broader summary if school policy allows.
- Attendance summary if allowed.
- Teacher-focused Leo suggestions.

### 17.4 Parent

Can see:

- Released report cards.
- Final subject results.
- Attendance snapshot.
- Teacher/headteacher comments.
- Parent-friendly Leo explanation.

Cannot see:

- Draft marks.
- Internal readiness issues.
- Internal correction notes.
- Unreleased report cards.

### 17.5 Student

Can see:

- Released results.
- Simple progress summary.
- Student-friendly improvement guidance.
- Report card download if school allows.

---

## 18. Backend Builder Strategy

Build a new profile builder beside the old one first.

Suggested files:

```txt
src/lib/academics/profile/buildStudentAcademicProfileDTO.ts
src/lib/academics/profile/buildProfileFromReportCard.ts
src/lib/academics/profile/buildProfileFromSubjectResults.ts
src/lib/academics/profile/buildLegacyAcademicProfileFallback.ts
src/lib/academics/profile/buildAttendanceProfile.ts
src/lib/academics/profile/buildAcademicTrends.ts
```

Do not immediately delete:

```txt
src/lib/academics/buildStudentAcademicsDTO.ts
```

Instead:

1. Build new DTO in parallel.
2. Use it behind a new API route or feature flag.
3. Switch admin student tab.
4. Switch parent/student surfaces after validation.
5. Deprecate old DTO.

---

## 19. API Specification

Suggested new API:

```txt
GET /api/admin/students/[id]/academic-profile?periodId=
GET /api/admin/students/[id]/academic-profile/breakdown?periodId=&subjectId=
```

Parent:

```txt
GET /api/parent/wards/[id]/academic-profile?periodId=
GET /api/parent/wards/[id]/academic-profile/breakdown?periodId=&subjectId=
```

Student:

```txt
GET /api/student/academic-profile?periodId=
```

Response shape:

```json
{ "success": true, "data": {} }
{ "success": false, "error": "Message" }
```

### 19.1 Admin route rules

- Requires school admin or permitted staff access.
- Scope by `schoolId`.
- Can include provisional data.

### 19.2 Parent route rules

- Parent must be linked to the student.
- Show released data only unless school setting allows progress visibility.

### 19.3 Student route rules

- Student can only access own academic profile.
- Show released data only unless school setting allows progress visibility.

---

## 20. UI Component Plan

Evolve current components instead of replacing everything at once.

### Current components to evolve

```txt
StudentAcademicsTab.tsx
AcademicSummaryCards.tsx
TermSelector.tsx
SubjectPerformanceTable.tsx
AssessmentBreakdownModal.tsx
TeacherCommentsSection.tsx
AIInsightsPanel.tsx
OverallPerformanceTrend.tsx
SubjectPerformanceOverTime.tsx
SubjectStrengthsOverview.tsx
```

### New components to add

```txt
ReportStatusPanel.tsx
AttendanceSummaryPanel.tsx
AcademicEvidenceSummary.tsx
ReportCardActionsPanel.tsx
OfficialStatusBadge.tsx
ScoreComponentChips.tsx
```

Keep components small and focused.

---

## 21. Implementation Slices

## Slice 0 — Discovery and Current Academics Map

Goal: Inspect current academics tab, DTO builder, parent/student surfaces, and report download routes.

Acceptance criteria:

- Agent reports current files and dependencies.
- Agent identifies old DTO fields to preserve temporarily.
- No functional change.

## Slice 1 — New DTO Types

Goal: Add `StudentAcademicProfileDTO` types.

Suggested file:

```txt
src/types/academics/student-academic-profile.ts
```

Acceptance criteria:

- Supports dynamic components.
- Supports report status.
- Supports attendance source/snapshot.
- Supports role visibility.
- Does not remove old `StudentAcademicsDTO` yet.

## Slice 2 — Profile Builder Foundation

Goal: Create profile builder shell.

Suggested file:

```txt
src/lib/academics/profile/buildStudentAcademicProfileDTO.ts
```

Acceptance criteria:

- Accepts `studentId`, `schoolId`, `periodId`, `viewerRole`.
- Returns safe empty profile if no data.
- Does not break old route.

## Slice 3 — Build Profile from Released StudentReportCard

Goal: Use official snapshot as first-priority data source.

Acceptance criteria:

- Reads `StudentReportCard` for selected period.
- Maps snapshot to subjectResults, summary, attendance, comments, reportCard.
- Marks `dataSource = report_snapshot`.
- Marks `recordStatus = released/approved/compiled` as appropriate.

## Slice 4 — Build Profile from SubjectResult

Goal: Support current/in-progress staff views from `SubjectResult`.

Acceptance criteria:

- Reads `SubjectResult` for selected period.
- Builds dynamic component rows.
- Calculates summary from submitted/approved subject results.
- Shows provisional status.
- Staff only by default.

## Slice 5 — Attendance Profile Builder

Goal: Add attendance summary.

Acceptance criteria:

- Released period uses report snapshot.
- Current period uses live `StudentAttendance` where `type = homeroom`.
- Returns empty state if no attendance.

## Slice 6 — Legacy Fallback Adapter

Goal: Preserve existing academics views during migration.

Acceptance criteria:

- Maps old `SubjectGrade` to new subject result DTO shape.
- Maps `gradeLetter` to `gradeLabel`.
- Marks `dataSource = legacy`.
- Does not use legacy data if new report snapshot exists.

## Slice 7 — Admin Academic Profile API

Goal: Add new admin route.

Route:

```txt
/api/admin/students/[id]/academic-profile
```

Acceptance criteria:

- Auth and school scoping.
- Uses new builder.
- Allows provisional staff data.
- Consistent JSON response.

## Slice 8 — Breakdown API

Goal: Add subject-level breakdown endpoint.

Route:

```txt
/api/admin/students/[id]/academic-profile/breakdown
```

Acceptance criteria:

- Released reports use snapshot evidence.
- Current staff views use AssessmentItem/AssessmentScore/SubjectResult evidence.
- Shows counted, non-counted, missing items.
- Explains teacher-selected vs rule-based contribution.

## Slice 9 — New Hook

Goal: Add frontend hook for new profile.

Suggested file:

```txt
src/hooks/admin/useStudentAcademicProfile.ts
```

Acceptance criteria:

- Uses TanStack React Query.
- Supports period selection.
- Handles loading/error states.
- Does not remove old hook yet.

## Slice 10 — Academic Period Selector Upgrade

Goal: Update or create selector showing status badges.

Acceptance criteria:

- Shows released/in-progress/legacy statuses.
- Keeps `?termId` or migrates cleanly to `?periodId` with compatibility.
- Does not clutter UI.

## Slice 11 — Summary Cards Upgrade

Goal: Update summary cards to official/provisional status.

Acceptance criteria:

- Max four cards.
- Shows final vs projected correctly.
- Shows attendance card.
- Shows report status card.
- Parent/student do not see draft/provisional scores by default.

## Slice 12 — Report Status Panel

Goal: Add `ReportStatusPanel`.

Acceptance criteria:

- Admin/homeroom see readiness details.
- Parent/student see simple released/pending message.
- Shows download action only when available.

## Slice 13 — Dynamic Subject Results Table

Goal: Replace fixed CA/exam columns with dynamic components.

Acceptance criteria:

- Renders component columns when few enough.
- Uses compact component chips when many components.
- Uses `gradeLabel`.
- Shows official/provisional badges.
- Has breakdown action.

## Slice 14 — Assessment Breakdown Modal Upgrade

Goal: Update modal to new calculation evidence.

Acceptance criteria:

- Shows component breakdown.
- Shows counted/non-counted/missing assessment items.
- Shows calculation explanation.
- Works for teacher-selected and rule-based modes.
- Falls back gracefully for legacy data.

## Slice 15 — Attendance Summary Panel

Goal: Add/upgrade attendance section.

Acceptance criteria:

- Shows source: live homeroom or report snapshot.
- Shows present/absent/late/excused.
- Clear empty state if no attendance.
- No manual attendance editing from this tab.

## Slice 16 — Comments Section Upgrade

Goal: Support subject, class teacher, headteacher, conduct/interest/attitude.

Acceptance criteria:

- Released reports use snapshot comments.
- Staff can see live comments where applicable.
- Parent/student see released comments only.

## Slice 17 — Trends Upgrade

Goal: Trends use new report snapshots/results.

Acceptance criteria:

- Official results distinguished from projected.
- Legacy fallback labeled internally where needed.
- Charts stay simple.

## Slice 18 — Leo AI Context Upgrade

Goal: Feed richer data to AI insights.

Acceptance criteria:

- Includes components, attendance, counted/non-counted evidence, report status.
- Role-specific insight modes.
- Does not invent missing data.
- Uses existing AI panel patterns.

## Slice 19 — Parent Academic Profile API/UI

Goal: Migrate parent academics view safely.

Acceptance criteria:

- Parent sees released official report data.
- No draft/internal data leaks.
- Download/view report actions work only if released.

## Slice 20 — Student Results API/UI

Goal: Migrate student results page safely.

Acceptance criteria:

- Student sees own released data.
- Student-friendly labels and insights.
- No internal readiness or correction info.

## Slice 21 — Old DTO Deprecation Plan

Goal: After new surfaces are stable, document and reduce old DTO usage.

Acceptance criteria:

- Identify remaining `buildStudentAcademicsDTO` consumers.
- Migrate or keep explicit compatibility wrappers.
- Do not break report download routes.

---

## 22. Anti-Drift Strategy for AI Agents

Every agent task must include:

```txt
Read AGENTS.md first.
This task belongs to the Student Academic Profile spec.
Do not implement the Assessment Engine itself unless the slice explicitly requires reading from it.
Do not redesign the whole student detail page.
Do not expose provisional marks to parents/students.
Do not hardcode CA/exam columns in new UI.
Keep the UI aligned with the premium glass workspace standard.
Keep the tab simple and uncluttered.
Use new data first, legacy fallback second.
Report changed files and checks run.
```

Agents must not jump from the profile tab into unrelated student modules such as fees, documents, health, communication, or admissions.

---

## 23. Testing Strategy

### 23.1 Builder tests

Cover:

- Released report snapshot mapping.
- SubjectResult mapping.
- Legacy fallback mapping.
- Attendance live vs snapshot source.
- Parent visibility restrictions.
- Student visibility restrictions.
- Admin provisional visibility.

### 23.2 API tests

Cover:

- Admin can view school student profile.
- Parent cannot view unrelated student.
- Student cannot view another student.
- Parent does not receive draft marks.
- Missing period returns safe empty profile.

### 23.3 UI QA

Check:

- No data state.
- Legacy-only student.
- Current in-progress period.
- Released report period.
- Dynamic multi-component policy.
- Teacher-selected breakdown.
- Rule-based breakdown.
- Missing attendance.
- Parent view.
- Student view.

---

## 24. Migration Plan

### Phase 1

Add new DTO and profile builder beside old `StudentAcademicsDTO`.

### Phase 2

Use new profile for admin student detail academics tab behind direct route/hook.

### Phase 3

Add released report-card snapshot support.

### Phase 4

Add subject result/provisional staff support.

### Phase 5

Upgrade breakdown modal.

### Phase 6

Upgrade parent and student views.

### Phase 7

Retire old `caPercentage`, `examPercentage`, and `gradeLetter` assumptions where no longer needed.

---

## 25. AI Agent Prompt Template

```txt
You are working inside edusentrix-web-nextjs.
Read AGENTS.md first.
This task belongs to the Student Academic Profile spec.
Implement only Slice [NUMBER]: [SLICE NAME].

Do not build unrelated student tabs.
Do not expose draft/provisional results to parents or students.
Do not hardcode CA/exam columns in new code.
Use SubjectResult/StudentReportCard data first and legacy fallback only where required.
Use schoolId scoping and existing auth helpers.
Use the existing premium glass UI style.
Keep the screen simple and uncluttered.

Before coding, inspect relevant files and report your plan.
After coding, report changed files, checks run, and next slice.
```

---

## 26. Final Acceptance Criteria

The Student Academic Profile is complete when:

- It reads released report-card snapshots as the official source.
- It reads current SubjectResults for authorized staff provisional views.
- It supports dynamic score components.
- It no longer assumes CA/exam only.
- It uses `gradeLabel`, not only `gradeLetter`.
- It shows report-card status clearly.
- It shows attendance from live homeroom records or official report snapshot.
- It explains counted and non-counted assessment evidence.
- It shows performance trends across periods.
- It gives role-aware Leo AI insights.
- It prevents parent/student access to internal draft data.
- It remains clean, readable, and visually aligned with EduSentrix.

---

## 27. Product Quality Bar

The Student Academic Profile should feel like a calm academic story page, not a raw database screen.

It should help a school quickly understand:

```txt
How is this student doing?
Is the current result official or still in progress?
What contributed to the score?
Is attendance affecting performance?
What has changed over time?
What should we do next?
```

The page should be simple enough for a school administrator, teacher, parent, or student to understand without training.

