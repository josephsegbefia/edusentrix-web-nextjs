# EduSentrix Teacher Account & Teacher Studio PRD

**Version:** 1.1  
**Date:** 2026-01-28  
**Author:** [Product Team]  
**Status:** Draft / For Review  
**Last Updated:** 2026-01-28 (Added implementation details, API contracts, migration plan)

---

## 1. Goal / Problem

Provide teachers with a **complete digital operating system** to manage classes, students, assignments, grades, attendance, communication, and analytics, while aligning with Ghana school realities (low-friction, WhatsApp-first communication, intermittent internet). The system must support **role-based access control (RBAC)** with subroles and permissions, scalable across schools.

---

## 2. Users

| Role | Description |
|------|-------------|
| Subject Teacher | Default role; teaches assigned subjects, creates/marks assignments, manages grades. |
| Homeroom Teacher | Add-on role; manages daily homeroom activities, attendance, welfare, and parent communication. |
| Exam/Assessment Officer | Optional; oversees assessment workflows, gradebook moderation, exports. |
| Department Lead / Subject Lead | Optional; oversees subject across multiple classes/grades. |
| Class Coordinator | Optional; coordinates multiple classes or streams. |
| Club Patron | Optional; manages extracurricular groups and notices. |
| Admin | Manages users, roles, school settings. |

> Notes: Custom subroles and permissions to be added in Premium version.

---

## 3. Scope

**Included (MVP):**
- Teacher Dashboard (Today view, Smart Queues)
- Classes & Student roster + mini profiles
- Teacher Studio MVP:
  - Assignment creation → submission → marking → publish
  - Basic quiz/project support
- Gradebook:
  - School-defined assessment scheme
  - Spreadsheet-style mark entry
  - Export to CSV/PDF
- Homeroom Attendance (fast)
- Communication: Notices + Messages + Escalations
- Analytics MVP: completion + at-risk list
- Resource library + templates + class journal
- RBAC system with base roles + subrole templates (Subject Teacher, Homeroom Teacher, Exam Officer)

**Deferred / Premium / Future (to be implemented later):**
- Department Lead template activation
- Question bank + randomization + plagiarism signals
- AI-assisted report comment drafting
- Lesson planner with Units / Lessons layer
- Offline marking for Studio
- School-admin-defined custom roles & permissions
- Advanced analytics with recommendations
- Advanced parent notification rules

---

## 4. User Stories

### 4.1 Subject Teacher
- Create assignments, quizzes, and projects for assigned subjects
- View and mark student submissions
- Publish grades and feedback
- Send class/subject notices
- Take period attendance (optional)
- View student mini profiles

### 4.2 Homeroom Teacher
- Take fast daily attendance and track late arrivals
- Record student welfare notes
- Draft term comments
- Notify parents via WhatsApp/SMS/email (configurable)
- Access full student academic profiles for homeroom
- View "Students At Risk" queue

### 4.3 Exam/Assessment Officer
- View/lock gradebook scores
- Export marks
- Oversee assessment scheme compliance
- Moderate submissions (if approval workflow enabled)

### 4.4 Department Lead / Subject Lead (Premium)
- Moderate assessments across classes/grades for the subject
- Create shared rubrics and question banks
- Approve quizzes/exams before publishing
- Send subject-wide announcements
- View subject-level analytics

### 4.5 Admin
- Assign roles and subroles to teachers
- Manage school settings
- Audit role/permission changes
- Override locks and approve grades

---

## 5. Functional Requirements

### 5.1 Teacher Dashboard
- Today view: next class, next task, upcoming deadlines
- Smart queues: To Mark, Missing Marks, Attendance Follow-ups, Students At Risk
- Quick actions: create assignment, take attendance, record marks, post notice
- Offline caching (timetable, rosters, attendance templates)
- Alerts for late submissions, low attendance, missing marks, upcoming deadlines

### 5.2 Classes & Students
- Class group listing by subject and homeroom
- Student roster with mini profile (photo, guardian contacts, attendance/performance trend)
- Interventions notes (private to teacher/admin depending on role)
- Export roster

### 5.3 Teacher Studio
- Tabs: Assignments, Quizzes, Projects, Resources, Rubrics, Submissions
- Filters: class group, subject, term, status
- Assignment builder with:
  - Title, instructions, due date/time, late policy
  - Target: class group(s), subject, optional selected students
  - Type: Practice, Graded, Quiz, Project
  - Attachments (PDF, images, links, audio/video)
  - Optional rubric
- Submissions:
  - Text, file upload, link submission (future: photo scan)
  - Inbox with status (submitted, late, missing, returned)
  - Bulk actions: mark as reviewed, return for redo, extend deadline
  - Plagiarism signals (later)
- Marking & Feedback:
  - Inline comments, quick notes, rubric scoring
  - Reusable feedback snippets
  - Bulk grading by student/question
  - Draft & publish control
  - Lock after publishing with admin override
- Resource Library:
  - Save and tag lesson resources
  - Copy to assignment

> Future: Units/Lessons layer, assignment templates, question bank, offline marking

### 5.4 Gradebook
- Per class and subject
- Weighted categories
- Auto totals and term summary
- Export (CSV/PDF)
- Mark entry modes: spreadsheet-style, per student, per assessment
- Moderation + audit
- Report comment assistant (homeroom)

### 5.5 Attendance
- Homeroom daily attendance (fast, <30 sec)
- Period attendance (optional for subject teachers)
- Reasons and late codes
- Bulk "same as yesterday"
- Parent notification rules (WhatsApp-first, configurable)
- Attendance follow-ups

### 5.6 Communication
- Notices/Announcements: class, subject, schoolwide, scheduled, attachments
- Messages: teacher ↔ parent, small groups, history linked to student profile
- Escalations: structured reports to admin (discipline, academic, welfare) with status workflow

### 5.7 Analytics
- Completion rate per assignment
- Common wrong answers (quizzes)
- Class distribution chart
- "At-risk list" for students (low completion, low scores, poor attendance)
- Future: recommendations, topic mastery gaps


### 5.8 Lesson Notes & Class Journal
- Class Journal: period-wise lesson notes, homework, remarks
- Lesson Notes: per topic/week, attach resources, copy across terms

### 5.8.1 Access Decision Rule (RBAC + Settings + Scope)

All teacher capabilities must pass **three gates**:

1. **RBAC permission** (does the teacher have the atomic permission?)
2. **SchoolSettings feature flag** (is the feature enabled for the school?)
3. **Scope rule** (is the teacher allowed to act on this specific class/subject/student?)

> Final decision = `hasPermission(permissionKey)` ✅ AND `SchoolSettings[feature] === enabled` ✅ AND `scopeAllows(context)` ✅

Examples:
- A teacher may have `attendance.notify.guardian` but notifications are blocked if `SchoolSettings.attendanceNotifications.enabled = false`.
- A teacher may have `studio.assignment.publish` but cannot publish for a class/subject outside their assignment scope.

### 5.9 Offline Support Strategy

**Priority Data for Offline Caching:**
- Student rosters (name, photo, ID)
- Timetable and class schedules
- Attendance templates (pre-filled student lists)
- Draft assignments and marks
- Recent notices and messages

**Sync Approach:**
- Optimistic UI with background sync queue
- **Web (Next.js):** ship as a **PWA** with a Service Worker to cache static assets and selected API responses (required for true offline)
- **Mobile (RN / Expo):** local persistence + background sync queue (implementation later)
- IndexedDB for structured data (rosters, drafts, attendance)
- LocalStorage (5MB) for quick access items (current class, today's schedule)

**Conflict Resolution:**
- Last-write-wins for most data
- Admin override available for grade conflicts
- Attendance conflicts: alert teacher, require manual resolution
- Queue failed syncs for retry with exponential backoff

**Offline Indicators:**
- Clear visual indicator when offline
- "Pending sync" badge on unsaved items
- Auto-sync when connection restored
- Manual "Sync Now" button available

### 5.10 WhatsApp Integration

**Provider Options:**
- Primary: WhatsApp Business API via Twilio or 360dialog
- Fallback: SMS via Twilio/Hubtel (Ghana)
- Last resort: Email

**Message Templates (Pre-approved):**
```
1. ATTENDANCE_ABSENT
   "Dear {{parent_name}}, your child {{student_name}} was marked absent today ({{date}}). 
   Please contact the school if you have questions. - {{school_name}}"

2. ATTENDANCE_LATE
   "Dear {{parent_name}}, {{student_name}} arrived {{minutes}} minutes late today. 
   Please ensure timely arrival. - {{school_name}}"

3. GRADE_PUBLISHED
   "Dear {{parent_name}}, {{student_name}}'s {{subject}} grades have been published. 
   Please check the parent portal for details. - {{school_name}}"

4. NOTICE_GENERAL
   "{{school_name}} Notice: {{notice_title}}. {{notice_preview}}... 
   View full notice in the app."

5. FEE_REMINDER
   "Dear {{parent_name}}, a fee balance of {{currency}}{{amount}} is outstanding for {{student_name}}. 
   Please make payment at your earliest convenience. - {{school_name}}"
```

**Opt-in Flow:**
1. Guardian registers with phone number
2. System sends verification OTP via WhatsApp
3. Guardian confirms by replying "YES" or entering OTP
4. Preference stored in Guardian record
5. Option to opt-out via "STOP" reply or settings

**Rate Limits & Cost Management:**
- Max 3 messages per parent per day (excluding emergencies)
- Batch notifications where possible
- Priority queue for critical messages (attendance, emergencies)
- Monthly budget caps per school (configurable)

---

## 6. Non-functional Requirements
- Performance: fast loading rosters, instant marking
- Offline support: attendance + draft marks
- Audit logs: edits to marks, notices, roles
- Versioning: assignment edits after submissions
- Data integrity: prevent publishing grades without scheme or exceeding max score
- Security: role-based access control

---

## 7. RBAC / Permissions

### 7.0 Permission Key Convention

To avoid auth drift, all permission keys must follow:

- **Format:** `domain.resource.action` (3 segments) or `domain.resource.subresource.action` (4 segments)
- **Examples:**
  - `studio.assignment.create`
  - `attendance.homeroom.take`
  - `gradebook.term.publish`
  - `notice.class.create`

> The system may keep legacy aliases temporarily during migration, but **new code must use the standardized keys**.

### 7.1 Permission Catalog

| Category | Permission Key | Description |
|----------|---------------|-------------|
| **Scope** | `scope.class.assigned.read` | Access only assigned classes (and their assigned subjects) |
| | `scope.class.homeroom.read` | Access homeroom class fully |
| | `scope.marks.grade_wide.read` | Read marks across a grade (no guardian data) *(optional)* |
| | `scope.marks.school_wide.read` | Read marks across school (no guardian data) *(admin/system only)* |
| | `scope.subject.department.read` | Access all classes for assigned subject(s) *(premium / later)* |
| **Studio** | `studio.assignment.create` | Create assignments |
| | `studio.assignment.edit` | Edit own draft assignments |
| | `studio.assignment.publish` | Publish assignment to students |
| | `studio.assignment.close` | Close assignment for submissions |
| | `studio.assignment.delete` | Delete draft assignment |
| | `studio.quiz.create` | Create quizzes |
| | `studio.quiz.publish` | Publish quizzes |
| | `studio.resource.manage` | Manage resource library |
| | `studio.rubric.manage` | Create/manage rubrics |
| **Submissions** | `submission.read` | View student submissions |
| | `submission.grade` | Mark/grade submissions |
| | `submission.feedback.write` | Add feedback comments |
| | `submission.return` | Return for redo |
| | `submission.deadline.extend` | Extend deadline |
| | `submission.grade.publish` | Publish grades + feedback |
| | `submission.grade.edit_after_publish` | Edit after publish *(admin/HOD only; later)* |
| **Gradebook** | `gradebook.read` | View gradebook |
| | `gradebook.record` | Record marks |
| | `gradebook.edit` | Edit existing marks |
| | `gradebook.term.publish` | Publish term scores |
| | `gradebook.term.lock` | Lock term scores *(admin by default; configurable)* |
| | `gradebook.export` | Export to CSV/PDF |
| | `gradebook.scheme.read` | View assessment scheme/weights |
| | `gradebook.scheme.manage` | Manage assessment scheme/weights *(admin/HOD; later)* |
| **Attendance** | `attendance.homeroom.take` | Take homeroom daily attendance |
| | `attendance.period.take` | Take period attendance |
| | `attendance.edit` | Edit past attendance |
| | `attendance.reason.set` | Set reasons/late codes |
| | `attendance.notify.guardian` | Trigger parent notifications |
| **Communication** | `notice.class.create` | Create class notices |
| | `notice.subject.create` | Create subject-wide notices |
| | `notice.school.create` | Create school-wide notices *(admin/trusted; optional)* |
| | `notice.schedule` | Schedule notices |
| | `message.parent.send` | Message parents |
| | `message.student.send` | Message students |
| | `message.admin.send` | Message admin |
| | `broadcast.parents.send` | Broadcast to parents of a class/selection (not a group chat) |
| | `escalation.create` | Create escalations |
| | `escalation.resolve` | Resolve escalations *(admin)* |
| **Reports** | `report.read` | View reports |
| | `report.export` | Export reports |
| | `journal.write` | Write class journal |
| | `remarks.write` | Write student remarks |

### 7.2 Subrole Templates (MVP)

**1. Subject Teacher (Default)**
```json
{
  "name": "subject_teacher",
  "permissions": [
    "scope.class.assigned.read",
    "studio.assignment.create",
    "studio.assignment.edit",
    "studio.assignment.publish",
    "studio.assignment.close",
    "studio.quiz.create",
    "studio.quiz.publish",
    "studio.resource.manage",
    "studio.rubric.manage",
    "submission.read",
    "submission.grade",
    "submission.feedback.write",
    "submission.deadline.extend",
    "submission.grade.publish",
    "gradebook.read",
    "gradebook.record",
    "gradebook.edit",
    "gradebook.export",
    "attendance.period.take",
    "notice.class.create",
    "notice.subject.create",
    "message.parent.send",
    "message.admin.send",
    "escalation.create",
    "report.read",
    "journal.write"
  ]
}
```

**2. Homeroom Teacher (Add-on)**
```json
{
  "name": "homeroom_teacher",
  "permissions": [
    "scope.class.homeroom.read",
    "attendance.homeroom.take",
    "attendance.edit",
    "attendance.reason.set",
    "attendance.notify.guardian",
    "gradebook.read",
    "remarks.write",
    "message.parent.send",
    "broadcast.parents.send",
    "escalation.create",
    "report.read",
    "report.export"
  ]
}
```

**3. Exam/Assessment Officer (Optional)**
```json
{
  "name": "exam_officer",
  "permissions": [
    "scope.marks.grade_wide.read",
    "gradebook.read",
    "gradebook.edit",
    "gradebook.term.publish",
    "gradebook.export",
    "submission.read",
    "report.read",
    "report.export"
  ]
}
```

> **Security note:** Exam/Assessment Officer does **not** get `scope.marks.school_wide.read` by default. If a school requires school-wide visibility, Admin may explicitly grant it, and the UI must clearly warn that this still excludes guardian contact access.

### 7.3 Permission Check Implementation

```typescript
// lib/auth/can.ts

type PermissionKey = 
  | "studio.assignment.create"
  | "gradebook.record"
  | "attendance.take_homeroom"
  // ... all permission keys

interface PermissionContext {
  classGroupId?: string;
  subjectId?: string;
  studentId?: string;
  schoolId?: string;
}

interface TeacherWithPermissions {
  _id: string;
  userId: string;
  schoolId: string;
  subroles: string[];           // ["subject_teacher", "homeroom_teacher"]
  permissions: string[];         // Computed from subroles
  homeroomClassGroupId?: string;
  assignedClassGroupIds: string[];
  assignedSubjectIds: string[];
}

/**
 * Check if teacher has permission for a specific action
 * 
 * @example
 * if (await can(teacher, "attendance.take_homeroom", { classGroupId })) {
 *   // Allow attendance taking
 * }
 */
export async function can(
  teacher: TeacherWithPermissions,
  permission: PermissionKey,
  context?: PermissionContext
): Promise<boolean> {
  // 1. Check if teacher has the permission at all
  if (!teacher.permissions.includes(permission)) {
    return false;
  }

  // 2. Check scope-based access
  if (context?.classGroupId) {
    const hasClassAccess = await checkClassAccess(teacher, context.classGroupId);
    if (!hasClassAccess) return false;
  }

  if (context?.subjectId) {
    const hasSubjectAccess = teacher.assignedSubjectIds.includes(context.subjectId);
    if (!hasSubjectAccess) return false;
  }

  // 3. Special case: homeroom-only permissions
  if (permission.includes("homeroom")) {
    if (teacher.homeroomClassGroupId !== context?.classGroupId) {
      return false;
    }
  }

  return true;
}

async function checkClassAccess(
  teacher: TeacherWithPermissions,
  classGroupId: string
): Promise<boolean> {
  // School-wide scope
  if (teacher.permissions.includes("scope.school_wide")) {
    return true;
  }

  // Homeroom scope
  if (teacher.homeroomClassGroupId === classGroupId) {
    return true;
  }

  // Own classes scope
  if (teacher.assignedClassGroupIds.includes(classGroupId)) {
    return true;
  }

  return false;
}
```

### 7.4 Admin Customization
- MVP: assign templates
- Premium: duplicate and customize permissions
- Guardrails: immutable templates, audit logs, protected system permissions

---

## 8. Sidebar / Navigation (Teacher)

- Dashboard  
- Studio  
- Gradebook  
- Attendance  
- Classes & Students  
- Messages  
- Notices  
- Reports (exports, summaries)  
- Settings  

**Homeroom adds:** Homeroom Dashboard, Welfare & Remarks, Parent Log  
**Department Lead adds:** Subject Oversight, Question Bank, Moderation  

---

## 8.1 Feature Flags

Feature flags (per school) must gate functionality even when RBAC allows it:

- `SchoolSettings.teacherStudio.enabled`
- `SchoolSettings.teacherMessaging.enabled`
- `SchoolSettings.notices.enabled`
- `SchoolSettings.attendance.enabled`
- `SchoolSettings.attendanceNotifications.enabled`
- `SchoolSettings.offlineMode.enabled` *(PWA required for web)*
- `SchoolSettings.examOfficerRole.enabled`
- `SchoolSettings.departmentLeadRole.enabled` *(later)*
- `SchoolSettings.customRoles.enabled` *(premium / later)*

---

## 9. MVP Build Order (Phased)

### Phase 1: Foundation (Week 1-2)
| Task | Description | Dependencies |
|------|-------------|--------------|
| StudentAttendance model | Daily/period attendance schema | None |
| TeacherSubrole system | Add subroles to Teacher model | None |
| Permission helpers | `can()` function implementation | TeacherSubrole |
| Teacher dashboard shell | Basic layout with placeholder cards | None |
| API: Teacher context | `/api/teacher/me` - current teacher info | Permission helpers |

### Phase 2: Core MVP (Week 3-5)
| Task | Description | Dependencies |
|------|-------------|--------------|
| Homeroom attendance UI | Fast attendance (<30 sec target) | StudentAttendance model |
| Homework model | Assignments, quizzes, projects | None |
| Submission model | Student submissions | Homework model |
| Studio: Create assignment | Assignment builder UI | Homework model |
| Studio: View submissions | Submission inbox | Submission model |
| Studio: Mark & publish | Marking interface | Submission model |
| Gradebook UI | Spreadsheet-style entry | Existing Assessment model |

### Phase 3: Communication (Week 6-7)
| Task | Description | Dependencies |
|------|-------------|--------------|
| Notice model | Announcements schema | None |
| Message/Thread model | Parent messaging | None |
| Escalation model | Structured reports | None |
| Notices UI | Create/manage notices | Notice model |
| Messages UI | Teacher ↔ Parent chat | Message model |
| WhatsApp integration | Attendance notifications | Phase 2 complete |

### Phase 4: Analytics & Polish (Week 8)
| Task | Description | Dependencies |
|------|-------------|--------------|
| At-risk detection | Low completion/scores/attendance | Phase 2-3 data |
| Dashboard queues | To Mark, Missing Marks, At Risk | Analytics |
| Class journal | Lesson notes per period | None |
| Offline caching | Service worker, IndexedDB | All features |
| Export functionality | CSV/PDF for grades, rosters | Gradebook UI |

### Phase 5: Premium Features (Future)
- Question bank + randomization
- Plagiarism signals
- AI report comments
- Advanced analytics
- Custom roles/permissions

---

## 10. Database & Backend Notes

### 10.1 New Models Required

```typescript
// StudentAttendance - CRITICAL (doesn't exist)
interface IStudentAttendance {
  _id: ObjectId;
  schoolId: ObjectId;
  studentId: ObjectId;
  classGroupId: ObjectId;
  academicPeriodId: ObjectId;
  date: Date;                    // Normalized to school timezone day (Africa/Accra) and stored in UTC
  type: "homeroom" | "period";
  periodNumber?: number;         // If period attendance
  subjectId?: ObjectId;          // If period attendance
  status: "present" | "absent" | "late" | "excused";
  lateMinutes?: number;
  reason?: string;
  recordedBy: ObjectId;          // Teacher who recorded
  notifiedAt?: Date;             // When parent was notified
  createdAt: Date;
  updatedAt: Date;
}

// Homework (Assignments/Quizzes/Projects)
interface IHomework {
  _id: ObjectId;
  schoolId: ObjectId;
  teacherId: ObjectId;
  academicPeriodId: ObjectId;
  subjectId: ObjectId;
  classGroupIds: ObjectId[];     // Can target multiple classes
  targetStudentIds?: ObjectId[]; // Optional: specific students only
  targetMode: "class" | "selected_students";
  
  title: string;
  instructions: string;
  type: "assignment" | "quiz" | "project" | "practice";
  
  dueDate: Date;
  latePolicy: "accept" | "reject" | "penalize";
  latePenaltyPercent?: number;
  
  maxScore: number;
  rubricId?: ObjectId;
  
  attachments: Array<{
    name: string;
    url: string;
    type: "pdf" | "image" | "video" | "audio" | "link";
  }>;
  
  status: "draft" | "published" | "closed";
  publishedAt?: Date;
  closedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

// Submission
interface ISubmission {
  _id: ObjectId;
  homeworkId: ObjectId;
  studentId: ObjectId;
  schoolId: ObjectId;
  
  content?: string;              // Text response
  attachments: Array<{
    name: string;
    url: string;
    type: string;
  }>;
  
  status: "draft" | "submitted" | "late" | "returned" | "graded"; // "missing" is computed server-side from roster vs submissions
  submittedAt?: Date;
  
  // Grading
  score?: number;
  feedback?: string;
  rubricScores?: Record<string, number>;  // criterionId -> score
  gradedBy?: ObjectId;
  gradedAt?: Date;
  
  // Workflow
  returnedAt?: Date;
  returnReason?: string;
  resubmittedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

// Rubric
interface IRubric {
  _id: ObjectId;
  schoolId: ObjectId;
  teacherId: ObjectId;
  name: string;
  criteria: Array<{
    id: string;
    name: string;
    description: string;
    maxScore: number;
    levels: Array<{
      score: number;
      label: string;
      description: string;
    }>;
  }>;
  isTemplate: boolean;           // Can be copied by other teachers
  createdAt: Date;
  updatedAt: Date;
}

// Notice
interface INotice {
  _id: ObjectId;
  schoolId: ObjectId;
  authorId: ObjectId;            // Teacher or Admin
  
  title: string;
  content: string;
  
  scope: "class" | "subject" | "grade" | "school";
  targetClassGroupIds?: ObjectId[];
  targetSubjectId?: ObjectId;
  targetGradeId?: ObjectId;
  
  attachments: Array<{
    name: string;
    url: string;
    type: string;
  }>;
  
  priority: "normal" | "important" | "urgent";
  
  status: "draft" | "scheduled" | "published" | "archived";
  scheduledFor?: Date;
  publishedAt?: Date;
  expiresAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

// MessageThread
interface IMessageThread {
  _id: ObjectId;
  schoolId: ObjectId;
  studentId: ObjectId;           // Context student
  
  participants: Array<{
    userId: ObjectId;
    role: "teacher" | "parent" | "admin";
    joinedAt: Date;
    lastReadAt?: Date;
  }>;
  
  subject?: string;
  
  lastMessageAt: Date;
  messageCount: number;
  
  status: "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
}

// Message
interface IMessage {
  _id: ObjectId;
  threadId: ObjectId;
  senderId: ObjectId;
  
  content: string;
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
  }>;
  
  readBy: Array<{
    userId: ObjectId;
    readAt: Date;
  }>;
  
  createdAt: Date;
}

// Escalation
interface IEscalation {
  _id: ObjectId;
  schoolId: ObjectId;
  studentId: ObjectId;
  reportedBy: ObjectId;          // Teacher
  
  type: "discipline" | "academic" | "welfare" | "attendance" | "other";
  severity: "low" | "medium" | "high" | "critical";
  
  title: string;
  description: string;
  
  status: "open" | "in_progress" | "resolved" | "escalated";
  assignedTo?: ObjectId;         // Admin handling it
  
  resolution?: string;
  resolvedBy?: ObjectId;
  resolvedAt?: Date;
  
  attachments?: Array<{
    name: string;
    url: string;
  }>;
  
  timeline: Array<{
    action: string;
    by: ObjectId;
    at: Date;
    note?: string;
  }>;
  
  createdAt: Date;
  updatedAt: Date;
}

// JournalEntry (Class Journal)
interface IJournalEntry {
  _id: ObjectId;
  schoolId: ObjectId;
  teacherId: ObjectId;
  classGroupId: ObjectId;
  subjectId: ObjectId;
  academicPeriodId: ObjectId;
  
  date: Date;
  periodNumber?: number;
  
  topic: string;
  content: string;
  homework?: string;
  remarks?: string;
  
  attachments?: Array<{
    name: string;
    url: string;
  }>;
  
  createdAt: Date;
  updatedAt: Date;
}
```

### 10.2 Model Updates Required

```typescript
// Teacher model - add subroles
{
  // ... existing fields
  subroles: {
    type: [String],
    enum: ["subject_teacher", "homeroom_teacher", "exam_officer"],
    default: ["subject_teacher"]
  },
  // Computed permissions cached for performance
  permissionsCache?: string[];
  permissionsCacheUpdatedAt?: Date;
}
```

### 10.3 API Routes Structure

```
/api/teacher/
├── me/                          # Current teacher profile + permissions
├── dashboard/
│   ├── route.ts                 # Today view data
│   └── queues/
│       ├── to-mark/             # Pending submissions
│       ├── missing-marks/       # Incomplete gradebook entries
│       ├── attendance/          # Follow-ups needed
│       └── at-risk/             # Students at risk
├── studio/
│   ├── assignments/
│   │   ├── route.ts             # List/Create
│   │   └── [id]/
│   │       ├── route.ts         # Get/Update/Delete
│   │       ├── publish/         # Publish assignment
│   │       ├── close/           # Close for submissions
│   │       └── submissions/     # List submissions
│   ├── submissions/
│   │   └── [id]/
│   │       ├── route.ts         # Get submission
│   │       ├── grade/           # Mark submission
│   │       └── return/          # Return for redo
│   ├── rubrics/
│   │   ├── route.ts             # List/Create
│   │   └── [id]/                # Get/Update/Delete
│   └── resources/               # Resource library
├── gradebook/
│   ├── [classGroupId]/
│   │   ├── [subjectId]/
│   │   │   ├── route.ts         # Get gradebook
│   │   │   ├── record/          # Record marks
│   │   │   ├── publish/         # Publish grades
│   │   │   └── export/          # Export CSV/PDF
├── attendance/
│   ├── homeroom/
│   │   ├── route.ts             # Take homeroom attendance
│   │   └── [date]/              # Get/Update specific date
│   ├── period/
│   │   ├── route.ts             # Take period attendance
│   │   └── [date]/[periodNumber]/
│   └── history/
│       └── [studentId]/         # Student attendance history
├── classes/
│   ├── route.ts                 # List assigned classes
│   └── [classGroupId]/
│       ├── route.ts             # Class details
│       ├── students/            # Student roster
│       └── students/[studentId]/# Student mini profile
├── notices/
│   ├── route.ts                 # List/Create
│   └── [id]/                    # Get/Update/Delete/Publish
├── messages/
│   ├── threads/
│   │   ├── route.ts             # List/Create threads
│   │   └── [threadId]/
│   │       ├── route.ts         # Get thread
│   │       └── messages/        # List/Send messages
├── escalations/
│   ├── route.ts                 # List/Create
│   └── [id]/                    # Get/Update
├── journal/
│   ├── route.ts                 # List/Create entries
│   └── [id]/                    # Get/Update/Delete
└── analytics/
    ├── completion/              # Assignment completion rates
    ├── at-risk/                 # At-risk students
    └── class-performance/       # Class distribution
```

---

## 11. Mobile vs Web Feature Parity

| Feature | Mobile (PWA/Native) | Web | Notes |
|---------|---------------------|-----|-------|
| **Dashboard** | ✅ Full | ✅ Full | Same data, responsive layout |
| **Take Attendance** | ✅ Priority | ✅ Full | Optimized for mobile speed |
| **View Submissions** | ✅ Full | ✅ Full | |
| **Mark Submissions** | ✅ Basic | ✅ Full | Mobile: quick score only |
| **Create Assignments** | ⚠️ Simple | ✅ Full | Mobile: text only, no rubrics |
| **Gradebook Entry** | ✅ Single student | ✅ Spreadsheet | Mobile: one student at a time |
| **Notices** | ✅ Read/Create | ✅ Full | Mobile: no attachments |
| **Messages** | ✅ Full | ✅ Full | |
| **Reports/Export** | ❌ View only | ✅ Full | Export on web only |
| **Offline** | ✅ Attendance + Drafts | ✅ Attendance + Drafts | Same sync strategy |

**Mobile-First Optimizations:**
- Attendance UI designed for one-handed use
- Large tap targets (48px minimum)
- Swipe gestures for quick actions
- Pull-to-refresh for all lists
- Bottom sheet modals instead of full pages

---

## 12. Data Migration Plan

### 12.1 Existing Data Compatibility

| Existing Model | Action | Notes |
|----------------|--------|-------|
| Teacher | Update schema | Add `subroles` field |
| TeacherAssignment | Keep as-is | Used for class assignments |
| Assessment | Keep as-is | Works with new Homework model |
| SubjectGrade | Keep as-is | Gradebook aggregation |
| Guardian | Keep as-is | Add WhatsApp opt-in field |

### 12.2 Migration Scripts

```bash
# 1. Backfill teacher subroles
npm run script:backfill-teacher-subroles
# - Sets all existing teachers to ["subject_teacher"]
# - Teachers with homeroomClassGroupId get ["subject_teacher", "homeroom_teacher"]

# 2. Add WhatsApp fields to Guardian
npm run script:add-guardian-whatsapp-fields
# - Adds whatsappOptIn: null, whatsappVerifiedAt: null

# 3. Create default permission templates
npm run script:seed-permission-templates
# - Creates SubroleTemplate documents

# 4. Index optimization
npm run script:create-attendance-indexes
# - StudentAttendance indexes for fast queries
```

### 12.3 Rollback Plan

- All migrations are additive (no data deletion)
- New fields have sensible defaults
- Old API routes continue to work
- Feature flags control new UI access

---

## 13. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Attendance speed | <30 seconds for 40 students | Time from page load to submit |
| Assignment workflow | <5 mins per student (small class) | Create → submit → grade → publish |
| Teacher satisfaction | >95% find dashboard actionable | Survey after 1 month |
| Gradebook accuracy | 100% match school scheme | Automated validation |
| Parent notification reach | >90% delivery rate | WhatsApp/SMS delivery reports |
| Offline reliability | <1% data loss | Sync success rate |
| API response time | p95 < 500ms | Server metrics |

---

## 14. Security Considerations

- All teacher actions scoped to their school
- Permission checks on every API route
- Audit log for grade changes, attendance edits
- Rate limiting on message/notice creation
- Parent data only visible to assigned teachers
- GDPR-compliant data export/deletion
- **Audit events required (minimum):** `ROLE_ASSIGNED`, `ROLE_REVOKED`, `GRADE_SET`, `GRADE_PUBLISHED`, `GRADE_EDIT_AFTER_PUBLISH`, `ATTENDANCE_TAKEN`, `ATTENDANCE_EDITED`, `PARENT_NOTIFIED`, `NOTICE_PUBLISHED`, `MESSAGE_SENT`, `ESCALATION_CREATED`, `ESCALATION_RESOLVED`
- **Route-level scope validation:** every mutation endpoint (e.g., `/studio/.../grade`, `/attendance/...`, `/gradebook/...`) must validate teacher scope against the specific `classGroupId/subjectId/studentId` in the payload.

---

## 15. Open Questions

1. **Should period attendance be mandatory or optional per school?**
   - Current assumption: Optional, configurable in SchoolSettings

2. **How to handle co-teaching (multiple teachers for same subject/class)?**
   - Current assumption: Both teachers have full access

3. **Should we support teacher-to-many parent messaging?**
   - Current assumption: Yes, as **broadcast messages** (not a group chat). RBAC key: `broadcast.parents.send`.

4. **What's the retention policy for messages/notices?**
   - Suggestion: Archive after 1 year, delete after 3 years

5. **Should we support student self-submission or parent submission?**
   - Current assumption: Teacher records all for primary schools

---

**End of PRD**  

> _Version 1.1 - Updated with implementation details, API contracts, and migration plan._
