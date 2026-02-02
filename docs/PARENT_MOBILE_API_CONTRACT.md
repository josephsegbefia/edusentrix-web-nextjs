# Parent Mobile API Contract

> **Version:** 1.0  
> **Last Updated:** February 2026  
> **Target Platform:** Jedi Mobile App (Expo/React Native)

This document provides the mobile development team with all endpoints, request/response schemas, and implementation patterns for the Parent Dashboard features.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Base Configuration](#base-configuration)
3. [Parent Dashboard APIs](#parent-dashboard-apis)
4. [Ward APIs](#ward-apis)
5. [Academic APIs](#academic-apis)
6. [Fees APIs](#fees-apis)
7. [Attendance APIs](#attendance-apis)
8. [React Query Hooks Reference](#react-query-hooks-reference)
9. [TypeScript Types](#typescript-types)
10. [Error Handling](#error-handling)

---

## Authentication

### Authentication Flow

Parents authenticate via **Clerk** using the Expo SDK:

```typescript
// Using @clerk/clerk-expo
import { useAuth } from '@clerk/clerk-expo';

const { getToken } = useAuth();

// Get JWT for API calls
const token = await getToken();

// Include in headers
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

### Parent Invitation Flow

1. School admin adds guardian to student profile
2. Guardian receives email invitation via Clerk
3. Guardian clicks link → Opens in mobile app (deep link)
4. Guardian completes sign-up (email verification + password)
5. After sign-up, call `GET /api/me` to fetch user context

---

## Base Configuration

### Base URL

```typescript
// Production
const BASE_URL = 'https://edusentrix.vercel.app';

// Development
const BASE_URL = 'http://localhost:3000';
```

### Standard Response Format

All endpoints return:

```typescript
// Success
{
  success: true,
  data: { ... }
}

// Error
{
  success: false,
  error: "Error message"
}
```

---

## Parent Dashboard APIs

### GET /api/parent/dashboard

Fetches the parent dashboard with wards summary.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```typescript
{
  success: true,
  data: {
    wards: WardSummary[],
    summary: {
      totalWards: number,
      totalOutstanding: number,
      upcomingPayments: number
    }
  }
}

interface WardSummary {
  id: string;                  // Student ID
  name: string;                // Full name
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  classGroup: string;          // Class name (e.g., "JHS 1A")
  classGroupId: string;
  admissionNo: string | null;
  status: string;              // "active" | "inactive" | "graduated"
  relationship: string;        // "Father" | "Mother" | "Guardian" etc.
  isPrimary: boolean;          // Is primary guardian
  feeStatus: "clear" | "partial" | "owing";
  outstandingAmount: number;   // Amount owed in GH₵
}
```

**React Native Usage:**
```typescript
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['parent', 'dashboard'],
  queryFn: async () => {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/api/parent/dashboard`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  }
});
```

---

## Ward APIs

### GET /api/parent/wards

Alias for dashboard - returns list of all wards with summary data.

### GET /api/parent/wards/:id

Fetches detailed information for a single ward.

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Student ObjectId |

**Response:**
```typescript
{
  success: true,
  data: {
    id: string,
    studentId: string,
    name: string,
    firstName: string,
    lastName: string,
    photoUrl: string | null,
    classGroup: {
      id: string,
      name: string
    } | null,
    grade: string | null,        // e.g., "JHS 1"
    admissionNo: string | null,
    status: string,
    relationship: string,
    isPrimary: boolean
  }
}
```

---

## Academic APIs

### GET /api/parent/wards/:id/academics

Fetches academic performance data for a ward.

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Student ObjectId |

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `periodId` | string? | Academic period ID (default: current) |

**Response:**
```typescript
{
  success: true,
  data: StudentAcademicsDTO
}

interface StudentAcademicsDTO {
  studentId: string;
  selectedTermId: string | null;
  selectedTermLabel: string | null;   // e.g., "2025-2026 • Term 1"
  
  summary: {
    overallAverage: number | null;    // Term average (0-100)
    classPosition: number | null;     // Rank in class
    totalStudents: number | null;     // Class size
    performanceTier: string | null;   // "Excellent" | "Good" | "Average" | "Below Average"
    trend: "up" | "down" | "stable";
    trendDelta: number | null;        // Change from previous term
  };
  
  term: StudentTermOverview[];        // All terms for selector
  subjects: StudentSubjectPerformance[];
  comments: TeacherComment[];
  
  // Enhanced data
  riskLevel?: string;                 // "low" | "moderate" | "high" | "critical"
  strongestSubject?: {
    subjectId: string;
    subjectName: string;
    score: number;
  } | null;
  weakestSubject?: {
    subjectId: string;
    subjectName: string;
    score: number;
  } | null;
}

interface StudentTermOverview {
  termId: string;
  label: string;                      // e.g., "2025-2026 • Term 1"
  averageScore: number | null;
  classPosition: number | null;
  totalSubjects: number | null;
  performanceTier: string | null;
}

interface StudentSubjectPerformance {
  subjectId: string;
  subjectName: string;
  shortCode: string | null;           // e.g., "MATH", "ENG"
  teacherName: string | null;
  caPercentage: number | null;        // Continuous Assessment (0-30 typically)
  examPercentage: number | null;      // Exam score (0-70 typically)
  totalScore: number | null;          // Total (0-100)
  gradeLetter: string | null;         // "A", "B1", "C4", etc.
  gradePoint: number | null;
  isPassed: boolean | null;
}

interface TeacherComment {
  id: string;
  commentType: string;                // "general" | "conduct" | "academic"
  subjectId: string | null;
  subjectName: string | null;
  teacherName: string | null;
  comment: string;
  isPublic: boolean;
  createdAt: string;                  // ISO date
}
```

---

## Fees APIs

### GET /api/parent/wards/:id/fees/summary

Fetches fee summary and payment history for a ward.

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Student ObjectId |

**Response:**
```typescript
{
  success: true,
  data: {
    status: "clear" | "partial" | "owing",
    totalFees: number,              // Total billed amount
    amountPaid: number,             // Total amount paid
    balanceDue: number,             // Outstanding balance
    paymentProgress: number,        // Percentage (0-100)
    nextDueDate: string | null,     // ISO date of next payment
    
    invoices: Invoice[],            // Pending/partial invoices
    payments: Payment[]             // Recent payment records
  }
}

interface Invoice {
  id: string;
  title: string;                    // Invoice description
  amount: number;                   // Total invoice amount
  balanceDue: number;               // Remaining balance
  dueDate: string;                  // ISO date
  status: "pending" | "partial" | "paid" | "overdue";
}

interface Payment {
  id: string;
  amount: number;
  date: string;                     // ISO date
  method: string;                   // "cash" | "bank_transfer" | "mobile_money"
  reference: string;                // Receipt/reference number
}
```

---

## Attendance APIs

### GET /api/parent/wards/:id/attendance

Fetches attendance data for a ward.

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Student ObjectId |

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `periodId` | string? | Academic period ID (default: current) |

**Response:**
```typescript
{
  success: true,
  data: {
    rate: number,                   // Attendance rate (0-100)
    daysPresent: number,
    daysAbsent: number,
    daysLate: number,
    totalDays: number,              // Total school days
    trend: "up" | "down" | "stable",
    
    recentRecords: AttendanceRecord[],
    monthlyBreakdown: MonthlyAttendance[]
  }
}

interface AttendanceRecord {
  date: string;                     // ISO date
  status: "present" | "absent" | "late" | "excused";
  notes?: string;                   // Reason for absence/late
}

interface MonthlyAttendance {
  month: string;                    // e.g., "Jan 2026"
  present: number;
  absent: number;
  late: number;
  total: number;
}
```

---

## React Query Hooks Reference

### Recommended Query Keys Structure

```typescript
// Dashboard
['parent', 'dashboard']

// Ward list
['parent', 'wards', periodId?]

// Ward detail
['parent', 'ward', wardId]

// Ward academics
['parent', 'ward', wardId, 'academics', periodId?]

// Ward fees
['parent', 'ward', wardId, 'fees']

// Ward attendance
['parent', 'ward', wardId, 'attendance', periodId?]
```

### Sample Hook Implementation

```typescript
// hooks/useParentDashboard.ts
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';

export function useParentDashboard() {
  const { getToken } = useAuth();
  
  return useQuery({
    queryKey: ['parent', 'dashboard'],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/parent/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    staleTime: 60_000, // 1 minute
  });
}
```

---

## TypeScript Types

### Complete Type Definitions

```typescript
// types/parent.ts

export type FeeStatus = 'clear' | 'partial' | 'owing';
export type TrendDirection = 'up' | 'down' | 'stable';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface WardSummary {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  classGroup: string;
  classGroupId: string;
  admissionNo: string | null;
  status: string;
  relationship: string;
  isPrimary: boolean;
  feeStatus: FeeStatus;
  outstandingAmount: number;
}

export interface DashboardSummary {
  totalWards: number;
  totalOutstanding: number;
  upcomingPayments: number;
}

export interface ParentDashboardResponse {
  wards: WardSummary[];
  summary: DashboardSummary;
}

export interface WardDetail {
  id: string;
  studentId: string;
  name: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  classGroup: {
    id: string;
    name: string;
  } | null;
  grade: string | null;
  admissionNo: string | null;
  status: string;
  relationship: string;
  isPrimary: boolean;
}

export interface AcademicsSummary {
  overallAverage: number | null;
  classPosition: number | null;
  totalStudents: number | null;
  performanceTier: string | null;
  trend: TrendDirection;
  trendDelta: number | null;
}

export interface SubjectPerformance {
  subjectId: string;
  subjectName: string;
  shortCode: string | null;
  teacherName: string | null;
  caPercentage: number | null;
  examPercentage: number | null;
  totalScore: number | null;
  gradeLetter: string | null;
  gradePoint: number | null;
  isPassed: boolean | null;
}

export interface FeesSummary {
  status: FeeStatus;
  totalFees: number;
  amountPaid: number;
  balanceDue: number;
  paymentProgress: number;
  nextDueDate: string | null;
  invoices: Array<{
    id: string;
    title: string;
    amount: number;
    balanceDue: number;
    dueDate: string;
    status: 'pending' | 'partial' | 'paid' | 'overdue';
  }>;
  payments: Array<{
    id: string;
    amount: number;
    date: string;
    method: string;
    reference: string;
  }>;
}

export interface AttendanceSummary {
  rate: number;
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  totalDays: number;
  trend: TrendDirection;
  recentRecords: Array<{
    date: string;
    status: AttendanceStatus;
    notes?: string;
  }>;
  monthlyBreakdown: Array<{
    month: string;
    present: number;
    absent: number;
    late: number;
    total: number;
  }>;
}
```

---

## Error Handling

### Standard Error Response

```typescript
{
  success: false,
  error: "Error message describing what went wrong"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (invalid parameters) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (no access to resource) |
| 404 | Not Found (ward/resource doesn't exist) |
| 500 | Internal Server Error |

### Error Handling Pattern

```typescript
try {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}/api/parent/wards/${wardId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (res.status === 401) {
    // Token expired, trigger re-auth
    signOut();
    return;
  }
  
  if (res.status === 403) {
    // No access to this ward
    showAlert('You do not have access to this student');
    return;
  }
  
  const json = await res.json();
  
  if (!json.success) {
    throw new Error(json.error || 'Unknown error');
  }
  
  return json.data;
} catch (error) {
  console.error('API Error:', error);
  showAlert('Failed to load data. Please try again.');
}
```

---

## Mobile-Specific Considerations

### Caching Strategy

| Data Type | Stale Time | Cache Time |
|-----------|------------|------------|
| Dashboard | 1 minute | 5 minutes |
| Ward List | 1 minute | 5 minutes |
| Ward Detail | 1 minute | 5 minutes |
| Academics | 1 minute | 10 minutes |
| Fees | 1 minute | 5 minutes |
| Attendance | 1 minute | 5 minutes |

### Offline Support

```typescript
// Use AsyncStorage for persistence
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

// Wrap QueryClient
<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{ persister }}
>
  {children}
</PersistQueryClientProvider>
```

### Pull to Refresh

```typescript
<FlatList
  refreshing={isLoading}
  onRefresh={() => {
    queryClient.invalidateQueries({ queryKey: ['parent'] });
  }}
  // ...
/>
```

---

## Navigation Structure (Suggested)

```
/(parent)/
├── index.tsx              → Dashboard
├── wards/
│   ├── index.tsx          → Ward List
│   └── [id]/
│       ├── index.tsx      → Ward Detail
│       ├── academics.tsx  → Academic Performance
│       ├── fees.tsx       → Fees & Payments
│       └── attendance.tsx → Attendance Records
├── fees/
│   └── pay.tsx            → Payment Screen
├── notifications/
│   └── index.tsx          → Notifications List
└── settings/
    └── index.tsx          → Parent Settings
```

---

---

## Activity Feed API

### GET /api/parent/activity

Fetches activity feed for parent's wards.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `limit` | number | Max items (default: 10, max: 50) |
| `offset` | number | Pagination offset |
| `wardId` | string? | Filter by specific ward |
| `type` | string? | Filter by type: `grade`, `fee`, `attendance` |

**Response:**
```typescript
{
  success: true,
  data: {
    activities: ParentActivity[],
    pagination: {
      total: number,
      limit: number,
      offset: number,
      hasMore: boolean
    }
  }
}

interface ParentActivity {
  id: string;
  type: "grade" | "fee" | "attendance" | "announcement";
  title: string;
  description: string;
  ward: {
    id: string;
    studentId: string;
    name: string;
  } | null;
  createdAt: string;           // ISO date
  timeAgo: string;             // "2 hours ago"
  metadata: {
    gradeId?: string;
    subject?: string;
    score?: number;
    amount?: number;
    status?: string;
  };
  actionUrl?: string;          // Deep link path
}
```

---

## Notifications API

### GET /api/parent/notifications

Fetches notifications for the parent.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `limit` | number | Max items (default: 20, max: 50) |
| `offset` | number | Pagination offset |
| `unreadOnly` | boolean | Only return unread (default: false) |

**Response:**
```typescript
{
  success: true,
  data: {
    unreadCount: number,
    notifications: Notification[],
    pagination: {
      total: number,
      limit: number,
      offset: number,
      hasMore: boolean
    }
  }
}

interface Notification {
  id: string;
  type: "grade" | "fee" | "attendance" | "announcement" | "message" | "reminder" | "system";
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  wardId?: string;
  wardName?: string;
  actionUrl?: string;
  priority: "low" | "normal" | "high";
}
```

### PATCH /api/parent/notifications/:id/read

Marks a single notification as read.

**Response:**
```typescript
{
  success: true,
  data: {
    id: string,
    isRead: true
  }
}
```

### POST /api/parent/notifications/mark-all-read

Marks all notifications as read.

**Response:**
```typescript
{
  success: true,
  data: {
    modifiedCount: number,
    message: string
  }
}
```

---

## Complete API Endpoint Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/parent/dashboard` | Dashboard with wards summary |
| GET | `/api/parent/wards` | List all wards |
| GET | `/api/parent/wards/:id` | Single ward detail |
| GET | `/api/parent/wards/:id/academics` | Academic performance |
| GET | `/api/parent/wards/:id/fees/summary` | Fees and payments |
| GET | `/api/parent/wards/:id/attendance` | Attendance records |
| GET | `/api/parent/activity` | Activity feed |
| GET | `/api/parent/notifications` | Notifications list |
| PATCH | `/api/parent/notifications/:id/read` | Mark notification read |
| POST | `/api/parent/notifications/mark-all-read` | Mark all read |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Feb 2026 | Initial release |
| 1.1 | Feb 2026 | Added Activity Feed and Notifications APIs |

---

*Document maintained by the EduSentrix development team.*
