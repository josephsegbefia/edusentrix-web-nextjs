# EduSentrix Exam Scheduling & Invigilation Engine Spec

**Spec Version:** v4 finished-product specification  
**Product Area:** EduSentrix Web / School Academic Operations  
**Related Systems:** Academic Assessment & Report Card Engine, Student Academic Profile, Timetable/Daily Schedule, Attendance, Notifications, Calendar, Teacher Studio  
**Primary Users:** School Admin, Academic Head, Exam Officer, Homeroom Teacher, Subject Teacher, Invigilator, Parent, Student, Platform Admin  
**Implementation Style:** Small, safe, AI-agent build slices  
**Status:** Ready for implementation planning

---

## 1. Purpose

EduSentrix already supports assessments, assignments, marks recording, grading policies, and report-card creation. However, a full school academic operations system also needs an **Exam Scheduling & Invigilation Engine**.

This engine manages:

- Exam sessions for academic periods.
- Exam timetable creation.
- Room and venue assignment.
- Teacher invigilation assignment.
- Conflict detection.
- Exam timetable publishing and versioning.
- Teacher invigilation dashboards.
- Parent/student exam visibility.
- Exam-to-assessment-item linking.
- Exam completion tracking.
- Exam marks readiness.
- Exportable/printable timetables.
- Audit trails and notifications.
- Leo-assisted scheduling suggestions.

The finished system should make EduSentrix feel like a serious, world-class school management platform that supports real academic operations, not just marks entry.

---

## 2. Product Vision

The Exam Scheduling & Invigilation Engine should answer these questions clearly:

- What exams are happening this term?
- Which class or grade is writing each paper?
- When is each exam?
- Where is the exam taking place?
- Which teacher is invigilating?
- Are there timetable conflicts?
- Is the timetable ready to publish?
- Have teachers acknowledged their invigilation duties?
- Which exam marks are pending?
- Which exams are linked to report-card assessment items?
- What version of the timetable is currently official?
- What do parents and students see?

The system should be simple enough for a small school to use, but robust enough for a large school with many grades, class groups, rooms, subject teachers, and invigilators.

---

## 3. Core Principle

Do **not** build this as a simple calendar page.

Build it as:

```txt
Exam Session
    → Exam Timetable Entries
    → Invigilation Assignments
    → Conflict Review
    → Published Timetable Version
    → Linked Assessment Items
    → Marks Recording
    → Report Card Compilation
```

The most important integration rule is:

```txt
Every report-contributing exam timetable entry should create or link to an official AssessmentItem in the Academic Assessment & Report Card Engine.
```

This creates traceability from timetable to marks to report card.

---

## 4. Relationship to Other EduSentrix Systems

### 4.1 Academic Assessment & Report Card Engine

This engine feeds official exam mark items into the assessment/report-card system.

Flow:

```txt
Exam Timetable Entry
    → Linked AssessmentItem
    → AssessmentScores
    → SubjectResult
    → ReportCardRun
    → StudentReportCard
```

Examples:

- Basic 6 Mathematics End of Term Exam is scheduled.
- The timetable entry creates or links to `AssessmentItem`.
- Subject teacher enters exam scores against that item.
- Exam score contributes to the `Exam` component of the final score.
- Final report cards use that score.

### 4.2 Student Academic Profile

The Student Academic Profile should display published exam timetable data and completed exam evidence.

Examples:

- Upcoming exams for the selected academic period.
- Completed exams linked to assessment breakdown.
- Exam scores shown inside subject breakdown.
- Exam attendance/absence notes if applicable later.
- Leo AI suggestions based on exam performance.

### 4.3 School Calendar

Published exam timetables should appear in:

- School calendar.
- Class calendar.
- Teacher calendar.
- Parent/student calendar if enabled.

### 4.4 Teacher Dashboard

Teachers should see:

- My exam timetable.
- My invigilation duties.
- Exams requiring marks.
- Pending acknowledgement.
- Exam day instructions.

### 4.5 Notifications

Notifications should be triggered when:

- Timetable is published.
- Timetable is changed.
- Teacher is assigned as invigilator.
- Teacher is removed/replaced.
- Exam is approaching.
- Exam marks are overdue.
- Conflict is detected before publishing.

### 4.6 Attendance

Exam attendance is separate from daily homeroom attendance.

For v4, the engine should allow optional exam sitting status later:

- Present for exam.
- Absent for exam.
- Excused.
- Medical absence.
- Rescheduled/special sitting.

However, report-card attendance should still come from daily homeroom attendance, not exam timetable attendance.

---

## 5. Finished Product Scope

The finished v4 product includes:

1. Exam session management.
2. Exam timetable builder.
3. Manual scheduling.
4. Smart-assisted timetable generation.
5. Venue/room management.
6. Invigilator assignment.
7. Invigilator workload balancing.
8. Conflict detection.
9. Conflict resolution suggestions.
10. Exam policy/settings.
11. Timetable publishing.
12. Timetable versioning.
13. Teacher acknowledgement.
14. Teacher invigilation dashboard.
15. Parent/student published timetable view.
16. Calendar integration.
17. Notifications.
18. PDF/CSV exports.
19. Exam-to-assessment-item linking.
20. Marks readiness tracking.
21. Exam completion status.
22. Audit logs.
23. Leo-assisted scheduling support.
24. Admin analytics/readiness dashboard.

---

## 6. Non-Goals

Do not build these into the first implementation unless explicitly requested later:

- Online exam delivery engine.
- Live proctoring/video monitoring.
- Automatic biometric exam attendance.
- Complex drag-and-drop scheduling as the only UI.
- AI-only scheduling with no manual control.
- National exam board integrations.
- Public candidate index-number management.

The system should support school internal exams first.

---

## 7. Current EduSentrix Alignment

The implementation should respect the current EduSentrix app structure and patterns.

### 7.1 Current UI Direction

Use the existing EduSentrix premium design language:

- Deep navy / dark background surfaces where already used.
- Cyan/sky primary accents, commonly around `#0ea5e9`.
- Violet/purple secondary accents, commonly around `#6d28d9` / `#7c3aed`.
- Soft gradients.
- Rounded cards.
- Clean shadows.
- Responsive layouts.
- Simple empty states.
- Minimal clutter.
- Tables only where tables are truly useful.
- Drawers/modals for detailed editing.
- Step-by-step wizards for complex workflows.

Do not introduce a new visual system.

### 7.2 Current Architecture Expectations

Follow existing project conventions:

- Next.js app structure.
- TypeScript everywhere.
- MongoDB/Mongoose models.
- Server actions/API route style already used in the app.
- Existing auth and school-scoped access checks.
- Existing role-based layout/navigation patterns.
- Existing toast/notification patterns.
- Existing reusable cards, buttons, badges, tables, drawers, modals where available.

### 7.3 UI Simplicity Rule

Every page should answer one primary question.

Examples:

- Exam Sessions page: “Which exam sessions exist and what is their status?”
- Timetable Builder: “What exam papers are scheduled and what is missing?”
- Conflict Review: “What prevents publishing?”
- Invigilator Dashboard: “Where am I assigned and what must I do?”

Avoid pages with too many widgets, charts, and cards. Use progressive disclosure.

---

## 8. User Roles and Permissions

### 8.1 Platform Admin

Can:

- View all schools’ exam feature status if platform-level support is needed.
- Enable/disable module per school if feature gating exists.
- View audit logs if permitted.

Should not normally manage school exam timetables directly unless impersonation/support mode is intentionally enabled.

### 8.2 School Admin

Can:

- Configure exam settings.
- Create exam sessions.
- Manage venues.
- Create/edit timetable entries.
- Assign invigilators.
- Review conflicts.
- Publish timetables.
- Export timetables.
- Link timetable entries to assessment items.
- Override certain conflicts with reason.
- Lock exam sessions.

### 8.3 Academic Head / Exam Officer

Can:

- Create and manage exam sessions.
- Build timetables.
- Assign invigilators.
- Publish timetable drafts if school policy allows.
- Monitor marks readiness.
- Export reports.

### 8.4 Homeroom Teacher

Can:

- View exam timetable for assigned class.
- View readiness for class exams.
- See whether exam marks are pending.
- Communicate with subject teachers if integrated.

Should not normally edit global exam timetables unless granted permission.

### 8.5 Subject Teacher

Can:

- View exams for subjects/classes they teach.
- See linked assessment item.
- Enter marks after exam if authorized.
- View timetable status.
- View own invigilation duties.

### 8.6 Invigilator

Can:

- View assigned invigilation duties.
- Acknowledge assignment.
- View room/class instructions.
- Mark exam started/completed if enabled.
- Report an issue.

### 8.7 Parent

Can:

- View published exam timetable for their child only.
- View changes after publication.
- Receive notifications if enabled.

### 8.8 Student

Can:

- View published exam timetable for own class only.
- See exam dates, subjects, venues, and instructions intended for students.

---

## 9. Suggested Permission Keys

Use project naming conventions if different, but conceptually create permissions like:

```txt
exam.sessions.read
exam.sessions.create
exam.sessions.update
exam.sessions.delete
exam.sessions.publish
exam.sessions.lock
exam.venues.manage
exam.timetable.read
exam.timetable.create
exam.timetable.update
exam.timetable.delete
exam.timetable.publish
exam.timetable.export
exam.invigilators.assign
exam.invigilators.acknowledge
exam.conflicts.review
exam.conflicts.override
exam.assessment.link
exam.analytics.read
exam.audit.read
```

Agents must not hardcode access by role only. Use existing authorization helpers and permission guards where available.

---

## 10. Core Domain Concepts

### 10.1 Exam Session

An exam session groups all exam papers for a period.

Examples:

- 2025/2026 Term 3 End of Term Exams.
- Basic 1–6 Midterm Assessment.
- JHS Mock Exams.
- Entrance Exams.

Statuses:

```txt
draft
scheduled
conflict_review
published
in_progress
completed
locked
archived
cancelled
```

### 10.2 Exam Timetable Entry

One scheduled exam sitting.

Examples:

- Basic 6 Blue Mathematics, Monday 3 Aug, 8:30–10:30, Room 4.
- JHS 1 all class groups English, Tuesday 4 Aug, 9:00–11:00, Main Hall.

### 10.3 Invigilation Assignment

Teacher/staff assigned to supervise an exam sitting.

Roles:

```txt
lead
assistant
standby
relief
```

Statuses:

```txt
assigned
acknowledged
declined
replaced
completed
missed
```

### 10.4 Exam Venue

A room or location where exams can happen.

Examples:

- Main Hall.
- Basic 6 Blue Classroom.
- ICT Lab.
- Library.

### 10.5 Exam Policy

School-level rules controlling scheduling and invigilation.

Examples:

- Allow subject teacher to invigilate own paper.
- Maximum invigilation sessions per teacher per day.
- Minimum break between exams.
- Maximum exams per class per day.
- Require venue for every exam.
- Require invigilator acknowledgement.

### 10.6 Timetable Version

A snapshot of a published timetable.

Used to prevent confusion after changes.

### 10.7 Exam Conflict

A detected issue that blocks or warns before publishing.

Examples:

- Teacher clash.
- Room double-booking.
- Class has overlapping exams.
- Exam outside session date range.
- Subject not offered by class.

### 10.8 Linked Assessment Item

The official assessment item that receives marks after the exam.

---

## 11. Data Model Specification

Use these as conceptual Mongoose model specs. Agents must adapt to existing project model conventions.

### 11.1 ExamSession

```ts
ExamSession {
  _id: ObjectId;
  schoolId: ObjectId;
  academicYearId?: ObjectId;
  academicPeriodId: ObjectId;

  name: string;
  code?: string;
  examType: 'midterm' | 'end_of_term' | 'mock' | 'entrance' | 'class_test' | 'other';

  startDate: Date;
  endDate: Date;

  appliesToGradeIds?: ObjectId[];
  appliesToClassGroupIds?: ObjectId[];
  appliesToSubjectIds?: ObjectId[];

  status: 'draft' | 'scheduled' | 'conflict_review' | 'published' | 'in_progress' | 'completed' | 'locked' | 'archived' | 'cancelled';

  policyId?: ObjectId;
  assessmentPlanId?: ObjectId;
  gradingPolicyId?: ObjectId;

  allowParentStudentVisibility: boolean;
  publishedAt?: Date;
  publishedBy?: ObjectId;
  lockedAt?: Date;
  lockedBy?: ObjectId;

  notes?: string;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes:

```txt
schoolId + academicPeriodId
schoolId + status
schoolId + startDate + endDate
```

### 11.2 ExamTimetableEntry

```ts
ExamTimetableEntry {
  _id: ObjectId;
  schoolId: ObjectId;
  examSessionId: ObjectId;
  academicPeriodId: ObjectId;

  title?: string;
  subjectId: ObjectId;
  gradeId?: ObjectId;
  classGroupIds: ObjectId[];

  date: Date;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  durationMinutes: number;

  venueId?: ObjectId;
  roomLabel?: string;
  capacityRequired?: number;

  assessmentItemId?: ObjectId;
  contributesToReport: boolean;
  assessmentComponentKey?: string; // e.g. exam
  maxScore?: number;

  instructionsForInvigilators?: string;
  instructionsForStudents?: string;
  materialsAllowed?: string[];
  specialNotes?: string;

  status: 'draft' | 'ready' | 'published' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled';

  createdBy: ObjectId;
  updatedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes:

```txt
schoolId + examSessionId
schoolId + date
examSessionId + subjectId
examSessionId + classGroupIds
assessmentItemId
```

### 11.3 ExamInvigilatorAssignment

```ts
ExamInvigilatorAssignment {
  _id: ObjectId;
  schoolId: ObjectId;
  examSessionId: ObjectId;
  examTimetableEntryId: ObjectId;

  teacherId: ObjectId;
  role: 'lead' | 'assistant' | 'standby' | 'relief';
  status: 'assigned' | 'acknowledged' | 'declined' | 'replaced' | 'completed' | 'missed';

  assignedBy: ObjectId;
  assignedAt: Date;
  acknowledgedAt?: Date;
  declinedAt?: Date;
  replacedByTeacherId?: ObjectId;
  replacementReason?: string;

  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes:

```txt
schoolId + teacherId
examSessionId + teacherId
examTimetableEntryId
```

### 11.4 ExamVenue

```ts
ExamVenue {
  _id: ObjectId;
  schoolId: ObjectId;
  name: string;
  code?: string;
  type: 'classroom' | 'hall' | 'lab' | 'library' | 'office' | 'outdoor' | 'other';
  capacity?: number;
  locationNote?: string;
  isActive: boolean;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

### 11.5 ExamPolicy

```ts
ExamPolicy {
  _id: ObjectId;
  schoolId: ObjectId;
  name: string;
  isDefault: boolean;

  requireVenue: boolean;
  requireInvigilator: boolean;
  requireTeacherAcknowledgement: boolean;

  allowSubjectTeacherInvigilation: boolean;
  maxInvigilationSessionsPerTeacherPerDay?: number;
  maxInvigilationSessionsPerTeacherPerSession?: number;
  maxExamsPerClassPerDay?: number;
  minBreakMinutesBetweenExams?: number;

  preventRoomDoubleBooking: boolean;
  preventClassExamOverlap: boolean;
  preventTeacherInvigilationOverlap: boolean;
  preventHolidayScheduling: boolean;

  coreSubjectsMorningPreference?: boolean;
  allowConflictOverride: boolean;
  requireOverrideReason: boolean;

  createdBy: ObjectId;
  updatedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

### 11.6 ExamTimetableVersion

```ts
ExamTimetableVersion {
  _id: ObjectId;
  schoolId: ObjectId;
  examSessionId: ObjectId;
  versionNumber: number;

  status: 'published' | 'superseded' | 'rolled_back';
  changeSummary: string;
  snapshot: {
    session: Record<string, unknown>;
    entries: Record<string, unknown>[];
    invigilators: Record<string, unknown>[];
    venues?: Record<string, unknown>[];
  };

  publishedBy: ObjectId;
  publishedAt: Date;
}
```

### 11.7 ExamConflictSnapshot

Conflicts may be computed live, but storing review snapshots helps audit and publishing.

```ts
ExamConflictSnapshot {
  _id: ObjectId;
  schoolId: ObjectId;
  examSessionId: ObjectId;

  generatedAt: Date;
  generatedBy?: ObjectId;
  status: 'open' | 'resolved' | 'overridden';

  conflicts: Array<{
    key: string;
    type: 'class_overlap' | 'teacher_overlap' | 'room_overlap' | 'outside_session_range' | 'missing_invigilator' | 'missing_venue' | 'subject_not_offered' | 'holiday_overlap' | 'workload_warning' | 'policy_warning' | 'other';
    severity: 'error' | 'warning' | 'info';
    message: string;
    affectedEntryIds?: ObjectId[];
    affectedTeacherIds?: ObjectId[];
    affectedClassGroupIds?: ObjectId[];
    affectedVenueIds?: ObjectId[];
    suggestion?: string;
    canOverride: boolean;
    overriddenBy?: ObjectId;
    overrideReason?: string;
    overriddenAt?: Date;
  }>;
}
```

### 11.8 ExamIncidentReport

Optional but part of the finished product.

```ts
ExamIncidentReport {
  _id: ObjectId;
  schoolId: ObjectId;
  examSessionId: ObjectId;
  examTimetableEntryId: ObjectId;
  reportedBy: ObjectId;

  type: 'late_start' | 'student_absence' | 'teacher_absence' | 'material_issue' | 'misconduct' | 'emergency' | 'other';
  severity: 'low' | 'medium' | 'high';
  description: string;
  actionTaken?: string;
  status: 'open' | 'reviewed' | 'resolved';

  createdAt: Date;
  updatedAt: Date;
}
```

### 11.9 ExamStudentSittingStatus

Optional but part of the finished product.

```ts
ExamStudentSittingStatus {
  _id: ObjectId;
  schoolId: ObjectId;
  examSessionId: ObjectId;
  examTimetableEntryId: ObjectId;
  studentId: ObjectId;

  status: 'present' | 'absent' | 'excused' | 'medical' | 'rescheduled' | 'exempted';
  recordedBy: ObjectId;
  recordedAt: Date;
  note?: string;
}
```

This should not replace daily homeroom attendance. It is exam-specific evidence.

---

## 12. API / Server Capability Specification

Agents should follow existing API route/service conventions in the codebase.

### 12.1 Exam Sessions

Required capabilities:

```txt
Create exam session
List exam sessions
Read exam session detail
Update draft exam session
Cancel exam session
Lock exam session
Archive exam session
```

Rules:

- Only draft/scheduled sessions should be freely editable.
- Published sessions require versioned changes.
- Locked sessions cannot be edited except by privileged override.

### 12.2 Venues

Required capabilities:

```txt
Create venue
List venues
Update venue
Deactivate venue
```

Rules:

- Do not hard-delete venues used by timetable entries.
- Use `isActive=false`.

### 12.3 Timetable Entries

Required capabilities:

```txt
Create timetable entry
Bulk create timetable entries
Update timetable entry
Delete draft timetable entry
List entries by session
List entries by class
List entries by teacher
List entries by date
```

Rules:

- Entries must belong to the same school and academic period as the session.
- Date must fall within session range unless override is enabled.
- Duration must be positive.
- Class groups must be valid and active.
- Subject must be offered by selected class group or grade where subject offering rules exist.

### 12.4 Invigilator Assignments

Required capabilities:

```txt
Assign invigilator
Bulk assign invigilators
Replace invigilator
Remove invigilator
Acknowledge assignment
Decline assignment with reason
List teacher invigilation schedule
```

Rules:

- Teacher must belong to school.
- Prevent overlapping invigilation unless override with reason.
- If policy disallows subject teacher invigilation, block or warn.

### 12.5 Conflict Detection

Required capabilities:

```txt
Run conflict check for session
Return conflicts grouped by severity
Persist conflict snapshot before publishing
Allow selected conflict override where policy allows
Clear resolved conflicts
```

Conflict types:

```txt
class_overlap
teacher_overlap
room_overlap
outside_session_range
missing_invigilator
missing_venue
subject_not_offered
holiday_overlap
teacher_unavailable
too_many_exams_per_day
insufficient_break_between_exams
teacher_workload_warning
subject_teacher_invigilation_policy
missing_assessment_link
```

### 12.6 Publishing and Versioning

Required capabilities:

```txt
Preview publish readiness
Publish exam timetable
Create timetable version snapshot
Republish changed timetable as new version
Rollback to previous version if allowed
List versions
Read version snapshot
```

Rules:

- Publishing should be blocked by unresolved error conflicts.
- Warning conflicts may be allowed with reason if policy allows.
- Every publish action creates a new version snapshot.
- Parent/student visibility should depend on publish status and visibility settings.

### 12.7 Assessment Linking

Required capabilities:

```txt
Create linked assessment item from timetable entry
Link existing assessment item to timetable entry
Unlink assessment item from draft/unpublished entry
Validate assessment link readiness
List entries missing assessment links
```

Rules:

- If `contributesToReport=true`, an assessment item is required before marks submission/report compilation.
- Linked assessment item must match school, period, subject, class/grade context, component, and max score rules.
- If assessment plan has an exam component, map entry to that component.

### 12.8 Teacher Exam Dashboard

Required capabilities:

```txt
Get my upcoming invigilation duties
Get my assigned exam entries by class/subject
Get exams requiring marks
Acknowledge invigilation duty
Report issue
Mark exam started/completed if enabled
```

### 12.9 Parent/Student Published View

Required capabilities:

```txt
Get published exam timetable for student
Get published class timetable
Get changed timetable notices
```

Rules:

- Only published/current version data should be visible.
- Parents only see their own children.
- Students only see own class/grade timetable.

### 12.10 Exports

Required capabilities:

```txt
Export full exam timetable PDF
Export class exam timetable PDF
Export teacher invigilation PDF
Export room schedule PDF
Export CSV
```

Use existing PDF/export conventions if available.

---

## 13. Conflict Detection Rules

### 13.1 Blocking Errors

These should block publishing unless explicitly overridden by privileged admin where allowed:

```txt
Class group has overlapping exams.
Teacher has overlapping invigilation assignments.
Venue is double-booked.
Exam date is outside session range.
Required venue is missing.
Required invigilator is missing.
Subject is not offered by selected class/group.
Exam has invalid duration.
Exam has no class group.
Exam has no subject.
Report-contributing exam has no assessment item link.
```

### 13.2 Warnings

These may allow publishing with warning:

```txt
Teacher has too many invigilation sessions in one day.
Class has too many exams in one day.
Core subject scheduled late in the day.
Subject teacher assigned to invigilate own paper where policy warns but does not block.
Exam overlaps non-critical calendar event.
Venue capacity appears too small.
No assistant invigilator for large class.
```

### 13.3 Info Notices

Examples:

```txt
No student instructions added.
No invigilator instructions added.
No materials allowed list configured.
No timetable export generated yet.
```

---

## 14. Scheduling Modes

The finished product should support three scheduling modes.

### 14.1 Manual Mode

Admin creates entries manually.

Best for:

- Small schools.
- Simple timetables.
- Fast one-off exam sessions.

UI:

- Create entry button.
- Entry drawer.
- Date/time/class/subject/venue/invigilator fields.
- Conflict check after save.

### 14.2 Bulk Draft Mode

System creates draft rows from selected classes and subjects.

Admin selects:

```txt
Exam session
Grades/classes
Subjects
Default duration
Default component
Default max score
```

System creates unscheduled draft entries.

Admin then fills:

```txt
Date
Time
Venue
Invigilators
```

### 14.3 Smart-Assisted Mode

System suggests a complete timetable using rules.

Inputs:

```txt
Exam date range
School day start/end
Break windows
Classes/grades
Subjects
Subject durations
Core subject priority
Maximum exams per class per day
Minimum break between exams
Available venues
Teacher availability
Invigilator policy
```

Output:

```txt
Draft timetable
Detected warnings
Confidence score
Suggested invigilators
Unscheduled items list
```

The user must review and confirm. Do not auto-publish AI-generated schedules.

### 14.4 Leo-Assisted Mode

Leo can help the admin generate or improve schedules.

Example prompts:

```txt
Generate a 5-day exam timetable for Basic 4 to JHS 3.
Put Maths and English in the morning.
Avoid giving any class more than two exams per day.
Balance invigilation fairly across teachers.
```

Leo should only create a draft proposal. The admin must approve.

---

## 15. Exam Timetable Workflow

### 15.1 Create Exam Session

School admin/exam officer creates:

```txt
Name
Academic period
Exam type
Date range
Classes/grades
Visibility setting
Policy
```

Status becomes:

```txt
draft
```

### 15.2 Create/Bulk Generate Entries

Admin adds exam papers manually or generates draft entries from selected classes/subjects.

Each entry should have:

```txt
Subject
Class group(s)
Date
Time
Venue
Invigilator(s)
Assessment link
```

### 15.3 Link Assessment Items

For report-contributing exams, system should:

- Create linked assessment items automatically, or
- Let admin/teacher link existing assessment items.

### 15.4 Run Conflict Review

System checks all entries.

Outputs:

```txt
Errors
Warnings
Info notices
Readiness score
```

### 15.5 Fix Conflicts

Admin resolves issues.

UI should provide direct actions:

```txt
Change time
Change room
Change invigilator
Create assessment item
Remove duplicate entry
Override with reason
```

### 15.6 Publish Timetable

When ready:

- Create version snapshot.
- Mark entries as published.
- Notify teachers/invigilators.
- Make parent/student view available if enabled.
- Push events to calendar if enabled.

### 15.7 Manage Changes

After publishing:

- Edits require change summary.
- Republish creates new version.
- Affected users are notified.
- Previous versions remain available to admin.

### 15.8 Exam Day Operations

Teachers/invigilators can:

```txt
View duty
Acknowledge duty
View instructions
Mark started/completed
Report incident
```

### 15.9 Post-Exam Marks Readiness

Subject teachers see:

```txt
Exam completed
Marks pending
Marks submitted
Marks approved
```

This connects to the assessment/report-card engine.

### 15.10 Lock Exam Session

After all exams and marks are completed:

- Exam session can be locked.
- Timetable cannot be changed.
- Historical data remains available.

---

## 16. UI / UX Specification

All UI should be premium but calm. Avoid dashboards overloaded with too many charts.

### 16.1 Navigation

Recommended school admin navigation:

```txt
Academics
  → Exams
      → Exam Sessions
      → Exam Timetables
      → Invigilation
      → Venues
      → Settings
```

Or if current app groups around assessment:

```txt
Academics
  → Assessment & Reports
      → Exam Timetables
```

Recommended teacher navigation:

```txt
Teacher
  → My Exams
      → Timetable
      → Invigilation Duties
      → Marks Pending
```

Student/parent:

```txt
Academics
  → Upcoming Exams
```

### 16.2 Exam Sessions Page

Purpose:

```txt
Show all exam sessions and their readiness/publishing status.
```

Layout:

- Header with page title and short description.
- Primary button: `Create Exam Session`.
- Filter chips: Draft, Published, In Progress, Completed, Locked.
- Cards or simple table.

Session card fields:

```txt
Name
Academic period
Date range
Classes/grades
Status badge
Entries count
Conflicts count
Published version
Primary action
```

Keep cards compact. Do not show every detail.

### 16.3 Create Exam Session Wizard

Use a simple wizard:

```txt
Step 1: Basic Details
Step 2: Classes & Subjects
Step 3: Exam Rules
Step 4: Review
```

Fields:

```txt
Name
Exam type
Academic period
Start/end date
Grades/classes
Default duration
Visibility
Policy
```

Avoid more than 5–7 fields per step.

### 16.4 Timetable Builder Page

Purpose:

```txt
Build and review the exam timetable for one session.
```

Top section:

```txt
Session name
Date range
Status
Readiness badge
Publish button
Export button
```

Compact summary cards:

```txt
Exam Papers
Missing Invigilators
Conflicts
Published Version
```

Filters:

```txt
Date
Class/grade
Subject
Venue
Status
Conflict status
```

Main table:

```txt
Date | Time | Class/Group | Subject | Venue | Invigilator(s) | Assessment Link | Status
```

Row actions:

```txt
Edit
Assign Invigilator
Link Assessment
View Conflicts
```

Details should open in a right-side drawer.

### 16.5 Timetable Entry Drawer

Fields grouped into sections:

1. Paper Details
2. Schedule
3. Venue
4. Invigilation
5. Assessment Link
6. Instructions

Do not show all fields expanded if not needed. Use collapsible sections.

### 16.6 Conflict Review Page

Purpose:

```txt
Show what prevents publishing and help the admin fix it.
```

Layout:

- Readiness score.
- Tabs: Errors, Warnings, Info.
- Issue cards.

Issue card:

```txt
Conflict type
Human-readable message
Affected entries
Suggested fix
Action buttons
```

Example:

```txt
Teacher Conflict
Mr. Mensah is assigned to two exams at the same time.
Affected: Basic 6 Maths, JHS 1 Science
Suggested fix: Replace one invigilator.
Actions: Replace Invigilator | Change Time | Override
```

### 16.7 Invigilation Assignment Page

Purpose:

```txt
Assign teachers fairly and avoid clashes.
```

Layout:

- Session filter.
- Workload summary table.
- Exam entries requiring invigilators.
- Teacher search drawer.

Teacher card:

```txt
Teacher name
Subjects taught
Availability badge
Assigned today count
Total session duties
Conflict badge
```

Actions:

```txt
Assign Lead
Assign Assistant
Assign Standby
```

### 16.8 Venues Page

Simple venue CRUD.

Fields:

```txt
Name
Type
Capacity
Location note
Active status
```

Do not overbuild.

### 16.9 Teacher My Exams Page

Tabs:

```txt
My Timetable
Invigilation Duties
Marks Pending
```

Invigilation duty card:

```txt
Date/time
Class
Subject
Venue
Role
Status
Instructions
Acknowledge button
Report issue
```

Keep it very clear for mobile/tablet usage.

### 16.10 Parent/Student Exam View

Simple, read-only.

Show:

```txt
Upcoming exams
Date
Time
Subject
Venue/room
Instructions
Last updated/version
```

Do not show invigilator names to parents/students unless school setting allows it.

### 16.11 Calendar Integration UI

When publishing, offer toggle:

```txt
Add published exams to school calendar
Notify teachers
Notify parents/students
```

Calendar event labels:

```txt
Exam: Basic 6 Mathematics
Invigilation: Basic 6 Mathematics
```

---

## 17. UI Color and Style Rules

Agents must use existing EduSentrix tokens/components. If exact tokens are unknown, use the closest existing utility classes.

Preferred visual language:

```txt
Primary action: cyan/sky accent
Secondary accent: violet/purple
Success: green
Warning: amber
Error: red
Neutral surfaces: existing card/background tokens
Rounded corners: consistent with current cards
Borders: subtle
Shadows: soft
```

Avoid:

```txt
New color palettes
Overly bright backgrounds
Heavy charting
Too many KPI cards
Dense forms
Large modal stacks
Complex drag-and-drop as required workflow
```

---

## 18. Smart Scheduling Algorithm Specification

The finished product should include a smart-assisted scheduler.

### 18.1 Inputs

```txt
Exam session date range
School day start/end
Breaks
Subjects per class
Class groups
Exam durations
Venue availability
Teacher availability
Invigilation policy
Core subject priority
Max exams per day per class
Min break between exams
```

### 18.2 Output

```txt
Draft timetable entries
Suggested invigilators
Unscheduled entries
Warnings
Confidence score
Explanation summary
```

### 18.3 Rules

The scheduler should attempt to:

- Avoid class overlaps.
- Avoid teacher invigilation overlaps.
- Avoid room overlaps.
- Keep core subjects in morning if enabled.
- Balance invigilation duties.
- Avoid more than max exams per class per day.
- Respect minimum break between exams.
- Use larger venues for larger class groups.
- Leave unscheduled items instead of forcing bad schedules.

### 18.4 Leo AI Role

Leo should not directly write to final published tables.

Leo can:

- Suggest timetable draft.
- Explain conflicts.
- Recommend invigilator replacements.
- Summarize readiness.
- Draft parent notification message.

Leo must not:

- Publish timetable without user action.
- Override conflicts without admin action.
- Assign teachers without confirmation.

---

## 19. Notifications Specification

### 19.1 Notification Events

```txt
exam_session_created
exam_timetable_published
exam_timetable_changed
invigilator_assigned
invigilator_replaced
invigilator_acknowledgement_required
exam_reminder_teacher
exam_reminder_parent_student
exam_marks_pending
exam_conflict_detected
exam_session_locked
```

### 19.2 Notification Recipients

- School admin/exam officer.
- Assigned invigilators.
- Subject teachers.
- Homeroom teachers.
- Parents/students if published and visibility enabled.

### 19.3 Message Style

Messages should be short and specific.

Example:

```txt
You have been assigned to invigilate Basic 6 Mathematics on Monday, 3 Aug, 8:30 AM–10:30 AM in Room 4.
```

For changes:

```txt
The Basic 6 Mathematics exam has been moved from Monday 3 Aug to Tuesday 4 Aug at 8:30 AM.
```

---

## 20. Exports and Print Specification

The finished product should support:

### 20.1 Full School Timetable PDF

Grouped by date.

Columns:

```txt
Time
Class/grade
Subject
Venue
Invigilator(s)
```

### 20.2 Class Timetable PDF

For one class/group.

Columns:

```txt
Date
Time
Subject
Venue
Instructions
```

### 20.3 Teacher Invigilation Schedule PDF

For one teacher or all teachers.

Columns:

```txt
Date
Time
Class
Subject
Venue
Role
```

### 20.4 Room/Venue Schedule PDF

For exam operations.

Columns:

```txt
Date
Time
Venue
Class
Subject
Invigilator
```

### 20.5 CSV Export

For administrative backup or printing elsewhere.

---

## 21. Report Card and Assessment Integration Rules

### 21.1 Auto-Create Assessment Item

When creating a report-contributing exam entry, the system should offer:

```txt
Create linked assessment item automatically
```

Default fields:

```txt
Title: [Class/Grade] [Subject] [Exam Session Name]
Type: exam
Component: exam or configured policy component
Max score: policy default or user input
Contributes to report: true
Academic period: same as exam session
Subject/class context: same as timetable entry
```

### 21.2 Link Existing Assessment Item

If an assessment item already exists, allow linking.

Validation:

```txt
Same school
Same academic period
Same subject
Compatible class/grade scope
ContributesToReport true if required
Component matches exam component
```

### 21.3 Marks Pending

After exam date passes, linked assessment item should appear in subject teacher’s marks pending list.

### 21.4 Report Compilation Guard

The report-card engine should block final report compilation if:

```txt
Required exam assessment item exists but marks are missing.
Exam timetable entry is completed but subject result is not submitted.
Exam component is required by assessment plan but no linked score exists.
```

---

## 22. Status Lifecycle

### 22.1 Exam Session Lifecycle

```txt
draft
  → scheduled
  → conflict_review
  → published
  → in_progress
  → completed
  → locked
  → archived
```

Cancelled path:

```txt
draft/scheduled/published → cancelled
```

### 22.2 Timetable Entry Lifecycle

```txt
draft
  → ready
  → published
  → in_progress
  → completed
```

Alternative paths:

```txt
published → rescheduled → published
published → cancelled
```

### 22.3 Invigilation Assignment Lifecycle

```txt
assigned
  → acknowledged
  → completed
```

Alternative paths:

```txt
assigned → declined → replaced
assigned/acknowledged → missed
```

---

## 23. Audit Trail Requirements

Audit these actions:

```txt
Exam session created/updated/cancelled/locked
Timetable entry created/updated/deleted/rescheduled
Invigilator assigned/removed/replaced
Conflict overridden
Timetable published/republished/rolled back
Assessment item created/linked/unlinked
Export generated
Exam marked completed
Incident reported/resolved
```

Audit record should include:

```txt
schoolId
actorId
action
targetType
targetId
before/after where appropriate
reason/change summary
createdAt
```

---

## 24. Safety and Data Integrity Rules

1. Never expose draft timetables to parents/students.
2. Never mutate published timetable without creating a new version.
3. Never allow cross-school data access.
4. Never hard-delete published exam entries.
5. Do not allow report-contributing exam marks without an assessment item.
6. Do not let locked exam sessions be edited casually.
7. Do not allow teacher assignment conflicts without explicit override.
8. Do not show invigilator names to parents/students unless enabled.
9. Always validate date/time range.
10. Always validate school membership of teachers, classes, subjects, venues.

---

## 25. AI-Agent Implementation Strategy

This section is critical. Agents must build this system safely without drifting or attempting huge tasks.

### 25.1 Anti-Drift Rules

Every implementation agent must:

1. Read this spec before starting.
2. Identify the current slice number.
3. Only implement the current slice.
4. Avoid modifying unrelated modules unless the slice explicitly says so.
5. Reuse existing EduSentrix UI components and colors.
6. Keep UI simple and uncluttered.
7. Avoid introducing new libraries unless necessary and approved.
8. Preserve existing assessment/report-card flows until integration slices.
9. Use feature flags or parallel routes where needed.
10. End each slice with a short checklist of changed files and test steps.

### 25.2 Required Agent Start Prompt

Use this prompt at the beginning of every slice:

```txt
You are working inside the EduSentrix Web codebase.
Read EXAM_SCHEDULING_INVIGILATION_ENGINE_SPEC.md.
Implement only Slice [NUMBER]: [TITLE].
Do not build future slices.
Do not redesign unrelated pages.
Use existing EduSentrix UI components, colors, auth helpers, MongoDB/Mongoose conventions, and route structure.
Keep UI simple, premium, and uncluttered.
At the end, summarize changed files, assumptions, and manual test steps.
```

### 25.3 Required Agent End Checklist

Every slice must end with:

```txt
Changed files:
- ...

What was implemented:
- ...

What was intentionally not implemented:
- ...

Manual test steps:
- ...

Risks / follow-up:
- ...
```

### 25.4 Slice Dependency Rule

Agents must not jump ahead.

Example:

- Do not build parent view before publish/versioning exists.
- Do not build smart scheduling before manual scheduling and conflict detection exist.
- Do not link assessment items before timetable entries exist.

---

## 26. Implementation Slices

The following slices describe the finished product, but broken into safe, manageable tasks.

---

### Slice 1: Domain Audit and Integration Map

Goal:

Map current project structures before coding.

Tasks:

- Locate current academic period models.
- Locate class group models.
- Locate subject and subject offering models.
- Locate teacher/staff models.
- Locate assessment/report-card models.
- Locate notification/calendar/export patterns.
- Locate current UI components for tables, cards, drawers, modals, badges.
- Produce a short `EXAM_ENGINE_INTEGRATION_NOTES.md`.

Acceptance Criteria:

- No functional code changes except notes file.
- Clear model integration points identified.
- Clear routes/components conventions identified.

---

### Slice 2: Core Models and Types

Goal:

Add foundational exam engine models.

Implement:

- `ExamSession`.
- `ExamTimetableEntry`.
- `ExamInvigilatorAssignment`.
- `ExamVenue`.
- Shared TypeScript types/enums.

Do not implement UI yet.

Acceptance Criteria:

- Models compile.
- Indexes added.
- No existing flows broken.
- Basic validation included.

---

### Slice 3: Exam Policy Model and Defaults

Goal:

Add school-level exam rules.

Implement:

- `ExamPolicy` model.
- Default policy creation helper.
- Policy fetch helper.
- Sensible defaults:
  - require venue: true
  - require invigilator: true
  - prevent overlaps: true
  - allow subject teacher invigilation: configurable

Acceptance Criteria:

- Default policy can be resolved for a school.
- No UI yet unless minimal admin setting stub is needed.

---

### Slice 4: Exam Session Server Actions/API

Goal:

Build backend capabilities for exam sessions.

Implement:

- Create session.
- List sessions.
- Read session.
- Update draft session.
- Cancel session.
- Basic authorization.

Acceptance Criteria:

- School-scoped.
- Role/permission guarded.
- Validates academic period and dates.
- Does not expose cross-school records.

---

### Slice 5: Venues Server Actions/API

Goal:

Build venue backend.

Implement:

- Create venue.
- List venues.
- Update venue.
- Deactivate venue.

Acceptance Criteria:

- School-scoped.
- Used venues cannot be hard-deleted.
- Active/inactive filtering works.

---

### Slice 6: Exam Sessions UI

Goal:

Create the school admin exam sessions page.

UI:

- Page header.
- Create session button.
- Status filters.
- Cards/table of sessions.
- Empty state.

Do not build timetable builder yet.

Acceptance Criteria:

- Uses current EduSentrix UI style.
- Simple, uncluttered.
- Responsive.
- Shows status badges and primary actions.

---

### Slice 7: Create Exam Session Wizard

Goal:

Add a simple wizard for creating exam sessions.

Steps:

1. Basic details.
2. Classes/grades.
3. Rules/visibility.
4. Review.

Acceptance Criteria:

- Not more than 5–7 fields per step.
- Uses current form components.
- Validates dates and required fields.
- Creates draft session.

---

### Slice 8: Venues UI

Goal:

Create simple venue management UI.

UI:

- Venue list.
- Create/edit drawer.
- Active/inactive badge.

Acceptance Criteria:

- Simple CRUD.
- No clutter.
- Consistent design.

---

### Slice 9: Timetable Entry Server Actions/API

Goal:

Build backend for timetable entries.

Implement:

- Create entry.
- List entries by session.
- Update entry.
- Delete draft entry.
- Bulk create draft entries.

Acceptance Criteria:

- Validates school/session/period.
- Validates date/time/duration.
- Does not publish yet.
- No assessment linking yet.

---

### Slice 10: Timetable Builder UI - Basic Table

Goal:

Create the main timetable builder page.

UI:

- Session header.
- Summary cards.
- Filters.
- Entries table.
- Add entry button.
- Entry drawer.

Acceptance Criteria:

- Table columns: Date, Time, Class, Subject, Venue, Invigilators, Assessment Link, Status.
- Drawer edits basic fields.
- No complex drag-and-drop.
- Responsive enough for admin use.

---

### Slice 11: Bulk Draft Entry Generation

Goal:

Allow admins to generate draft exam entries from classes and subjects.

Implement:

- Select class groups/grades.
- Select subjects.
- Default duration.
- Default max score/component placeholder.
- Generate unscheduled entries.

Acceptance Criteria:

- Prevent duplicates.
- Creates draft entries.
- Does not assign dates automatically yet.

---

### Slice 12: Invigilator Assignment Backend

Goal:

Build backend for assigning teachers.

Implement:

- Assign teacher.
- Remove teacher.
- Replace teacher.
- List assignments.
- Teacher acknowledgement endpoint.

Acceptance Criteria:

- School-scoped.
- Teacher must belong to school.
- Prevent duplicate assignment to same entry.

---

### Slice 13: Invigilator Assignment UI

Goal:

Add invigilator assignment interface.

UI:

- Teacher search.
- Availability badge placeholder.
- Assign as Lead/Assistant/Standby.
- Display assigned invigilators on entry rows.

Acceptance Criteria:

- Simple drawer/side panel.
- No clutter.
- Clear assignment status.

---

### Slice 14: Conflict Detection Engine - Core

Goal:

Implement conflict detection service.

Detect:

- Class overlap.
- Teacher overlap.
- Room overlap.
- Outside session range.
- Missing venue.
- Missing invigilator.
- Invalid duration.

Acceptance Criteria:

- Returns structured conflicts.
- Groups by severity.
- Does not mutate data.
- Unit/service tests if project supports tests.

---

### Slice 15: Conflict Review UI

Goal:

Create conflict review page/panel.

UI:

- Readiness score.
- Error/warning/info tabs.
- Conflict cards.
- Suggested actions.

Acceptance Criteria:

- Easy to understand.
- Each conflict has affected entries.
- No raw technical messages.

---

### Slice 16: Conflict Resolution Actions

Goal:

Let admins fix common conflicts from conflict UI.

Implement actions:

- Change time.
- Change venue.
- Replace invigilator.
- Add missing invigilator.
- Add missing venue.

Acceptance Criteria:

- Fixes update timetable entries.
- Conflict check can be rerun.
- UI stays simple.

---

### Slice 17: Conflict Override Workflow

Goal:

Support override for warnings/errors where policy allows.

Implement:

- Override reason.
- Override permission check.
- Persist conflict snapshot.
- Audit log.

Acceptance Criteria:

- Cannot override non-overridable conflicts.
- Reason required where policy says so.
- Override is visible in review.

---

### Slice 18: Assessment Item Linking Backend

Goal:

Connect exam timetable entries to assessment engine.

Implement:

- Create linked assessment item.
- Link existing assessment item.
- Validate assessment link.
- List missing links.

Acceptance Criteria:

- Same school/period/subject validation.
- Report-contributing exam requires assessment link before publish/report readiness.
- Does not break existing gradebook.

---

### Slice 19: Assessment Link UI

Goal:

Add UI for linking or creating assessment items.

UI:

- Assessment Link section in entry drawer.
- Button: Create linked assessment item.
- Button: Link existing.
- Badge: Linked / Missing / Not required.

Acceptance Criteria:

- Clear and minimal.
- Shows component and max score.
- Explains report-card contribution.

---

### Slice 20: Publishing Readiness Backend

Goal:

Build publish preview logic.

Implement:

- Readiness calculation.
- Blocking checks.
- Warning checks.
- Publish eligibility.

Acceptance Criteria:

- Returns clear summary.
- Blocks unresolved required conflicts.
- Includes assessment link readiness.

---

### Slice 21: Timetable Publishing and Versioning

Goal:

Publish timetable and snapshot versions.

Implement:

- Publish session timetable.
- Create `ExamTimetableVersion`.
- Mark entries published.
- Republish changes with version increment.
- Version history.

Acceptance Criteria:

- Published changes create new version.
- Draft not visible to parent/student.
- Version snapshot captures entries and invigilators.

---

### Slice 22: Publish UI and Version History

Goal:

Add publish controls and version history UI.

UI:

- Publish button.
- Publish confirmation modal.
- Change summary field.
- Version history drawer.
- Current version badge.

Acceptance Criteria:

- Clear warnings before publish.
- No accidental publish.
- Simple version list.

---

### Slice 23: Notifications Integration

Goal:

Send notifications for key events.

Implement:

- Timetable published.
- Timetable changed.
- Invigilator assigned/replaced.
- Acknowledgement required.

Acceptance Criteria:

- Uses existing notification system if available.
- Does not spam duplicate notifications.
- Respects visibility settings.

---

### Slice 24: Teacher My Exams Backend

Goal:

Build teacher-facing query endpoints.

Implement:

- My invigilation duties.
- My class/subject exam timetable.
- Exams requiring marks.
- Acknowledge duty.

Acceptance Criteria:

- Teacher only sees assigned/authorized data.
- Works for subject teacher and invigilator views.

---

### Slice 25: Teacher My Exams UI

Goal:

Build teacher-facing exam dashboard.

Tabs:

- My Timetable.
- Invigilation Duties.
- Marks Pending.

Acceptance Criteria:

- Clear cards.
- Acknowledge button.
- Mobile-friendly.
- No admin-only data exposed.

---

### Slice 26: Exam Day Operations

Goal:

Add operational actions.

Implement:

- Mark exam started.
- Mark exam completed.
- Report incident.
- Optional sitting status stub.

Acceptance Criteria:

- Permission guarded.
- Simple UI.
- Audit logged.

---

### Slice 27: Parent/Student Published Exam View

Goal:

Show published exam timetable to parents/students.

UI:

- Upcoming exams list.
- Date/time/subject/venue/instructions.
- Last updated version.

Acceptance Criteria:

- Only published data.
- Parent sees child-only data.
- Student sees own class data.
- No draft/conflict/admin info.

---

### Slice 28: Calendar Integration

Goal:

Push published exam entries to calendar views.

Implement:

- Class calendar events.
- Teacher invigilation events.
- Parent/student calendar visibility.

Acceptance Criteria:

- Does not duplicate events on republish.
- Updates changed events.
- Uses existing calendar patterns.

---

### Slice 29: Export System

Goal:

Add PDF/CSV exports.

Implement:

- Full timetable PDF.
- Class timetable PDF.
- Teacher invigilation PDF.
- Venue schedule PDF.
- CSV export.

Acceptance Criteria:

- Clean printable layout.
- Uses current branding.
- Handles published and admin draft export separately.

---

### Slice 30: Smart-Assisted Scheduler Backend

Goal:

Generate draft schedules algorithmically.

Implement:

- Rule-based scheduler.
- Input validation.
- Draft output.
- Unscheduled item reporting.
- Suggested invigilators.

Acceptance Criteria:

- Does not auto-publish.
- Produces explainable draft.
- Handles failure gracefully.

---

### Slice 31: Smart Scheduler UI

Goal:

Build assisted scheduling wizard.

Steps:

1. Select scope.
2. Scheduling preferences.
3. Generate draft.
4. Review warnings.
5. Apply draft.

Acceptance Criteria:

- Admin stays in control.
- Simple and clear.
- Draft can be discarded.

---

### Slice 32: Leo-Assisted Scheduling

Goal:

Add AI helper layer.

Leo can:

- Explain conflicts.
- Suggest schedule improvements.
- Draft parent message.
- Suggest invigilator replacements.

Acceptance Criteria:

- Leo suggestions are advisory only.
- Admin confirms changes.
- No direct publishing by AI.

---

### Slice 33: Analytics and Readiness Dashboard

Goal:

Add simple operational analytics.

Cards:

- Total papers.
- Published papers.
- Conflicts.
- Invigilation workload spread.
- Marks pending.

Acceptance Criteria:

- No clutter.
- Uses simple cards and lists.
- Drilldown links to existing pages.

---

### Slice 34: Final Hardening and Migration Notes

Goal:

Prepare feature for real school use.

Tasks:

- Add empty states.
- Add loading states.
- Add error states.
- Review permissions.
- Review cross-school safety.
- Review publish/version safety.
- Review report-card integration.
- Add migration notes.

Acceptance Criteria:

- Feature stable.
- Existing academic flows unaffected.
- Clear QA checklist created.

---

## 27. Testing Strategy

### 27.1 Unit/Service Tests

Test:

- Date/time overlap logic.
- Teacher conflict detection.
- Room conflict detection.
- Class conflict detection.
- Policy rule enforcement.
- Assessment link validation.
- Publish readiness.

### 27.2 Manual QA Scenarios

1. Create exam session for Basic 1–6.
2. Generate draft entries from subjects.
3. Assign rooms.
4. Assign invigilators.
5. Create a teacher conflict intentionally.
6. Confirm conflict appears.
7. Resolve conflict.
8. Link assessment items.
9. Publish timetable.
10. Confirm teacher sees duty.
11. Confirm parent sees published exam only.
12. Republish with change summary.
13. Confirm version history.
14. Confirm marks pending appears after exam.
15. Confirm report-card engine can use linked assessment item.

### 27.3 Data Safety Tests

- Teacher from another school cannot be assigned.
- Parent cannot see another child’s timetable.
- Draft timetable invisible to parents/students.
- Locked session cannot be edited.
- Published edits create new version.
- Deleted venue does not break old timetable.

---

## 28. Empty States

Use helpful empty states.

Examples:

### No Exam Sessions

```txt
No exam sessions yet.
Create an exam session to start building exam timetables and assigning invigilators.
```

### No Timetable Entries

```txt
No exam papers have been added yet.
You can add papers manually or generate draft papers from selected classes and subjects.
```

### No Conflicts

```txt
No conflicts found.
Your timetable is ready for review and publishing.
```

### Teacher Has No Duties

```txt
You have no invigilation duties assigned for this exam session.
```

---

## 29. Error Message Style

Use human-readable messages.

Bad:

```txt
ValidationError: duplicate teacher assignment
```

Good:

```txt
Mr. Mensah is already assigned to another exam at this time.
Choose a different invigilator or move one of the exams.
```

---

## 30. Finished Product Success Criteria

The Exam Scheduling & Invigilation Engine is complete when:

- A school can create an exam session.
- A school can build exam timetables manually or with smart assistance.
- A school can assign invigilators.
- The system detects class, teacher, and room conflicts.
- The system prevents unsafe publishing.
- Published timetables are versioned.
- Teachers can view and acknowledge duties.
- Parents/students can view only published exam schedules.
- Exam timetable entries can create/link assessment items.
- Subject teachers can record marks against linked exam items.
- Report-card compilation can depend on linked exam marks.
- Timetables can be exported to PDF/CSV.
- The UI stays clean, simple, and consistent with EduSentrix.
- AI agents can safely build the module slice by slice without drifting.

---

## 31. Final Architecture Summary

The finished system should operate like this:

```txt
School Admin / Exam Officer
    → Creates Exam Session
    → Builds Timetable
    → Assigns Venues
    → Assigns Invigilators
    → Runs Conflict Review
    → Links Assessment Items
    → Publishes Versioned Timetable

Teacher / Invigilator
    → Views Duties
    → Acknowledges Assignment
    → Supervises Exam
    → Reports Issues
    → Subject Teacher Records Marks

Parent / Student
    → Views Published Exam Timetable
    → Receives Updates

Assessment & Report Engine
    → Receives Linked Exam Assessment Items
    → Accepts Exam Scores
    → Computes Subject Results
    → Feeds Report Cards

Student Academic Profile
    → Displays Upcoming Exams
    → Shows Completed Exam Evidence
    → Explains Exam Performance Through Leo Insights
```

---

## 32. Final Notes for Implementation Agents

This module must feel operational, not decorative.

The goal is not to create a beautiful but shallow timetable page. The goal is to help real schools avoid exam chaos.

The engine must be:

- School-scoped.
- Permission-safe.
- Conflict-aware.
- Versioned.
- Linked to assessment/report cards.
- Easy to use.
- Simple on the surface.
- Powerful underneath.

Build slowly. Finish each slice. Do not drift.

