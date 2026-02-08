# Mobile API Contract Checklist

## Overview

This document provides a comprehensive analysis of the existing API surface and identifies what's ready for mobile, what needs modification, and what new endpoints need to be created for parent/student/teacher roles.

## Current State Analysis

### Authentication Pattern
- **Current**: All endpoints use `requireSchoolAdmin()` or `requireFinanceStaff()`
- **Issue**: No role-scoped endpoints exist for `parent`, `student`, or `teacher` roles
- **Action Required**: Create role-specific auth middleware and endpoints

### Base URL
- All endpoints are under `/api/admin/*` or `/api/*`
- Mobile should use same base URL: `https://your-domain.com/api`

---

## ✅ READY FOR MOBILE (With Minor Modifications)

### 1. Authentication & User Profile

#### ✅ `GET /api/me`
- **Status**: ✅ Ready
- **Current Auth**: Clerk (works for all roles)
- **Returns**: User profile with role, schoolId, etc.
- **Mobile Ready**: Yes - No changes needed
- **Notes**: Already role-agnostic, returns user's role

---

## ⚠️ NEEDS ROLE-SCOPING (Create New Endpoints)

### 2. Student Data Access

#### ⚠️ `GET /api/admin/students/[id]`
- **Status**: ⚠️ Needs Parent/Student Scoped Version
- **Current Auth**: `requireSchoolAdmin()` - Admin only
- **Current Returns**: Full student detail with fees, academics, guardians
- **Action Required**:
  - Create `GET /api/parent/wards/[id]` - Parent can only access their own wards
  - Create `GET /api/student/me` - Student can only access their own data
- **Authorization Logic**:
  - **Parent**: Verify parent is linked via `Guardian` model (`userId` matches, `studentId` matches)
  - **Student**: Verify `userId` matches student's `userId` field
- **Response**: Same structure, but ensure sensitive fields are filtered appropriately

#### ⚠️ `GET /api/admin/students`
- **Status**: ⚠️ Needs Parent Scoped Version
- **Current Auth**: `requireSchoolAdmin()` - Admin only
- **Current Returns**: List of all students with filtering
- **Action Required**:
  - Create `GET /api/parent/wards` - Returns only students linked to parent via `Guardian` model
- **Query Params**: Same filtering options (search, status, classGroup, etc.)
- **Authorization Logic**: Filter by `Guardian` relationships where `userId` = parent's `_id`

---

### 3. Academic Data

#### ⚠️ `GET /api/admin/students/[id]/academics`
- **Status**: ⚠️ Needs Parent/Student Scoped Version
- **Current Auth**: `requireSchoolAdmin()` - Admin only
- **Current Returns**: Academic performance data, grades, teacher comments, subject breakdown
- **Action Required**:
  - Create `GET /api/parent/wards/[id]/academics` - Parent access
  - Create `GET /api/student/academics` - Student access (no id needed, uses authenticated student)
- **Authorization Logic**: Same as student detail endpoint
- **Response**: Same structure - ready to use

#### ⚠️ `GET /api/admin/students/[id]/academics/ai-insights`
- **Status**: ⚠️ Needs Parent/Student Scoped Version
- **Current Auth**: `requireSchoolAdmin()` - Admin only
- **Action Required**: Same scoping as academics endpoint above

#### ⚠️ `GET /api/admin/students/[id]/academics/assessments`
- **Status**: ⚠️ Needs Parent/Student Scoped Version
- **Current Auth**: `requireSchoolAdmin()` - Admin only
- **Action Required**: Same scoping as academics endpoint above

---

### 4. Fees & Payments

#### ⚠️ `GET /api/admin/students/[id]/fees/summary`
- **Status**: ⚠️ Needs Parent/Student Scoped Version
- **Current Auth**: `requireFinanceStaff()` - Finance staff only
- **Current Returns**: Fees summary (outstanding, paid, installments, trends)
- **Action Required**:
  - Create `GET /api/parent/wards/[id]/fees/summary` - Parent access
  - Create `GET /api/student/fees/summary` - Student access
- **Authorization Logic**: Same as student detail endpoint
- **Response**: Same structure - ready to use

#### ⚠️ `GET /api/admin/students/[id]/fees/payments`
- **Status**: ⚠️ Needs Parent/Student Scoped Version
- **Current Auth**: `requireFinanceStaff()` - Finance staff only
- **Current Returns**: Payment history with pagination, filters, summary
- **Action Required**:
  - Create `GET /api/parent/wards/[id]/fees/payments` - Parent access
  - Create `GET /api/student/fees/payments` - Student access
- **Query Params**: Same (invoiceId, paymentMethod, status, dateFrom, dateTo, page, limit)
- **Response**: Same structure - ready to use

#### ⚠️ `GET /api/admin/students/[id]/fees/invoices`
- **Status**: ⚠️ Needs Parent/Student Scoped Version
- **Current Auth**: `requireFinanceStaff()` - Finance staff only
- **Current Returns**: Invoice list with pagination, filters, summary
- **Action Required**:
  - Create `GET /api/parent/wards/[id]/fees/invoices` - Parent access
  - Create `GET /api/student/fees/invoices` - Student access
- **Query Params**: Same (academicPeriodId, status, dateFrom, dateTo, page, limit)
- **Response**: Same structure - ready to use

#### ⚠️ `GET /api/admin/students/[id]/fees/installments`
- **Status**: ⚠️ Needs Parent/Student Scoped Version
- **Current Auth**: `requireFinanceStaff()` - Finance staff only
- **Current Returns**: Installment schedule with payment history
- **Action Required**:
  - Create `GET /api/parent/wards/[id]/fees/installments` - Parent access
  - Create `GET /api/student/fees/installments` - Student access
- **Query Params**: Same (status, dateFrom, dateTo, upcomingOnly)
- **Response**: Same structure - ready to use

#### ⚠️ `POST /api/admin/fees/payments`
- **Status**: ⚠️ Needs Parent Scoped Version (Read-Only for Students)
- **Current Auth**: `requireFinanceStaff()` - Finance staff only
- **Current Action**: Record payment (admin action)
- **Action Required**:
  - **Option A (Recommended)**: Keep admin-only, mobile app shows payment instructions/account details
  - **Option B**: Create `POST /api/parent/wards/[id]/fees/payments/record` - Allow parents to self-record payments (with approval workflow)
- **Note**: Most schools prefer Option A - parents make payment externally, admin records it. Mobile app can show payment instructions and allow upload of proof of payment.

---

### 5. Academic Periods

#### ⚠️ `GET /api/admin/periods`
- **Status**: ⚠️ Needs Public/Scoped Version
- **Current Auth**: `requireSchoolAdmin()` - Admin only
- **Current Returns**: List of academic periods
- **Action Required**:
  - Create `GET /api/periods` - Public endpoint (authenticated users only, no admin requirement)
  - Or create role-scoped versions: `/api/parent/periods`, `/api/student/periods`
- **Response**: Same structure - ready to use
- **Note**: Academic periods are not sensitive, can be shared with all authenticated users

---

## ❌ MISSING ENDPOINTS (Need to Create)

### 6. Parent-Specific Endpoints

#### ❌ `GET /api/parent/dashboard`
- **Status**: ❌ Missing
- **Purpose**: Parent dashboard with quick stats for all wards
- **Returns**:
  ```typescript
  {
    wards: Array<{
      id: string;
      name: string;
      photoUrl?: string;
      classGroup: string;
      academicAverage?: number;
      feeStatus: 'clear' | 'partial' | 'owing';
      outstandingAmount: number;
      attendancePercentage?: number;
    }>;
    summary: {
      totalWards: number;
      totalOutstanding: number;
      upcomingPayments: number;
      recentActivity: Array<Activity>;
    };
  }
  ```
- **Authorization**: Verify user role is `parent`, return only their wards

#### ❌ `GET /api/parent/wards`
- **Status**: ❌ Missing (See #2 above)
- **Purpose**: List all wards (children) linked to parent
- **Returns**: Simplified student list (name, photo, class, quick stats)
- **Authorization**: Filter by `Guardian` model where `userId` = parent's `_id`

#### ❌ `GET /api/parent/notifications`
- **Status**: ❌ Missing
- **Purpose**: Notifications for parent (new grades, fees due, attendance alerts)
- **Returns**: Paginated list of notifications
- **Query Params**: `page`, `limit`, `type`, `unreadOnly`
- **Authorization**: Only notifications related to parent's wards

---

### 7. Student-Specific Endpoints

#### ❌ `GET /api/student/dashboard`
- **Status**: ❌ Missing
- **Purpose**: Student dashboard with their own data
- **Returns**:
  ```typescript
  {
    academicAverage?: number;
    feeStatus: 'clear' | 'partial' | 'owing';
    outstandingAmount: number;
    attendancePercentage?: number;
    upcomingAssignments: Array<Assignment>;
    recentGrades: Array<Grade>;
    timetable: Timetable;
  }
  ```
- **Authorization**: Verify user role is `student`, return only their own data

#### ❌ `GET /api/student/me`
- **Status**: ❌ Missing (See #2 above)
- **Purpose**: Student's own profile data
- **Returns**: Same as student detail, but no `id` param needed (uses authenticated student)

#### ❌ `GET /api/student/timetable`
- **Status**: ❌ Missing
- **Purpose**: Student's weekly timetable/schedule
- **Returns**: Weekly schedule with subjects, teachers, rooms, times
- **Query Params**: `week` (ISO week string), `academicPeriodId`
- **Authorization**: Verify user role is `student`

#### ❌ `GET /api/student/assignments`
- **Status**: ❌ Missing (if assignment feature exists)
- **Purpose**: List assignments for student
- **Returns**: Assignments with due dates, submission status
- **Query Params**: `status`, `dueDate`, `subjectId`, `page`, `limit`
- **Authorization**: Verify user role is `student`

---

### 8. Attendance Endpoints

#### ❌ `GET /api/parent/wards/[id]/attendance`
- **Status**: ❌ Missing
- **Purpose**: View child's attendance records
- **Returns**:
  ```typescript
  {
    studentId: string;
    period: {
      startDate: string;
      endDate: string;
      academicPeriodId: string;
    };
    summary: {
      totalDays: number;
      presentDays: number;
      absentDays: number;
      lateDays: number;
      percentage: number;
    };
    records: Array<{
      date: string;
      status: 'present' | 'absent' | 'late' | 'excused';
      reason?: string;
      markedBy?: string;
    }>;
  }
  ```
- **Query Params**: `academicPeriodId`, `month`, `year`, `dateFrom`, `dateTo`
- **Authorization**: Verify parent is guardian of student

#### ❌ `GET /api/student/attendance`
- **Status**: ❌ Missing
- **Purpose**: Student's own attendance records
- **Returns**: Same structure as above
- **Authorization**: Verify user role is `student`

---

### 9. Documents Endpoints

#### ❌ `GET /api/parent/wards/[id]/documents`
- **Status**: ❌ Missing
- **Purpose**: List documents for child (report cards, certificates, letters)
- **Returns**:
  ```typescript
  {
    documents: Array<{
      id: string;
      name: string;
      type: 'report_card' | 'certificate' | 'letter' | 'other';
      category: string;
      url: string;
      uploadedAt: string;
      academicPeriodId?: string;
    }>;
  }
  ```
- **Query Params**: `type`, `category`, `academicPeriodId`
- **Authorization**: Verify parent is guardian of student

#### ❌ `GET /api/student/documents`
- **Status**: ❌ Missing
- **Purpose**: Student's own documents
- **Returns**: Same structure as above
- **Authorization**: Verify user role is `student`

#### ❌ `GET /api/docs/[...path]`
- **Status**: ⚠️ Exists but needs authorization check
- **Current**: Document download endpoint
- **Action Required**: Add authorization middleware to verify user has access to document
- **Authorization**: Check if document belongs to student, and user is parent/student/admin of that student

---

### 10. Teacher Comments

#### ✅ Already included in academics endpoint
- **Status**: ✅ Available via academics endpoint
- **Endpoint**: `GET /api/admin/students/[id]/academics` includes `comments` array
- **Action Required**: Just needs role-scoping (covered in #3 above)

---

### 11. Notifications System

#### ❌ `GET /api/parent/notifications`
- **Status**: ❌ Missing (See #6 above)

#### ❌ `GET /api/student/notifications`
- **Status**: ❌ Missing
- **Purpose**: Notifications for student
- **Returns**: Paginated list of notifications
- **Query Params**: `page`, `limit`, `type`, `unreadOnly`

#### ❌ `PATCH /api/parent/notifications/[id]/read`
- **Status**: ❌ Missing
- **Purpose**: Mark notification as read
- **Authorization**: Verify notification belongs to user

#### ❌ `PATCH /api/student/notifications/[id]/read`
- **Status**: ❌ Missing
- **Purpose**: Mark notification as read
- **Authorization**: Verify notification belongs to user

---

## 🔧 REQUIRED AUTHENTICATION MIDDLEWARE

### New Middleware Functions Needed

#### 1. `requireParent()` - `/lib/auth/requireParent.ts`
```typescript
export async function requireParent() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) throw new Error("Unauthorized");

  await connectToDatabase();
  const user = await User.findOne({ clerkUserId }).lean();
  if (!user || user.role !== "parent") {
    throw new Error("Unauthorized - Parent role required");
  }

  return { userId: user._id, schoolId: user.schoolId };
}
```

#### 2. `requireStudent()` - `/lib/auth/requireStudent.ts`
```typescript
export async function requireStudent() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) throw new Error("Unauthorized");

  await connectToDatabase();
  const user = await User.findOne({ clerkUserId }).lean();
  if (!user || user.role !== "student") {
    throw new Error("Unauthorized - Student role required");
  }

  // Get student record
  const student = await Student.findOne({ userId: user._id }).lean();
  if (!student) throw new Error("Student record not found");

  return { userId: user._id, studentId: student._id, schoolId: user.schoolId };
}
```

#### 3. `requireTeacher()` - `/lib/auth/requireTeacher.ts`
```typescript
export async function requireTeacher() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) throw new Error("Unauthorized");

  await connectToDatabase();
  const user = await User.findOne({ clerkUserId }).lean();
  if (!user || user.role !== "teacher") {
    throw new Error("Unauthorized - Teacher role required");
  }

  return { userId: user._id, schoolId: user.schoolId };
}
```

#### 4. `requireParentOrStudentAccess(studentId)` - Helper function
```typescript
export async function requireParentOrStudentAccess(studentId: string) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) throw new Error("Unauthorized");

  await connectToDatabase();
  const user = await User.findOne({ clerkUserId }).lean();
  if (!user) throw new Error("Unauthorized");

  // Check if student accessing own data
  if (user.role === "student") {
    const student = await Student.findOne({ userId: user._id }).lean();
    if (student && String(student._id) === studentId) {
      return { userId: user._id, schoolId: user.schoolId };
    }
  }

  // Check if parent accessing ward's data
  if (user.role === "parent") {
    const guardian = await Guardian.findOne({
      userId: user._id,
      studentId: new mongoose.Types.ObjectId(studentId),
    }).lean();
    if (guardian) {
      return { userId: user._id, schoolId: user.schoolId };
    }
  }

  throw new Error("Unauthorized - No access to this student");
}
```

---

## 📋 IMPLEMENTATION PRIORITY

### Phase 1: Critical (Parent Features - Week 1-2)
1. ✅ `GET /api/me` - Already ready
2. ⚠️ `GET /api/parent/wards` - Create new endpoint
3. ⚠️ `GET /api/parent/wards/[id]` - Create new endpoint
4. ⚠️ `GET /api/parent/wards/[id]/academics` - Create new endpoint
5. ⚠️ `GET /api/parent/wards/[id]/fees/summary` - Create new endpoint
6. ⚠️ `GET /api/parent/wards/[id]/fees/payments` - Create new endpoint
7. ⚠️ `GET /api/parent/wards/[id]/fees/invoices` - Create new endpoint
8. ⚠️ `GET /api/parent/wards/[id]/fees/installments` - Create new endpoint
9. ⚠️ `GET /api/periods` - Create public/scoped version
10. ❌ `GET /api/parent/dashboard` - Create new endpoint

### Phase 2: Important (Parent Features - Week 3-4)
11. ❌ `GET /api/parent/wards/[id]/attendance` - Create new endpoint
12. ❌ `GET /api/parent/wards/[id]/documents` - Create new endpoint
13. ❌ `GET /api/parent/notifications` - Create new endpoint
14. ⚠️ `GET /api/docs/[...path]` - Add authorization check

### Phase 3: Student Features (Week 5-6)
15. ❌ `GET /api/student/dashboard` - Create new endpoint
16. ❌ `GET /api/student/me` - Create new endpoint
17. ❌ `GET /api/student/academics` - Create new endpoint
18. ❌ `GET /api/student/fees/summary` - Create new endpoint
19. ❌ `GET /api/student/fees/payments` - Create new endpoint
20. ❌ `GET /api/student/fees/invoices` - Create new endpoint
21. ❌ `GET /api/student/attendance` - Create new endpoint
22. ❌ `GET /api/student/documents` - Create new endpoint
23. ❌ `GET /api/student/timetable` - Create new endpoint (if feature exists)
24. ❌ `GET /api/student/notifications` - Create new endpoint

### Phase 4: Teacher Features (Week 7-8)
25. ❌ Teacher-specific endpoints (if needed for mobile)

---

## 🔐 AUTHORIZATION PATTERNS

### Pattern 1: Parent Accessing Ward Data
```typescript
// Verify parent is guardian of student
const guardian = await Guardian.findOne({
  userId: parentUserId,
  studentId: studentId,
}).lean();

if (!guardian) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
}
```

### Pattern 2: Student Accessing Own Data
```typescript
// Verify student is accessing their own data
const student = await Student.findOne({ userId: studentUserId }).lean();
if (!student || String(student._id) !== studentId) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
}
```

### Pattern 3: Role-Based Route Protection
```typescript
// Use middleware at route level
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const { userId, schoolId } = await requireParent();
  // ... rest of handler
}
```

---

## 📝 RESPONSE FORMAT STANDARDIZATION

All endpoints should follow this format:

### Success Response
```typescript
{
  success: true,
  data: {
    // Endpoint-specific data
  },
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  }
}
```

### Error Response
```typescript
{
  success: false,
  error: "Error message",
  code?: "ERROR_CODE" // Optional error code
}
```

---

## 🚀 QUICK START GUIDE FOR DEVELOPERS

### Step 1: Create Auth Middleware
Create the three middleware functions: `requireParent()`, `requireStudent()`, `requireTeacher()`

### Step 2: Create Parent Endpoints
Start with `/api/parent/wards` and `/api/parent/wards/[id]` - these are the foundation

### Step 3: Reuse Existing Logic
Most endpoints can reuse existing query logic from admin endpoints, just change:
- Auth middleware (`requireParent()` instead of `requireSchoolAdmin()`)
- Authorization checks (verify guardian relationship)
- Route path (`/api/parent/*` instead of `/api/admin/*`)

### Step 4: Test Authorization
Ensure parents can only access their own wards, students can only access their own data

### Step 5: Document Endpoints
Update API documentation with new endpoints

---

## ✅ CHECKLIST SUMMARY

### Ready to Use (0 endpoints)
- ✅ `GET /api/me` - User profile

### Needs Role-Scoping (9 endpoints)
- ⚠️ Student detail endpoints (needs parent/student versions)
- ⚠️ Academics endpoints (needs parent/student versions)
- ⚠️ Fees endpoints (needs parent/student versions)
- ⚠️ Academic periods (needs public version)

### Missing Endpoints (15+ endpoints)
- ❌ Parent dashboard
- ❌ Parent notifications
- ❌ Student dashboard
- ❌ Student timetable
- ❌ Attendance endpoints (parent & student)
- ❌ Documents endpoints (parent & student)
- ❌ Notification management endpoints

### Total Work Required
- **New Endpoints**: ~15-20 endpoints
- **Modified Endpoints**: ~9 endpoints (create role-scoped versions)
- **Auth Middleware**: 3 new functions
- **Estimated Effort**: 2-3 weeks for Phase 1 (Parent features)

---

**Document Version**: 1.0
**Last Updated**: 2024
**Status**: Ready for Implementation
