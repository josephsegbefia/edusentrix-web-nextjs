# EduSentrix Teacher Portal - Implementation Plan

**Version:** 1.0  
**Created:** 2026-01-29  
**Based on:** EduSentrix_Teacher_PRD.md v1.1  
**Status:** Planning

---

## Executive Summary

This plan outlines a **safe, incremental approach** to building the Teacher Portal features. The strategy prioritizes:

1. **No breaking changes** to existing admin, parent, or student functionality
2. **Additive development** - new models, routes, and pages alongside existing ones
3. **Feature flags** for gradual rollout
4. **Backward compatibility** with existing data structures

---

## Current State Assessment

### ✅ What We Can Leverage (No Changes Needed)

| Existing Asset | How We Use It |
|----------------|---------------|
| `Teacher` model | Add `subroles` field, keep everything else |
| `TeacherAssignment` model | Query for teacher's classes |
| `Assessment` model | Continue using for grade entries |
| `SubjectGrade` model | Continue using for aggregated grades |
| `GradingScale` model | Use for gradebook calculations |
| `Guardian` model | Use for parent messaging |
| `ClassGroup` model | Use for class listings |
| `Student` model | Use for rosters |
| `requireSchoolMember()` | Base auth, extend for teacher-specific |
| `useAuth()` hook | Client-side user context |

### 🆕 What We Need to Build

| Category | New Items |
|----------|-----------|
| **Models** | StudentAttendance, Homework, Submission, Rubric, Notice, MessageThread, Message, Escalation, JournalEntry |
| **Auth** | `requireTeacher()` helper, permission system |
| **API Routes** | `/api/teacher/*` namespace |
| **Pages** | `/teacher/*` pages |
| **Hooks** | Teacher-specific React Query hooks |
| **Components** | Teacher dashboard, studio, gradebook UI |

---

## Phased Development Plan

### Overview

```
Phase 0: Foundation (Week 1)
    ↓
Phase 1: Teacher Context & Dashboard Shell (Week 2)
    ↓
Phase 2: Student Attendance (Week 3)
    ↓
Phase 3: Teacher Studio MVP (Weeks 4-5)
    ↓
Phase 4: Gradebook Interface (Week 6)
    ↓
Phase 5: Communication (Week 7)
    ↓
Phase 6: Analytics & Polish (Week 8)
```

---

## Phase 0: Foundation

**Duration:** 1 week  
**Risk Level:** 🟢 Low (all additive)  
**Goal:** Create base infrastructure without touching existing code

### 0.1 New Models (Additive Only)

Create new model files - no changes to existing models yet.

```
src/models/
├── StudentAttendance.ts      # NEW
├── Homework.ts               # NEW  
├── Submission.ts             # NEW
├── Rubric.ts                 # NEW
├── Notice.ts                 # NEW
├── MessageThread.ts          # NEW
├── Message.ts                # NEW
├── Escalation.ts             # NEW
├── JournalEntry.ts           # NEW
└── TeacherPermission.ts      # NEW (permission templates)
```

**Model: StudentAttendance**
```typescript
// src/models/StudentAttendance.ts
interface IStudentAttendance {
  _id: ObjectId;
  schoolId: ObjectId;
  studentId: ObjectId;
  classGroupId: ObjectId;
  academicPeriodId: ObjectId;
  date: Date;
  type: "homeroom" | "period";
  periodNumber?: number;
  subjectId?: ObjectId;
  status: "present" | "absent" | "late" | "excused";
  lateMinutes?: number;
  reason?: string;
  notificationSent?: boolean;
  notificationSentAt?: Date;
  recordedBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Indexes:
// - { studentId: 1, date: 1, type: 1 } unique for homeroom
// - { studentId: 1, date: 1, periodNumber: 1 } unique for period
// - { schoolId: 1, classGroupId: 1, date: 1 } for class attendance view
// - { schoolId: 1, date: 1, status: 1 } for daily reports
```

**Model: Homework**
```typescript
// src/models/Homework.ts
interface IHomework {
  _id: ObjectId;
  schoolId: ObjectId;
  teacherId: ObjectId;
  academicPeriodId: ObjectId;
  subjectId: ObjectId;
  classGroupIds: ObjectId[];
  targetStudentIds?: ObjectId[];  // If targeting specific students
  
  title: string;
  instructions: string;
  type: "assignment" | "quiz" | "project" | "practice";
  
  dueDate: Date;
  latePolicy: "accept" | "reject" | "penalize";
  latePenaltyPercent?: number;
  
  maxScore: number;
  rubricId?: ObjectId;
  weight?: number;  // For gradebook weighting
  
  attachments: Array<{
    name: string;
    url: string;
    type: "pdf" | "image" | "video" | "audio" | "link";
    size?: number;
  }>;
  
  status: "draft" | "published" | "closed" | "archived";
  publishedAt?: Date;
  closedAt?: Date;
  
  // Stats (updated on submission changes)
  submissionCount?: number;
  gradedCount?: number;
  
  createdAt: Date;
  updatedAt: Date;
}
```

**Model: Submission**
```typescript
// src/models/Submission.ts
interface ISubmission {
  _id: ObjectId;
  homeworkId: ObjectId;
  studentId: ObjectId;
  schoolId: ObjectId;
  
  content?: string;
  attachments: Array<{
    name: string;
    url: string;
    type: string;
    size?: number;
  }>;
  
  status: "not_started" | "draft" | "submitted" | "late" | "returned" | "graded";
  submittedAt?: Date;
  isLate?: boolean;
  
  // Grading
  score?: number;
  feedback?: string;
  rubricScores?: Record<string, number>;
  gradedBy?: ObjectId;
  gradedAt?: Date;
  publishedAt?: Date;  // When grade was published to student
  
  // Workflow
  returnedAt?: Date;
  returnReason?: string;
  attempts: number;
  
  createdAt: Date;
  updatedAt: Date;
}
```

### 0.2 Permission System

Create permission infrastructure alongside existing roles.

```
src/lib/auth/
├── requireTeacher.ts         # NEW - teacher-specific auth
├── permissions.ts            # NEW - permission definitions
├── can.ts                    # NEW - permission check helper
└── requireSchoolMember.ts    # EXISTING - no changes
```

**requireTeacher.ts**
```typescript
// src/lib/auth/requireTeacher.ts
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { Teacher } from "@/models/Teacher";
import { UserMembership } from "@/models/UserMembership";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

export interface TeacherContext {
  userId: Types.ObjectId;
  teacherId: Types.ObjectId;
  schoolId: Types.ObjectId;
  roles: string[];
  subroles: string[];
  homeroomClassGroupId?: Types.ObjectId;
  isAdmin: boolean;
}

export async function requireTeacher(): Promise<TeacherContext> {
  const { userId: clerkUserId } = await auth();
  
  if (!clerkUserId) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  // Find user
  const user = await User.findOne({ clerkUserId }).lean();
  if (!user || !user.schoolId) {
    throw NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  // Find teacher record
  const teacher = await Teacher.findOne({
    userId: user._id,
    schoolId: user.schoolId,
    status: "active",
  }).lean();

  if (!teacher) {
    throw NextResponse.json(
      { error: "Teacher profile not found" },
      { status: 403 }
    );
  }

  // Get membership for roles
  const membership = await UserMembership.findOne({
    userId: user._id,
    schoolId: user.schoolId,
  }).lean();

  const roles = membership?.roles || [];
  const isAdmin = roles.includes("school_admin");

  return {
    userId: user._id as Types.ObjectId,
    teacherId: teacher._id as Types.ObjectId,
    schoolId: user.schoolId as Types.ObjectId,
    roles,
    subroles: teacher.subroles || ["subject_teacher"],
    homeroomClassGroupId: teacher.homeroomClassGroupId,
    isAdmin,
  };
}
```

### 0.3 Update Teacher Model (Minimal, Backward Compatible)

Only add `subroles` field - existing data keeps working.

```typescript
// In src/models/Teacher.ts - ADD these fields, don't remove anything

// Add to schema:
subroles: {
  type: [String],
  enum: ["subject_teacher", "homeroom_teacher", "exam_officer", "department_lead"],
  default: ["subject_teacher"],  // Backward compatible default
},
permissionsCache: {
  type: [String],
  default: undefined,
},
permissionsCacheUpdatedAt: {
  type: Date,
  default: undefined,
},
```

### 0.4 Database Indexes

Create a migration script for new indexes:

```typescript
// scripts/create-teacher-portal-indexes.ts
import { connectToDatabase } from "@/db/connectToDatabase";

async function createIndexes() {
  await connectToDatabase();
  
  // StudentAttendance indexes
  const StudentAttendance = mongoose.model("StudentAttendance");
  await StudentAttendance.collection.createIndex(
    { studentId: 1, date: 1, type: 1 },
    { unique: true, partialFilterExpression: { type: "homeroom" } }
  );
  await StudentAttendance.collection.createIndex(
    { schoolId: 1, classGroupId: 1, date: 1 }
  );
  
  // Homework indexes
  const Homework = mongoose.model("Homework");
  await Homework.collection.createIndex(
    { schoolId: 1, teacherId: 1, status: 1, createdAt: -1 }
  );
  await Homework.collection.createIndex(
    { schoolId: 1, classGroupIds: 1, status: 1, dueDate: 1 }
  );
  
  // Submission indexes
  const Submission = mongoose.model("Submission");
  await Submission.collection.createIndex(
    { homeworkId: 1, studentId: 1 },
    { unique: true }
  );
  await Submission.collection.createIndex(
    { homeworkId: 1, status: 1 }
  );
  
  console.log("Indexes created successfully");
}
```

### Phase 0 Deliverables

- [ ] `StudentAttendance` model with indexes
- [ ] `Homework` model with indexes
- [ ] `Submission` model with indexes
- [ ] `Rubric` model
- [ ] `Notice` model
- [ ] `MessageThread` and `Message` models
- [ ] `Escalation` model
- [ ] `JournalEntry` model
- [ ] `requireTeacher()` auth helper
- [ ] `can()` permission helper
- [ ] Teacher model updated with `subroles` field
- [ ] Index creation script

---

## Phase 1: Teacher Context & Dashboard Shell

**Duration:** 1 week  
**Risk Level:** 🟢 Low (new routes and pages only)  
**Goal:** Establish teacher portal foundation

### 1.1 API Routes - Teacher Context

```
src/app/api/teacher/
├── me/
│   └── route.ts              # GET - teacher profile + context
├── classes/
│   └── route.ts              # GET - assigned classes
├── students/
│   └── [classGroupId]/
│       └── route.ts          # GET - class roster
└── dashboard/
    └── route.ts              # GET - dashboard data
```

**GET /api/teacher/me**
```typescript
// Returns teacher's full context for the portal
{
  teacher: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    photoUrl?: string;
    subroles: string[];
    homeroomClassGroupId?: string;
    homeroomClassName?: string;
  };
  school: {
    _id: string;
    name: string;
    logoUrl?: string;
  };
  currentPeriod: {
    _id: string;
    name: string;
    termNumber: number;
  };
  stats: {
    totalClasses: number;
    totalStudents: number;
    pendingToMark: number;
    todayAttendanceTaken: boolean;
  };
  permissions: string[];
}
```

**GET /api/teacher/classes**
```typescript
// Returns teacher's assigned classes for current period
{
  classes: Array<{
    _id: string;
    name: string;              // "JHS 2A"
    gradeName: string;         // "JHS 2"
    subjectName: string;       // "Mathematics"
    subjectId: string;
    studentCount: number;
    schedule?: {
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    }[];
    isHomeroom: boolean;
  }>;
}
```

### 1.2 Teacher Dashboard Page

```
src/app/(app)/teacher/
├── layout.tsx                # Teacher-specific layout with sidebar
├── page.tsx                  # Dashboard (Today view)
└── loading.tsx               # Loading state
```

**Teacher Layout with Sidebar**
```typescript
// src/app/(app)/teacher/layout.tsx
import { TeacherSidebar } from "@/components/teacher/TeacherSidebar";
import { requireTeacher } from "@/lib/auth/requireTeacher";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth check
  const context = await requireTeacher();
  
  return (
    <div className="flex h-screen">
      <TeacherSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
```

**Dashboard Page Structure**
```typescript
// src/app/(app)/teacher/page.tsx
// Dashboard with:
// - Today's schedule
// - Quick stats (classes, students, pending)
// - Smart queues (To Mark, Attendance, At Risk)
// - Quick actions (Take Attendance, Create Assignment)
```

### 1.3 React Query Hooks

```
src/hooks/teacher/
├── useTeacherContext.ts      # Teacher profile + permissions
├── useTeacherClasses.ts      # Assigned classes
├── useTeacherDashboard.ts    # Dashboard data
└── useClassRoster.ts         # Students in a class
```

### 1.4 Teacher Components

```
src/components/teacher/
├── TeacherSidebar.tsx        # Navigation sidebar
├── TeacherHeader.tsx         # Page header with school/term
├── DashboardStats.tsx        # Quick stats cards
├── TodaySchedule.tsx         # Today's classes timeline
├── SmartQueue.tsx            # Reusable queue component
└── QuickActions.tsx          # Action buttons
```

### Phase 1 Deliverables

- [ ] `/api/teacher/me` route
- [ ] `/api/teacher/classes` route
- [ ] `/api/teacher/dashboard` route
- [ ] Teacher layout with sidebar
- [ ] Dashboard page with stats
- [ ] `useTeacherContext` hook
- [ ] `useTeacherClasses` hook
- [ ] Teacher sidebar component
- [ ] Today's schedule component
- [ ] Quick stats component

---

## Phase 2: Student Attendance

**Duration:** 1 week  
**Risk Level:** 🟢 Low (new functionality)  
**Goal:** Fast homeroom attendance (<30 seconds)

### 2.1 Attendance API Routes

```
src/app/api/teacher/attendance/
├── homeroom/
│   ├── route.ts              # POST - take homeroom attendance
│   └── [date]/
│       └── route.ts          # GET/PATCH - specific date
├── period/
│   └── route.ts              # POST - take period attendance
├── history/
│   └── [studentId]/
│       └── route.ts          # GET - student attendance history
└── stats/
    └── route.ts              # GET - attendance statistics
```

**POST /api/teacher/attendance/homeroom**
```typescript
// Request
{
  classGroupId: string;
  date: string;  // ISO date
  records: Array<{
    studentId: string;
    status: "present" | "absent" | "late" | "excused";
    lateMinutes?: number;
    reason?: string;
  }>;
}

// Response
{
  success: true;
  data: {
    recorded: number;
    absentCount: number;
    lateCount: number;
    notificationsSent: number;
  };
}
```

### 2.2 Attendance UI

```
src/app/(app)/teacher/attendance/
├── page.tsx                  # Attendance dashboard
├── homeroom/
│   └── page.tsx              # Homeroom attendance taking
└── history/
    └── page.tsx              # View attendance history
```

**Fast Attendance UI Features:**
- Pre-loaded student list (offline capable)
- Default all "present" (tap to change)
- Swipe gestures for quick marking
- Bulk "same as yesterday" option
- Real-time submit (<30 sec goal)
- Confirmation with absent count

### 2.3 Attendance Components

```
src/components/teacher/attendance/
├── AttendanceGrid.tsx        # Main grid for marking
├── StudentAttendanceRow.tsx  # Individual student row
├── AttendanceStatusPicker.tsx # Status selection
├── BulkActions.tsx           # Same as yesterday, mark all
├── AttendanceSummary.tsx     # Summary after submission
└── AttendanceHistory.tsx     # History view
```

### 2.4 Parent Notifications (Stub)

Create notification infrastructure but don't integrate with WhatsApp yet.

```typescript
// src/lib/notifications/attendance.ts
export async function queueAttendanceNotification(
  studentId: string,
  status: "absent" | "late",
  date: Date
) {
  // Phase 5 will implement actual sending
  // For now, just log and update record
  console.log(`[NOTIFICATION STUB] ${status} notification for ${studentId}`);
  
  await StudentAttendance.updateOne(
    { studentId, date },
    { $set: { notificationQueued: true, notificationQueuedAt: new Date() } }
  );
}
```

### Phase 2 Deliverables

- [ ] `StudentAttendance` model integrated
- [ ] Homeroom attendance API
- [ ] Period attendance API
- [ ] Attendance history API
- [ ] Fast attendance UI
- [ ] Swipe/tap gesture support
- [ ] "Same as yesterday" feature
- [ ] Attendance summary view
- [ ] Notification queue stub

---

## Phase 3: Teacher Studio MVP

**Duration:** 2 weeks  
**Risk Level:** 🟡 Medium (core feature)  
**Goal:** Assignment → Submission → Marking → Publish workflow

### 3.1 Week 1: Assignments & Submissions

**API Routes**
```
src/app/api/teacher/studio/
├── assignments/
│   ├── route.ts              # GET list, POST create
│   └── [id]/
│       ├── route.ts          # GET, PATCH, DELETE
│       ├── publish/
│       │   └── route.ts      # POST - publish assignment
│       ├── close/
│       │   └── route.ts      # POST - close for submissions
│       └── submissions/
│           └── route.ts      # GET - list submissions
├── submissions/
│   └── [id]/
│       ├── route.ts          # GET submission detail
│       ├── grade/
│       │   └── route.ts      # POST - grade submission
│       └── return/
│           └── route.ts      # POST - return for redo
└── rubrics/
    ├── route.ts              # GET list, POST create
    └── [id]/
        └── route.ts          # GET, PATCH, DELETE
```

**Pages**
```
src/app/(app)/teacher/studio/
├── page.tsx                  # Studio dashboard (tabs)
├── assignments/
│   ├── page.tsx              # Assignment list
│   ├── new/
│   │   └── page.tsx          # Create assignment
│   └── [id]/
│       ├── page.tsx          # Assignment detail
│       └── submissions/
│           └── page.tsx      # View submissions
└── rubrics/
    └── page.tsx              # Manage rubrics
```

### 3.2 Week 2: Marking & Feedback

**Marking Interface Features:**
- Inline score entry
- Feedback text area
- Rubric scoring (if rubric attached)
- Quick feedback snippets
- Draft save (auto-save)
- Publish grades button
- Bulk grading view

**Components**
```
src/components/teacher/studio/
├── AssignmentBuilder.tsx     # Create/edit form
├── AssignmentCard.tsx        # List item
├── AssignmentFilters.tsx     # Filter by class, subject, status
├── SubmissionInbox.tsx       # Submissions list
├── SubmissionViewer.tsx      # View submission content
├── MarkingPanel.tsx          # Grade + feedback entry
├── RubricScorer.tsx          # Rubric-based grading
├── FeedbackSnippets.tsx      # Reusable feedback
├── BulkGrading.tsx           # Grade multiple at once
└── PublishGradesModal.tsx    # Confirm publish
```

### 3.3 Student-Side Submission (Minimal)

For MVP, create a simple submission endpoint that can be used later:

```
src/app/api/student/assignments/
├── route.ts                  # GET - my assignments
└── [id]/
    ├── route.ts              # GET - assignment detail
    └── submit/
        └── route.ts          # POST - submit work
```

### Phase 3 Deliverables

**Week 1:**
- [ ] `Homework` model integrated
- [ ] `Submission` model integrated
- [ ] `Rubric` model integrated
- [ ] Assignment CRUD APIs
- [ ] Assignment builder UI
- [ ] Assignment list with filters
- [ ] Publish/close workflow

**Week 2:**
- [ ] Submission viewing API
- [ ] Grading API
- [ ] Return for redo API
- [ ] Marking interface
- [ ] Rubric scoring UI
- [ ] Feedback snippets
- [ ] Bulk grading
- [ ] Grade publishing

---

## Phase 4: Gradebook Interface

**Duration:** 1 week  
**Risk Level:** 🟡 Medium (integrates with existing Assessment model)  
**Goal:** Spreadsheet-style mark entry

### 4.1 Gradebook API

```
src/app/api/teacher/gradebook/
├── [classGroupId]/
│   └── [subjectId]/
│       ├── route.ts          # GET - gradebook data
│       ├── record/
│       │   └── route.ts      # POST - record marks
│       ├── publish/
│       │   └── route.ts      # POST - publish grades
│       └── export/
│           └── route.ts      # GET - export CSV/PDF
└── assessments/
    └── route.ts              # GET - assessment types/weights
```

**GET /api/teacher/gradebook/[classGroupId]/[subjectId]**
```typescript
// Returns spreadsheet-ready data
{
  classGroup: { _id, name };
  subject: { _id, name };
  assessmentScheme: {
    categories: Array<{
      name: string;      // "CA", "Exam"
      weight: number;    // 0.3, 0.7
      assessments: Array<{
        _id: string;
        title: string;
        maxScore: number;
        type: string;
      }>;
    }>;
  };
  students: Array<{
    _id: string;
    name: string;
    scores: Record<assessmentId, {
      score: number | null;
      status: "draft" | "published";
    }>;
    totals: {
      caTotal: number;
      examTotal: number;
      finalScore: number;
      grade: string;
    };
  }>;
}
```

### 4.2 Gradebook UI

```
src/app/(app)/teacher/gradebook/
├── page.tsx                  # Class/subject selector
└── [classGroupId]/
    └── [subjectId]/
        └── page.tsx          # Spreadsheet view
```

**Features:**
- Spreadsheet-style grid (similar to Excel)
- Inline editing with tab navigation
- Auto-save on blur
- Column totals and averages
- Grade calculation preview
- Draft vs published indicator
- Publish all button
- Export to CSV/PDF

### 4.3 Gradebook Components

```
src/components/teacher/gradebook/
├── GradebookSelector.tsx     # Class/subject picker
├── GradebookGrid.tsx         # Main spreadsheet
├── GradebookCell.tsx         # Editable cell
├── GradebookHeader.tsx       # Column headers
├── GradebookTotals.tsx       # Row totals
├── GradePreview.tsx          # Grade letter preview
├── PublishModal.tsx          # Publish confirmation
└── ExportButton.tsx          # Export options
```

### 4.4 Integration with Existing Models

The gradebook will **read from and write to existing models**:
- `Assessment` - individual score entries
- `SubjectGrade` - aggregated grades
- `GradingScale` - grade calculations

No changes to these models needed.

### Phase 4 Deliverables

- [ ] Gradebook data API
- [ ] Mark recording API
- [ ] Grade publishing API
- [ ] Export API (CSV/PDF)
- [ ] Spreadsheet grid component
- [ ] Inline editing
- [ ] Auto-save
- [ ] Grade calculations
- [ ] Export functionality

---

## Phase 5: Communication

**Duration:** 1 week  
**Risk Level:** 🟡 Medium (new system)  
**Goal:** Notices, Messages, Escalations

### 5.1 Notices API

```
src/app/api/teacher/notices/
├── route.ts                  # GET list, POST create
└── [id]/
    ├── route.ts              # GET, PATCH, DELETE
    └── publish/
        └── route.ts          # POST - publish notice
```

### 5.2 Messages API

```
src/app/api/teacher/messages/
├── threads/
│   ├── route.ts              # GET list, POST create thread
│   └── [threadId]/
│       ├── route.ts          # GET thread detail
│       └── messages/
│           └── route.ts      # GET messages, POST send
└── unread/
    └── route.ts              # GET unread count
```

### 5.3 Escalations API

```
src/app/api/teacher/escalations/
├── route.ts                  # GET list, POST create
└── [id]/
    └── route.ts              # GET detail, PATCH update
```

### 5.4 Communication Pages

```
src/app/(app)/teacher/
├── notices/
│   ├── page.tsx              # Notice list
│   └── new/
│       └── page.tsx          # Create notice
├── messages/
│   ├── page.tsx              # Message threads
│   └── [threadId]/
│       └── page.tsx          # Conversation view
└── escalations/
    └── page.tsx              # Escalation list
```

### 5.5 WhatsApp Integration

Now connect the notification stub from Phase 2:

```typescript
// src/lib/notifications/whatsapp.ts
export async function sendWhatsAppMessage(
  phone: string,
  templateId: string,
  params: Record<string, string>
) {
  // Integration with Twilio/360dialog
  // Uses pre-approved templates
}

// src/lib/notifications/attendance.ts
export async function sendAttendanceNotification(
  studentId: string,
  status: "absent" | "late",
  date: Date
) {
  const guardian = await Guardian.findOne({
    studentId,
    isPrimary: true,
    whatsappOptIn: true,
  });
  
  if (!guardian?.phone) return;
  
  await sendWhatsAppMessage(guardian.phone, "ATTENDANCE_" + status.toUpperCase(), {
    parent_name: guardian.name,
    student_name: student.firstName,
    date: formatDate(date),
    school_name: school.name,
  });
}
```

### Phase 5 Deliverables

- [ ] Notice CRUD APIs
- [ ] Notice UI
- [ ] Message thread APIs
- [ ] Message UI
- [ ] Escalation APIs
- [ ] Escalation UI
- [ ] WhatsApp integration
- [ ] SMS fallback
- [ ] Notification queue processing

---

## Phase 6: Analytics & Polish

**Duration:** 1 week  
**Risk Level:** 🟢 Low (read-only features)  
**Goal:** Dashboard queues, at-risk detection, polish

### 6.1 Analytics API

```
src/app/api/teacher/analytics/
├── completion/
│   └── route.ts              # Assignment completion rates
├── at-risk/
│   └── route.ts              # At-risk students
├── attendance/
│   └── route.ts              # Attendance statistics
└── class-performance/
    └── route.ts              # Performance distribution
```

### 6.2 Dashboard Queues

Enhance the dashboard with real queues:

**To Mark Queue**
```typescript
// Students with ungraded submissions
const toMark = await Submission.find({
  schoolId,
  status: "submitted",
  gradedAt: null,
}).populate("studentId homeworkId");
```

**Missing Marks Queue**
```typescript
// Students without grades for published assignments
const missingMarks = await findStudentsWithoutSubmissions(teacherId);
```

**At Risk Queue**
```typescript
// Students with low attendance + low scores
const atRisk = await detectAtRiskStudents(teacherId, {
  attendanceThreshold: 0.75,
  scoreThreshold: 50,
  submissionThreshold: 0.6,
});
```

### 6.3 Class Journal

```
src/app/(app)/teacher/journal/
├── page.tsx                  # Journal list
└── [classGroupId]/
    └── page.tsx              # Class journal entries
```

### 6.4 Polish & Optimization

- [ ] Offline caching with Service Worker
- [ ] Optimistic UI updates
- [ ] Error boundaries
- [ ] Loading skeletons
- [ ] Empty states
- [ ] Mobile responsiveness
- [ ] Keyboard navigation
- [ ] Accessibility audit

### Phase 6 Deliverables

- [ ] Analytics APIs
- [ ] At-risk detection algorithm
- [ ] Dashboard queues populated
- [ ] Class journal UI
- [ ] Offline support
- [ ] Performance optimization
- [ ] Mobile polish

---

## Migration & Rollout Strategy

### Feature Flags

Use feature flags for gradual rollout:

```typescript
// src/lib/features.ts
export const FEATURES = {
  TEACHER_PORTAL: process.env.NEXT_PUBLIC_FEATURE_TEACHER_PORTAL === "true",
  TEACHER_STUDIO: process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO === "true",
  TEACHER_GRADEBOOK: process.env.NEXT_PUBLIC_FEATURE_TEACHER_GRADEBOOK === "true",
  TEACHER_MESSAGING: process.env.NEXT_PUBLIC_FEATURE_TEACHER_MESSAGING === "true",
};
```

### Data Backfill Scripts

```bash
# Run after Phase 0
npm run script:backfill-teacher-subroles
# Sets all teachers to ["subject_teacher"]
# Teachers with homeroomClassGroupId get ["subject_teacher", "homeroom_teacher"]

# Run after Phase 1
npm run script:create-teacher-portal-indexes

# Optional: seed demo data for testing
npm run script:seed-teacher-demo-data
```

### Rollout Phases

1. **Internal Testing** (Week 1-2 of each phase)
   - Deploy to staging
   - Team testing
   - Fix bugs

2. **Pilot Schools** (Select 2-3 schools)
   - Enable feature flag
   - Gather feedback
   - Iterate

3. **General Availability**
   - Enable for all schools
   - Monitor performance
   - Support documentation

---

## Testing Strategy

### Unit Tests

```
__tests__/
├── lib/
│   ├── auth/
│   │   ├── requireTeacher.test.ts
│   │   └── can.test.ts
│   └── notifications/
│       └── attendance.test.ts
├── models/
│   ├── StudentAttendance.test.ts
│   ├── Homework.test.ts
│   └── Submission.test.ts
└── api/
    └── teacher/
        ├── attendance.test.ts
        ├── studio.test.ts
        └── gradebook.test.ts
```

### Integration Tests

- API route testing with MSW
- Database operations with test DB
- Auth flow testing

### E2E Tests

```
e2e/
├── teacher/
│   ├── attendance.spec.ts     # Take attendance flow
│   ├── assignment.spec.ts     # Create → grade flow
│   └── gradebook.spec.ts      # Mark entry flow
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing admin features | All new code in `/api/teacher/*` namespace |
| Data corruption | New models only, existing models read-only or additive fields |
| Performance regression | Separate indexes, query optimization |
| Auth issues | New `requireTeacher()` doesn't modify existing auth |
| Mobile app compatibility | All APIs support Bearer token auth |
| Rollback needed | Feature flags allow instant disable |

---

## Success Criteria

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Attendance speed | < 30 seconds for 40 students | Time from page load to submit |
| Assignment creation | < 3 minutes | Time to create and publish |
| Grading speed | < 30 seconds per student | Average grading time |
| Page load time | < 2 seconds | Lighthouse metrics |
| API response time | p95 < 500ms | Server monitoring |
| Teacher adoption | > 80% active weekly | Usage analytics |

---

## Appendix: File Structure

```
src/
├── app/
│   ├── (app)/
│   │   └── teacher/                    # NEW - Teacher portal pages
│   │       ├── layout.tsx
│   │       ├── page.tsx                # Dashboard
│   │       ├── studio/
│   │       ├── gradebook/
│   │       ├── attendance/
│   │       ├── classes/
│   │       ├── notices/
│   │       ├── messages/
│   │       └── journal/
│   └── api/
│       └── teacher/                    # NEW - Teacher API routes
│           ├── me/
│           ├── dashboard/
│           ├── classes/
│           ├── studio/
│           ├── gradebook/
│           ├── attendance/
│           ├── notices/
│           ├── messages/
│           ├── escalations/
│           └── analytics/
├── components/
│   └── teacher/                        # NEW - Teacher components
│       ├── TeacherSidebar.tsx
│       ├── TeacherHeader.tsx
│       ├── attendance/
│       ├── studio/
│       ├── gradebook/
│       └── communication/
├── hooks/
│   └── teacher/                        # NEW - Teacher hooks
│       ├── useTeacherContext.ts
│       ├── useTeacherClasses.ts
│       ├── useAttendance.ts
│       ├── useStudio.ts
│       └── useGradebook.ts
├── lib/
│   └── auth/
│       ├── requireTeacher.ts           # NEW
│       ├── permissions.ts              # NEW
│       └── can.ts                      # NEW
└── models/
    ├── StudentAttendance.ts            # NEW
    ├── Homework.ts                     # NEW
    ├── Submission.ts                   # NEW
    ├── Rubric.ts                       # NEW
    ├── Notice.ts                       # NEW
    ├── MessageThread.ts                # NEW
    ├── Message.ts                      # NEW
    ├── Escalation.ts                   # NEW
    ├── JournalEntry.ts                 # NEW
    └── Teacher.ts                      # MODIFIED (add subroles)
```

---

**End of Implementation Plan**

> This plan ensures safe, incremental development with clear milestones and zero disruption to existing features.

