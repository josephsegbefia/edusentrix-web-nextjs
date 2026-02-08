# Parent Dashboard - API Contract & Implementation Guide

> **Document Version:** 1.0  
> **Last Updated:** January 2026  
> **Platforms:** Jedi (Mobile) & EduSentrix (Web)

This document serves as the single source of truth for implementing the Parent Dashboard backend and ensuring feature parity between the mobile app (Jedi) and web app (EduSentrix).

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication & Context](#authentication--context)
3. [Academic Period Navigation](#academic-period-navigation)
4. [API Endpoints](#api-endpoints)
5. [Data Models & TypeScript Interfaces](#data-models--typescript-interfaces)
6. [Mobile Dashboard Implementation](#mobile-dashboard-implementation)
7. [Web Dashboard Implementation](#web-dashboard-implementation)
8. [Reusable Components & Routes](#reusable-components--routes)
9. [Implementation Checklist](#implementation-checklist)

---

## Overview

### Purpose
The Parent Dashboard provides parents/guardians with a comprehensive overview of their wards' academic performance, fee status, attendance, and school activities. Both platforms share the same backend API but may present data differently based on platform capabilities.

### Design Principles
- **API-First:** Design APIs that serve both platforms efficiently
- **Mobile-Optimized:** Aggregate data to minimize API calls on mobile
- **Web-Extended:** Provide additional filtering, export, and bulk operations for web
- **Period-Aware:** All academic data is scoped to an academic period (term/semester)

---

## Authentication & Context

### Authentication Flow
Both platforms use **Clerk** for authentication. After successful authentication:

1. Client obtains JWT token from Clerk
2. Token is sent in `Authorization: Bearer <token>` header
3. Backend validates token and extracts `userId`
4. Backend looks up the user's role and associated school

### Required Headers

```typescript
interface RequestHeaders {
  'Authorization': string;        // Bearer <clerk_token>
  'X-School-Id'?: string;         // Optional: Override school context (for multi-school users)
  'X-Academic-Period-Id'?: string; // Optional: Override current period (for historical views)
}
```

### Base Context Endpoint

**Reusable Route:** This endpoint likely already exists for admin/teacher roles.

```
GET /api/me
```

**Response:**
```typescript
interface MeResponse {
  id: string;
  clerkUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'parent' | 'student' | 'teacher' | 'admin';
  schoolId: string;
  school: {
    id: string;
    name: string;
    logo?: string;
    currentAcademicYearId: string;
    currentAcademicPeriodId: string;
  };
  // Parent-specific
  wards?: {
    id: string;
    studentId: string;
    relationship: string;
  }[];
}
```

---

## Academic Period Navigation

### Concept
Parents should be able to view historical data from past academic periods. The system tracks:

- **Academic Year:** e.g., "2025-2026"
- **Academic Period:** e.g., "Term 1", "Term 2", "Semester 1"

### Period Selector Endpoint

```
GET /api/schools/:schoolId/academic-periods
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `yearId` | string | Filter by academic year |
| `includePast` | boolean | Include past periods (default: true) |

**Response:**
```typescript
interface AcademicPeriodsResponse {
  currentPeriod: AcademicPeriod;
  currentYear: AcademicYear;
  years: AcademicYear[];
}

interface AcademicYear {
  id: string;
  name: string;           // e.g., "2025-2026"
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  periods: AcademicPeriod[];
}

interface AcademicPeriod {
  id: string;
  name: string;           // e.g., "Term 1", "First Semester"
  shortName: string;      // e.g., "T1", "S1"
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  academicYearId: string;
}
```

### Usage Pattern
- **Default behavior:** All dashboard data uses `currentAcademicPeriodId`
- **Historical view:** Client passes `X-Academic-Period-Id` header or query param `?periodId=xxx`
- **UI Indicator:** Show badge when viewing historical data (not current period)

---

## API Endpoints

### 1. Dashboard Summary

Aggregated summary for quick stats cards.

```
GET /api/parent/dashboard/summary
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `periodId` | string | Academic period (default: current) |

**Response:**
```typescript
interface ParentDashboardSummary {
  // Meta
  periodId: string;
  periodName: string;
  isCurrentPeriod: boolean;
  
  // Summary Stats
  totalWards: number;
  totalOutstandingFees: number;     // Sum across all wards
  averageAcademicPerformance: number; // Weighted average across wards
  averageAttendanceRate: number;    // Weighted average across wards
  
  // Trend indicators (compared to previous period) - WEB ONLY
  feesTrend?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
  };
  academicTrend?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
  };
  attendanceTrend?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
  };
}
```

---

### 2. Wards List (with Dashboard Data)

Comprehensive ward data optimized for dashboard display.

```
GET /api/parent/wards
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `periodId` | string | Academic period (default: current) |
| `include` | string | Comma-separated: `grades,fees,attendance,rank` |

**Response:**
```typescript
interface ParentWardsResponse {
  periodId: string;
  periodName: string;
  isCurrentPeriod: boolean;
  wards: WardDashboardData[];
}

interface WardDashboardData {
  // Student Identity
  id: string;                    // Ward relationship ID
  studentId: string;             // Student ID
  firstName: string;
  lastName: string;
  fullName: string;              // Computed: firstName + lastName
  photoUrl: string | null;
  relationship: string;          // "Son", "Daughter", "Ward", etc.
  
  // Class Information
  classGroup: {
    id: string;
    name: string;                // e.g., "JHS 1A"
    grade: string;               // e.g., "JHS 1"
    section: string;             // e.g., "A"
  };
  
  // Academic Performance (for selected period)
  academic: {
    average: number;             // Weighted average across subjects
    totalSubjects: number;
    subjectsPassed: number;
    rank: number;                // Position in class
    totalStudentsInClass: number;
    trend: 'up' | 'down' | 'stable'; // Compared to previous period
    previousAverage?: number;    // WEB ONLY
  };
  
  // Attendance (for selected period)
  attendance: {
    rate: number;                // Percentage (0-100)
    daysPresent: number;
    daysAbsent: number;
    totalSchoolDays: number;
    trend: 'up' | 'down' | 'stable';
  };
  
  // Fee Status (current - fees are NOT period-scoped the same way)
  fees: {
    status: 'clear' | 'partial' | 'owing';
    totalFees: number;           // Total expected for current year/period
    amountPaid: number;
    outstandingAmount: number;
    nextPaymentDue?: string;     // ISO date
    paymentProgress: number;     // Percentage (0-100)
  };
  
  // Latest Grade Entry
  latestGrade: {
    id: string;
    subject: string;
    assessmentType: string;      // "Mid-Term Exam", "Quiz", "Assignment"
    score: number;
    maxScore: number;
    percentage: number;
    date: string;                // ISO date
    teacherName?: string;        // WEB ONLY
  } | null;
}
```

---

### 3. Recent Activity Feed

Activity stream across all wards.

```
GET /api/parent/activity
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Max items (default: 10, max: 50) |
| `offset` | number | Pagination offset |
| `wardId` | string | Filter by specific ward |
| `type` | string | Filter by type: `grade,fee,attendance,announcement` |
| `periodId` | string | Academic period (default: current) |

**Response:**
```typescript
interface ParentActivityResponse {
  activities: ParentActivity[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface ParentActivity {
  id: string;
  type: 'grade' | 'fee' | 'attendance' | 'announcement' | 'message' | 'event';
  title: string;
  description: string;
  
  // Ward context (null for school-wide announcements)
  ward: {
    id: string;
    studentId: string;
    name: string;
  } | null;
  
  // Timestamps
  createdAt: string;            // ISO date
  timeAgo: string;              // "2 hours ago", "Yesterday"
  
  // Type-specific metadata
  metadata: {
    // For 'grade' type
    gradeId?: string;
    subject?: string;
    score?: number;
    maxScore?: number;
    
    // For 'fee' type
    amount?: number;
    paymentId?: string;
    
    // For 'attendance' type
    date?: string;
    status?: 'present' | 'absent' | 'late' | 'excused';
    
    // For 'announcement' type
    priority?: 'normal' | 'important' | 'urgent';
    
    // For 'event' type
    eventDate?: string;
    location?: string;
  };
  
  // Action URL (for deep linking)
  actionUrl?: string;
}
```

---

### 4. Single Ward Detail (Web Extended)

Detailed view for a specific ward. **Primary use: Web dashboard.**

```
GET /api/parent/wards/:wardId
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `periodId` | string | Academic period (default: current) |

**Response:**
```typescript
interface WardDetailResponse extends WardDashboardData {
  // Extended Academic Data
  subjects: SubjectPerformance[];
  
  // Extended Attendance Data
  attendanceHistory: AttendanceRecord[];
  
  // Fee Payment History
  paymentHistory: PaymentRecord[];
  
  // Class Teacher Info
  classTeacher: {
    id: string;
    name: string;
    email?: string;
    photoUrl?: string;
  } | null;
  
  // Upcoming Events/Deadlines
  upcomingEvents: {
    id: string;
    title: string;
    date: string;
    type: 'exam' | 'event' | 'deadline' | 'meeting';
  }[];
}

interface SubjectPerformance {
  subjectId: string;
  subjectName: string;
  teacherName: string;
  currentAverage: number;
  previousAverage?: number;
  trend: 'up' | 'down' | 'stable';
  assessments: {
    id: string;
    name: string;
    score: number;
    maxScore: number;
    date: string;
  }[];
}

interface AttendanceRecord {
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
}

interface PaymentRecord {
  id: string;
  amount: number;
  date: string;
  method: string;
  reference: string;
  status: 'completed' | 'pending' | 'failed';
}
```

---

### 5. Notifications/Alerts

```
GET /api/parent/notifications
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Max items (default: 20) |
| `offset` | number | Pagination offset |
| `unreadOnly` | boolean | Only unread (default: false) |

**Response:**
```typescript
interface NotificationsResponse {
  unreadCount: number;
  notifications: Notification[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface Notification {
  id: string;
  type: 'grade' | 'fee' | 'attendance' | 'announcement' | 'message' | 'reminder';
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  wardId?: string;
  wardName?: string;
  actionUrl?: string;
  priority: 'low' | 'normal' | 'high';
}
```

**Mark as Read:**
```
PATCH /api/parent/notifications/:id/read
POST /api/parent/notifications/mark-all-read
```

---

### 6. Academic Progress (Aggregate View)

Aggregated academic performance view across all wards - powers the `/parent/academics` page.

```
GET /api/parent/academics
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `periodId` | string | Academic period (default: current) |
| `termId` | string | Alias for periodId |

**Response:**
```typescript
interface ParentAcademicsResponse {
  // Period Context
  currentPeriod: {
    id: string;
    name: string;
    label: string;
  } | null;
  selectedPeriodId: string | null;
  availablePeriods: {
    id: string;
    name: string;
    label: string;
  }[];
  
  // Ward Summaries
  wards: WardAcademicSummary[];
  
  // Comparison Data (for charts)
  comparison: AcademicComparisonData[];
  
  // Subject Analysis
  topPerformingSubjects: SubjectPerformanceItem[];
  needsImprovementSubjects: SubjectPerformanceItem[];
  
  // Overall Summary
  overallSummary: {
    averageAcrossWards: number | null;
    highestPerformer: {
      wardId: string;
      wardName: string;
      average: number | null;
    } | null;
    mostImproved: {
      wardId: string;
      wardName: string;
      improvement: number;
    } | null;
    totalSubjects: number;
  };
}

interface WardAcademicSummary {
  wardId: string;
  wardName: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  classGroup: string;
  grade: string | null;
  average: number | null;
  previousAverage: number | null;
  trend: 'up' | 'down' | 'stable';
  classPosition: number | null;
  totalStudents: number | null;
  performanceTier: 'top' | 'above_average' | 'average' | 'at_risk' | null;
  subjectCount: number;
  passedCount: number;
  failedCount: number;
}

interface AcademicComparisonData {
  wardId: string;
  wardName: string;
  photoUrl: string | null;
  average: number | null;
  color: string;  // For chart coloring
}

interface SubjectPerformanceItem {
  subjectId: string;
  subjectName: string;
  shortCode: string | null;
  wardId: string;
  wardName: string;
  totalScore: number | null;
  gradeLetter: string | null;
  isPassed: boolean | null;
}
```

**Usage Notes:**
- This endpoint aggregates academic data across all wards for the selected period
- The `comparison` array provides data formatted for bar/radar chart visualization
- `topPerformingSubjects` shows the highest scoring subjects across all wards (top 5)
- `needsImprovementSubjects` shows subjects scoring below 60% (bottom 5)
- Clicking a ward navigates to `/parent/wards/:id?tab=academics` for detailed view

---

## Data Models & TypeScript Interfaces

### Shared Types (for both platforms)

```typescript
// types/parent-dashboard.ts

export type FeeStatus = 'clear' | 'partial' | 'owing';
export type TrendDirection = 'up' | 'down' | 'stable';
export type ActivityType = 'grade' | 'fee' | 'attendance' | 'announcement' | 'message' | 'event';
export type NotificationType = 'grade' | 'fee' | 'attendance' | 'announcement' | 'message' | 'reminder';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface DashboardSummary {
  totalWards: number;
  totalOutstandingFees: number;
  averageAcademicPerformance: number;
  averageAttendanceRate: number;
}

export interface WardBasic {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  photoUrl: string | null;
  relationship: string;
  classGroup: string;
}

export interface WardAcademicSummary {
  average: number;
  rank: number;
  totalStudentsInClass: number;
  trend: TrendDirection;
}

export interface WardFeeSummary {
  status: FeeStatus;
  totalFees: number;
  outstandingAmount: number;
  paymentProgress: number;
}

export interface WardAttendanceSummary {
  rate: number;
  trend: TrendDirection;
}

export interface LatestGrade {
  subject: string;
  score: number;
  date: string;
}
```

---

## Mobile Dashboard Implementation

### Data Fetching Strategy

The mobile dashboard should fetch data efficiently using **React Query**:

```typescript
// hooks/useParentDashboard.ts
import { useQuery } from '@tanstack/react-query';

export function useParentDashboard(periodId?: string) {
  const summary = useQuery({
    queryKey: ['parent', 'dashboard', 'summary', periodId],
    queryFn: () => fetchDashboardSummary(periodId),
  });

  const wards = useQuery({
    queryKey: ['parent', 'wards', periodId],
    queryFn: () => fetchWards(periodId),
  });

  const activity = useQuery({
    queryKey: ['parent', 'activity', periodId],
    queryFn: () => fetchActivity({ limit: 5, periodId }),
  });

  return {
    summary: summary.data,
    wards: wards.data,
    activity: activity.data,
    isLoading: summary.isLoading || wards.isLoading,
    refetch: () => {
      summary.refetch();
      wards.refetch();
      activity.refetch();
    },
  };
}
```

### Mobile-Specific Considerations

| Feature | Implementation |
|---------|---------------|
| **Pull to Refresh** | Invalidate all dashboard queries |
| **Offline Support** | Cache last fetched data in AsyncStorage |
| **Optimistic Updates** | Not needed for dashboard (read-only) |
| **Background Refresh** | Refresh on app foreground |
| **Pagination** | Activity feed uses infinite scroll |

### Quick Actions Mapping

| Action | Route |
|--------|-------|
| Pay Fees | `/(parent)/fees/pay` |
| Academics | `/(parent)/wards/:wardId/academics` |
| Reports | `/(parent)/reports` |
| Messages | `/(parent)/messages` |

---

## Web Dashboard Implementation

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER: Period Selector | Notifications | Profile              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PERIOD BANNER (shown when viewing historical period)    │  │
│  │  "Viewing Term 1, 2024-2025" [Switch to Current]        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                   │
│  │ Wards  │ │ Fees   │ │ Grades │ │Attend. │  ← METRIC CARDS   │
│  │   2    │ │₵1,200  │ │ 78.5%  │ │  95%   │    (with trends)  │
│  └────────┘ └────────┘ └────────┘ └────────┘                   │
│                                                                 │
│  ┌─────────────────────────────────┐ ┌───────────────────────┐ │
│  │                                 │ │                       │ │
│  │      WARD CARDS GRID            │ │   ACTIVITY FEED       │ │
│  │      (2-3 columns)              │ │   (with filters)      │ │
│  │                                 │ │                       │ │
│  │  ┌─────────┐ ┌─────────┐       │ │   [All] [Grades]      │ │
│  │  │  John   │ │  Jane   │       │ │   [Fees] [Announce]   │ │
│  │  │  Doe    │ │  Doe    │       │ │                       │ │
│  │  │ JHS 1A  │ │ Pri 5B  │       │ │   • Grade posted...   │ │
│  │  │ Rank #5 │ │ Rank #12│       │ │   • Fee received...   │ │
│  │  └─────────┘ └─────────┘       │ │   • Announcement...   │ │
│  │                                 │ │                       │ │
│  │  [View All Wards]               │ │   [View All]          │ │
│  └─────────────────────────────────┘ └───────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  COMPARISON TABLE (Web Only)                              │  │
│  │  Compare wards side-by-side across subjects               │  │
│  │  ┌────────────┬─────────────┬─────────────┐              │  │
│  │  │ Subject    │ John Doe    │ Jane Doe    │              │  │
│  │  ├────────────┼─────────────┼─────────────┤              │  │
│  │  │ Mathematics│ 85%  ↑      │ 72%  ↓      │              │  │
│  │  │ English    │ 78%  →      │ 80%  ↑      │              │  │
│  │  │ Science    │ 82%  ↑      │ 75%  →      │              │  │
│  │  └────────────┴─────────────┴─────────────┘              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  QUICK ACTIONS BAR                                        │  │
│  │  [Pay Fees] [Download Reports] [Message Teachers]         │  │
│  │  [View Calendar] [Fee History Export]                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Web-Only Features

| Feature | Description |
|---------|-------------|
| **Period Selector** | Dropdown in header to switch between academic periods |
| **Historical Banner** | Alert banner when viewing past period data |
| **Trend Indicators** | Show ↑↓→ arrows with percentage change |
| **Comparison Table** | Side-by-side ward comparison by subject |
| **Data Export** | Download reports as PDF/Excel |
| **Advanced Filters** | Filter activity by date range, type, ward |
| **Bulk Actions** | Pay fees for multiple wards at once |
| **Print View** | Optimized print layout for reports |
| **Calendar View** | View events, deadlines, exam schedules |

### Web Components to Build

```typescript
// Components needed for web dashboard
components/
├── parent/
│   ├── dashboard/
│   │   ├── PeriodSelector.tsx       // Academic period dropdown
│   │   ├── HistoricalBanner.tsx     // "Viewing past data" alert
│   │   ├── SummaryMetricCard.tsx    // Metric card with trend
│   │   ├── WardCardGrid.tsx         // Grid of ward cards
│   │   ├── WardCard.tsx             // Individual ward card
│   │   ├── ActivityFeed.tsx         // Activity list with filters
│   │   ├── ActivityItem.tsx         // Single activity item
│   │   ├── WardComparisonTable.tsx  // Side-by-side comparison
│   │   └── QuickActionsBar.tsx      // Action buttons
│   ├── wards/
│   │   ├── WardDetailPage.tsx       // Full ward detail view
│   │   ├── AcademicTab.tsx          // Grades by subject
│   │   ├── AttendanceTab.tsx        // Attendance calendar
│   │   └── FeesTab.tsx              // Payment history
│   └── shared/
│       ├── ProgressBar.tsx          // Reusable progress bar
│       ├── TrendIndicator.tsx       // Up/down/stable arrow
│       └── StatusBadge.tsx          // Fee status badge
```

---

## Reusable Components & Routes

### From Existing Admin/Teacher Implementation

These routes/components likely already exist and can be reused or extended:

| Existing | Reuse For |
|----------|-----------|
| `GET /api/me` | Parent context (add `wards` field) |
| `GET /api/schools/:id/academic-periods` | Period selector |
| `GET /api/students/:id` | Ward detail base data |
| `GET /api/students/:id/grades` | Ward academic data |
| `GET /api/students/:id/attendance` | Ward attendance data |
| `GET /api/students/:id/fees` | Ward fee data |
| `MetricStatCard` component | Dashboard metric cards |
| `StudentCard` component | Adapt for ward cards |
| `DataTable` component | Comparison table |
| `Badge` component | Status badges |

### New Parent-Specific Routes Needed

| Route | Purpose |
|-------|---------|
| `GET /api/parent/dashboard/summary` | Aggregated dashboard stats |
| `GET /api/parent/wards` | List wards with dashboard data |
| `GET /api/parent/wards/:id` | Single ward detail |
| `GET /api/parent/activity` | Activity feed |
| `GET /api/parent/notifications` | Notifications list |
| `PATCH /api/parent/notifications/:id/read` | Mark notification read |
| `POST /api/parent/notifications/mark-all-read` | Mark all read |

### Database Considerations

Ensure these relationships exist:

```sql
-- Ward relationship (parent to student)
CREATE TABLE ward_relationships (
  id UUID PRIMARY KEY,
  parent_user_id UUID REFERENCES users(id),
  student_id UUID REFERENCES students(id),
  relationship VARCHAR(50), -- 'Son', 'Daughter', 'Ward', etc.
  is_primary BOOLEAN DEFAULT false, -- Primary guardian
  created_at TIMESTAMP,
  UNIQUE(parent_user_id, student_id)
);

-- Activity log for parent feed
CREATE TABLE parent_activity_log (
  id UUID PRIMARY KEY,
  school_id UUID REFERENCES schools(id),
  student_id UUID REFERENCES students(id),
  type VARCHAR(50), -- 'grade', 'fee', 'attendance', etc.
  title VARCHAR(255),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP,
  INDEX(student_id, created_at DESC)
);
```

---

## Implementation Checklist

### Backend Tasks

- [ ] **Phase 1: Core Endpoints**
  - [ ] Extend `/api/me` to include ward relationships for parents
  - [ ] Implement `GET /api/parent/dashboard/summary`
  - [ ] Implement `GET /api/parent/wards` with all includes
  - [ ] Implement `GET /api/parent/activity`

- [ ] **Phase 2: Period Support**
  - [ ] Add `periodId` query param support to all endpoints
  - [ ] Implement period-scoped grade/attendance calculations
  - [ ] Add trend calculations (compare to previous period)

- [ ] **Phase 3: Notifications**
  - [ ] Implement notification endpoints
  - [ ] Set up activity logging triggers

- [ ] **Phase 4: Web Extensions**
  - [ ] Add trend data to summary endpoint
  - [ ] Implement ward detail endpoint with full data
  - [ ] Add export endpoints (PDF/Excel)

### Mobile Tasks

- [ ] Replace mock data with API calls
- [ ] Implement React Query hooks
- [ ] Add period selector (if needed for mobile)
- [ ] Handle loading/error states
- [ ] Implement pull-to-refresh
- [ ] Add offline caching

### Web Tasks

- [ ] Build period selector component
- [ ] Build historical data banner
- [ ] Build metric cards with trends
- [ ] Build ward comparison table
- [ ] Implement activity feed with filters
- [ ] Add export functionality
- [ ] Build full ward detail page

---

## API Response Examples

### Dashboard Summary Response

```json
{
  "periodId": "period_abc123",
  "periodName": "Term 1",
  "isCurrentPeriod": true,
  "totalWards": 2,
  "totalOutstandingFees": 1200.00,
  "averageAcademicPerformance": 78.5,
  "averageAttendanceRate": 94.0,
  "feesTrend": {
    "direction": "down",
    "percentage": 15.5
  },
  "academicTrend": {
    "direction": "up",
    "percentage": 3.2
  },
  "attendanceTrend": {
    "direction": "stable",
    "percentage": 0.5
  }
}
```

### Wards List Response

```json
{
  "periodId": "period_abc123",
  "periodName": "Term 1",
  "isCurrentPeriod": true,
  "wards": [
    {
      "id": "ward_001",
      "studentId": "student_001",
      "firstName": "John",
      "lastName": "Doe",
      "fullName": "John Doe",
      "photoUrl": null,
      "relationship": "Son",
      "classGroup": {
        "id": "class_001",
        "name": "JHS 1A",
        "grade": "JHS 1",
        "section": "A"
      },
      "academic": {
        "average": 82.5,
        "totalSubjects": 8,
        "subjectsPassed": 8,
        "rank": 5,
        "totalStudentsInClass": 32,
        "trend": "up",
        "previousAverage": 79.2
      },
      "attendance": {
        "rate": 96.0,
        "daysPresent": 48,
        "daysAbsent": 2,
        "totalSchoolDays": 50,
        "trend": "stable"
      },
      "fees": {
        "status": "partial",
        "totalFees": 2000.00,
        "amountPaid": 1500.00,
        "outstandingAmount": 500.00,
        "nextPaymentDue": "2026-02-15",
        "paymentProgress": 75
      },
      "latestGrade": {
        "id": "grade_001",
        "subject": "Mathematics",
        "assessmentType": "Mid-Term Exam",
        "score": 85,
        "maxScore": 100,
        "percentage": 85,
        "date": "2026-01-25"
      }
    }
  ]
}
```

---

## Notes

1. **Currency:** All monetary values use the school's configured currency (₵ for Ghana Cedis shown in examples)

2. **Permissions:** Backend must verify the requesting user is the parent of the requested ward(s)

3. **Caching:** Dashboard summary can be cached for 5 minutes; activity feed should be real-time

4. **Rate Limiting:** Apply standard rate limits; mobile may poll more frequently on refresh

5. **Error Handling:** Return appropriate HTTP status codes with structured error responses

```typescript
interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
```

---

*Document maintained by the EduSentrix development team.*
