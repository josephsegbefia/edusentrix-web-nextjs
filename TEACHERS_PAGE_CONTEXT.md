# Teachers Page Development Context

This document provides comprehensive context about the codebase structure, patterns, conventions, and existing implementations to guide the development of the Teachers Management System.

## Table of Contents
1. [Project Structure](#project-structure)
2. [Component Patterns](#component-patterns)
3. [API Route Patterns](#api-route-patterns)
4. [React Query Hooks](#react-query-hooks)
5. [Type Definitions](#type-definitions)
6. [Constants & Configuration](#constants--configuration)
7. [Design System & Styling](#design-system--styling)
8. [Database Models](#database-models)
9. [Authentication & Authorization](#authentication--authorization)
10. [State Management](#state-management)
11. [Error Handling](#error-handling)
12. [Utility Functions](#utility-functions)
13. [Key Patterns to Follow](#key-patterns-to-follow)

---

## Project Structure

### Directory Organization

```
src/
├── app/
│   ├── (app)/                    # App routes (protected)
│   │   └── admin/
│   │       ├── students/         # Students pages
│   │       │   ├── page.tsx      # List page
│   │       │   └── [id]/         # Detail page
│   │       └── teachers/         # Teachers pages (to be created)
│   │           ├── page.tsx      # List page
│   │           └── [id]/        # Detail page
│   └── api/
│       └── admin/
│           ├── students/         # Student APIs
│           │   ├── route.ts      # GET /api/admin/students
│           │   └── [id]/        # Student detail APIs
│           └── teachers/         # Teacher APIs (to be created)
│               ├── route.ts      # GET /api/admin/teachers
│               └── [id]/        # Teacher detail APIs
├── components/
│   ├── admin/
│   │   ├── students/             # Student components
│   │   │   ├── StudentsTable.tsx
│   │   │   ├── StudentsCardGrid.tsx
│   │   │   ├── StudentsToolbar.tsx
│   │   │   ├── StudentsTabsNav.tsx
│   │   │   ├── StudentsQuickStatsSection.tsx
│   │   │   ├── StudentsBulkActionsBar.tsx
│   │   │   ├── StudentsCommandPalette.tsx
│   │   │   ├── StudentsPagination.tsx
│   │   │   └── detail/           # Student detail components
│   │   └── teachers/             # Teacher components (to be created)
│   │       ├── TeachersTable.tsx
│   │       ├── TeachersCardGrid.tsx
│   │       ├── TeachersToolbar.tsx
│   │       ├── TeachersTabsNav.tsx
│   │       ├── TeachersQuickStatsSection.tsx
│   │       ├── TeachersBulkActionsBar.tsx
│   │       ├── TeachersCommandPalette.tsx
│   │       ├── TeachersPagination.tsx
│   │       └── detail/           # Teacher detail components
│   └── ui/                       # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       └── ...
├── hooks/
│   └── admin/
│       ├── useStudents.ts         # Student hooks
│       ├── useStudentStats.ts
│       └── useTeachers.ts        # Teacher hooks (to be created)
├── types/
│   └── admin/
│       ├── student.ts            # Student types
│       └── teacher.ts            # Teacher types (to be created)
├── constants/
│   ├── students.ts               # Student constants
│   └── teachers.ts               # Teacher constants (to be created)
├── models/                       # Mongoose models
│   ├── Student.ts
│   ├── Teacher.ts
│   ├── User.ts
│   └── ...
└── lib/
    ├── auth/
    │   └── requireSchoolAdmin.ts
    ├── utils.ts
    └── ...
```

---

## Component Patterns

### List Page Pattern

The students list page (`src/app/(app)/admin/students/page.tsx`) follows this structure:

```typescript
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export default function StudentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State management
  const [tab, setTab] = React.useState<StudentsTabId>(() =>
    getInitialTab(searchParams)
  );
  const [viewMode, setViewMode] = React.useState<StudentsViewMode>(() =>
    getInitialView(searchParams)
  );
  const [search, setSearch] = React.useState(searchParams.get("q") ?? "");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_STUDENTS_PAGE_SIZE);
  const [sortBy, setSortBy] = React.useState<StudentsSortBy>("name");
  const [sortOrder, setSortOrder] = React.useState<StudentsSortOrder>("asc");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [commandOpen, setCommandOpen] = React.useState(false);

  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const debouncedSearch = useDebouncedValue(search, 400);

  // URL sync
  React.useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    params.set("view", viewMode);
    if (debouncedSearch) params.set("q", debouncedSearch);
    params.set("page", String(page));
    router.replace(`/admin/students?${params.toString()}`);
  }, [tab, viewMode, debouncedSearch, page, router]);

  // Keyboard shortcuts
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // "/" focuses search
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Cmd/Ctrl + K opens command palette
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Data fetching
  const { students, pagination, isLoading, isError } = useStudentListData({
    page,
    limit: pageSize,
    tab,
    sortBy,
    sortOrder,
    filters: { search: debouncedSearch || undefined },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Students</h1>
          <p className="text-muted">Manage enrollment...</p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button onClick={handleImport}>Import</Button>
          <Button onClick={handleCreate}>Add Student</Button>
        </div>
      </div>

      {/* Quick stats */}
      <StudentsQuickStatsSection />

      {/* Directory card */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle>Student Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <StudentsTabsNav value={tab} onChange={handleTabChange} />
          <StudentsToolbar {...toolbarProps} />
        </CardContent>
      </Card>

      {/* Data display */}
      <Card>
        <CardContent>
          {isLoading ? <LoadingState /> :
           isError ? <ErrorState /> :
           students.length === 0 ? <EmptyState /> :
           viewMode === "cards" ? <StudentsCardGrid /> : <StudentsTable />}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 0 && <StudentsPagination />}

      {/* Bulk actions */}
      {selectedIds.length > 0 && <StudentsBulkActionsBar />}

      {/* Command palette */}
      <StudentsCommandPalette />
    </div>
  );
}
```

### Card Component Pattern

```typescript
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { DropdownMenu } from "@/components/ui/dropdown-menu";

export function StudentCard({ student, onView, onEdit, ... }: StudentCardProps) {
  const tone = getFeeTone(student); // Determines color scheme

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border bg-linear-to-br",
        toneBg[tone],
        toneBorder[tone],
        "px-4 py-3 shadow-lg shadow-black/30 backdrop-blur-md",
        "transition-transform duration-150 hover:-translate-y-[2px]"
      )}
    >
      {/* Accent bar */}
      <div className={cn("absolute inset-y-0 left-0 w-1", toneAccent[tone])} />

      {/* Content */}
      <div className="flex items-start gap-3">
        <StudentAvatarStatus {...avatarProps} />
        <div className="flex-1">
          <h3>{student.fullName}</h3>
          <p>{classLabel}</p>
        </div>
        <DropdownMenu>
          {/* Actions */}
        </DropdownMenu>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <FeeStatusBadge />
        <AcademicBadgePill />
      </div>
    </div>
  );
}
```

### Toolbar Component Pattern

```typescript
"use client";

export function StudentsToolbar({
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onOpenFilters,
  onExportAll,
  searchInputRef,
}: StudentsToolbarProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      {/* Search */}
      <div className="w-full md:max-w-sm">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4" />
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name, ID..."
            className="pl-8"
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          Tip: Press <span className="rounded bg-white/10 px-1">/</span> to focus
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button onClick={onOpenFilters}>Filters</Button>
        <StudentsViewToggle value={viewMode} onChange={onViewModeChange} />
        <Button onClick={onExportAll}>Export</Button>
      </div>
    </div>
  );
}
```

### Quick Stats Pattern

```typescript
"use client";

import { MetricStatCard } from "../stats/MetricsStatCard";

export function StudentsQuickStatsSection() {
  const { data, isLoading } = useStudentStats();

  return (
    <section className="grid gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricStatCard
          label="Total Students"
          value={isLoading ? "…" : total.toLocaleString()}
          description={`${newThisMonth} new this month`}
          icon={<GraduationCap />}
          tone="blue"
          loading={isLoading}
        />
        {/* More cards */}
      </div>
    </section>
  );
}
```

---

## API Route Patterns

### List Endpoint Pattern

```typescript
// src/app/api/admin/students/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";

function parsePositiveInt(value: string | null, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  try {
    const { searchParams } = new URL(req.url);

    // Parse query params
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), 25), 100);
    const search = searchParams.get("search")?.trim() || "";
    const tab = searchParams.get("tab") || "all";
    const sortBy = searchParams.get("sortBy") || "name";
    const sortOrder = searchParams.get("sortOrder") || "asc";

    // Build query
    const query: Record<string, unknown> = { schoolId };
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      query.$or = [
        { firstName: regex },
        { lastName: regex },
        { admissionNo: regex },
      ];
    }

    // Build sort
    const sort: Record<string, 1 | -1> = {};
    switch (sortBy) {
      case "name":
        sort.lastName = sortOrder === "desc" ? -1 : 1;
        sort.firstName = sortOrder === "desc" ? -1 : 1;
        break;
      // ... other cases
    }

    const skip = (page - 1) * limit;

    // Fetch data
    const [items, total] = await Promise.all([
      Student.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("gradeId", "name")
        .populate("classGroupId", "name")
        .lean(),
      Student.countDocuments(query),
    ]);

    // Transform to DTOs
    const data: StudentListItem[] = items.map((s: any) => ({
      id: String(s._id),
      fullName: `${s.firstName} ${s.lastName}`,
      // ... map other fields
    }));

    return Response.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching students:", error);
    return Response.json(
      { error: "Failed to fetch students" },
      { status: 500 }
    );
  }
}
```

### Create Endpoint Pattern

```typescript
// src/app/api/admin/teachers/create/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import { recordActivity } from "@/lib/audit/recordActivity";

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const body = await req.json();

    // Validation
    if (!body.firstName?.trim() || !body.lastName?.trim() || !body.email?.trim()) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check duplicates
    const existingUser = await User.findOne({
      email: body.email.toLowerCase().trim(),
    }).lean();
    if (existingUser) {
      return Response.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Create user
    const teacherUser = new User({
      email: body.email.toLowerCase().trim(),
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      role: "teacher",
      schoolId,
    });
    await teacherUser.save();

    // Create teacher record
    const teacherRecord = new Teacher({
      schoolId,
      userId: teacherUser._id,
      subjectIds: body.subjectIds || [],
      homeroomClassGroupId: body.homeroomClassGroupId || null,
      status: body.status || "active",
    });
    await teacherRecord.save();

    // Record activity
    await recordActivity({
      schoolId,
      userId,
      type: "teacher.created",
      entityType: "teacher",
      entityId: String(teacherRecord._id),
      description: `Created teacher: ${body.firstName} ${body.lastName}`,
    });

    return Response.json({
      success: true,
      data: {
        _id: String(teacherRecord._id),
        // ... return data
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Teacher creation error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to create teacher" },
      { status: 500 }
    );
  }
}
```

---

## React Query Hooks

### List Hook Pattern

```typescript
// src/hooks/admin/useStudents.ts
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { StudentsTabId, StudentsSortBy, StudentsSortOrder } from "@/constants/students";

export type StudentsFilters = {
  search?: string;
  status?: StudentStatus | "all";
  // ... other filters
};

export type UseStudentsArgs = {
  page?: number;
  limit?: number;
  tab?: StudentsTabId;
  sortBy?: StudentsSortBy;
  sortOrder?: StudentsSortOrder;
  filters?: StudentsFilters;
};

export function useStudents({
  page = 1,
  limit = 25,
  tab = "all",
  sortBy = "name",
  sortOrder = "asc",
  filters = {},
}: UseStudentsArgs) {
  return useQuery<StudentListResponse>({
    queryKey: ["students", { page, limit, tab, sortBy, sortOrder, filters }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("tab", tab);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      if (filters.search) params.set("search", filters.search);
      // ... add other filters

      const res = await fetch(`/api/admin/students?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch students");
      return res.json();
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useStudentListData(args: UseStudentsArgs) {
  const { data, isLoading, isError, error } = useStudents(args);
  return {
    students: (data?.data ?? []) as StudentListItem[],
    pagination: data?.pagination ?? {
      page: args.page ?? 1,
      limit: args.limit ?? 25,
      total: 0,
      totalPages: 0,
    },
    isLoading,
    isError,
    error,
  };
}
```

### Stats Hook Pattern

```typescript
// src/hooks/admin/useStudentStats.ts
import { useQuery } from "@tanstack/react-query";

export function useStudentStats() {
  return useQuery<StudentQuickStats>({
    queryKey: ["students", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/students/stats", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    staleTime: 60_000, // 1 minute
  });
}
```

---

## Type Definitions

### List Item Type Pattern

```typescript
// src/types/admin/student.ts
export type StudentStatus = "active" | "inactive" | "withdrawn";
export type FeeStatus = "none" | "cleared" | "owing" | "partial" | "unknown";

export type StudentListItem = {
  id: string;
  admissionNumber: string | null;
  firstName: string;
  middleName: string;
  fullName: string;
  sex: "male" | "female";
  photoUrl: string | null;

  gradeId: string | null;
  gradeName: string | null;
  classGroupId: string | null;
  classGroupName: string | null;

  status: StudentStatus;
  enrolledAt: string | null;
  createdAt: string;

  feeStatus: FeeStatus;
  amountOwed: number | null;
  lastPaymentAt: string | null;

  academicBadge: AcademicBadge;
  latestAverage: number | null;
  isTopPerformer: boolean;

  isNew: boolean;
};

export type StudentListResponse = {
  success: boolean;
  data: StudentListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
```

---

## Constants & Configuration

### Constants File Pattern

```typescript
// src/constants/students.ts
export type StudentsTabId =
  | "all"
  | "by-class"
  | "fee-defaulters"
  | "top-performers"
  | "recent";

export const STUDENT_TABS: {
  id: StudentsTabId;
  label: string;
  description: string;
}[] = [
  {
    id: "all",
    label: "All Students",
    description: "Full directory of enrolled students.",
  },
  {
    id: "by-class",
    label: "By Class",
    description: "Browse students grouped by class.",
  },
  // ... more tabs
];

export type StudentsSortBy =
  | "name"
  | "class"
  | "feeStatus"
  | "academic"
  | "enrollmentDate"
  | "createdAt";

export type StudentsSortOrder = "asc" | "desc";

export const DEFAULT_STUDENTS_PAGE_SIZE = 25;
export const STUDENTS_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
```

---

## Design System & Styling

### Card Styling Pattern

Cards use a premium glassmorphism design:

```typescript
className={cn(
  "relative overflow-hidden border border-white/10",
  "bg-linear-to-br from-white/5 to-transparent",
  "shadow-lg shadow-black/20 backdrop-blur"
)}
```

### Color Tones

The app uses tone-based color schemes:

```typescript
const toneBorder: Record<FeeTone, string> = {
  neutral: "border-white/10",
  success: "border-emerald-400/40",
  danger: "border-red-400/40",
  warning: "border-amber-400/40",
  info: "border-blue-400/40",
  muted: "border-slate-500/40",
};

const toneBg: Record<FeeTone, string> = {
  neutral: "from-white/5 via-white/0 to-transparent",
  success: "from-emerald-500/12 via-emerald-500/5 to-transparent",
  danger: "from-red-500/12 via-red-500/5 to-transparent",
  // ...
};
```

### UI Components

The app uses shadcn/ui components:
- `Button` - with variants: default, outline, ghost, destructive
- `Card` - CardHeader, CardContent, CardTitle
- `Input` - with search icon support
- `Dialog` - for modals
- `DropdownMenu` - for action menus
- `Badge` - for status indicators
- `Avatar` - with fallback initials
- `Select` - for dropdowns

### Typography

- Headings: `text-3xl font-bold` (h1), `text-2xl font-bold` (h2)
- Body: `text-sm` (default), `text-xs` (small)
- Muted: `text-muted-foreground`
- Labels: `text-xs font-medium uppercase tracking-wide`

### Spacing

- Cards: `space-y-6` (between major sections)
- Card content: `p-6` or `px-4 py-3`
- Gaps: `gap-2`, `gap-3`, `gap-4`
- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4`

---

## Database Models

### Model Pattern

```typescript
// src/models/Teacher.ts
import { Schema, model, models } from "mongoose";

export interface ITeacher {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  schoolId: Types.ObjectId;
  subjectIds: Types.ObjectId[];
  homeroomClassGroupId?: Types.ObjectId | null;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const teacherSchema = new Schema<ITeacher>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    subjectIds: [{ type: Schema.Types.ObjectId, ref: "Subject", default: [] }],
    homeroomClassGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      default: null,
    },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

// Indexes
teacherSchema.index({ schoolId: 1, userId: 1 }, { unique: true });

export const Teacher =
  models.Teacher || model<ITeacher>("Teacher", teacherSchema);
```

### Database Connection

```typescript
// src/db/connectToDatabase.ts
import mongoose from "mongoose";

let connPromise: Promise<typeof mongoose> | null = null;

export async function connectToDatabase(uri?: string) {
  const MONGODB_URI = uri ?? process.env.MONGODB_URI;
  if (!MONGODB_URI) throw new Error("MONGODB_URI not defined");

  if (mongoose.connection.readyState === 1) return mongoose;
  if (connPromise) return connPromise;

  connPromise = mongoose.connect(MONGODB_URI, {
    autoIndex: true,
    dbName: process.env.MONGO_DB_NAME || undefined,
  });

  return connPromise;
}
```

---

## Authentication & Authorization

### Auth Pattern

```typescript
// src/lib/auth/requireSchoolAdmin.ts
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";
import { NextResponse } from "next/server";

export async function requireSchoolAdmin() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId)
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDatabase();
  const userRaw = await User.findOne({ clerkUserId }).lean();
  const user = Array.isArray(userRaw) ? userRaw[0] : userRaw;
  if (!user)
    throw NextResponse.json({ error: "User not found" }, { status: 401 });

  // Check membership
  let membership = await UserMembership.findOne({
    userId: user._id,
    schoolId: user.schoolId,
  });

  const roles = membership?.roles || [];
  const isAdmin = roles.includes("school_admin");
  if (!isAdmin)
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return { userId: user._id, schoolId: user.schoolId };
}
```

---

## State Management

### URL State Sync

State is synced with URL search params:

```typescript
React.useEffect(() => {
  const params = new URLSearchParams();
  params.set("tab", tab);
  params.set("view", viewMode);
  if (debouncedSearch) params.set("q", debouncedSearch);
  params.set("page", String(page));
  router.replace(`/admin/students?${params.toString()}`);
}, [tab, viewMode, debouncedSearch, page, router]);
```

### Debounced Search

```typescript
// src/hooks/useDebouncedValue.ts
export function useDebouncedValue<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
```

---

## Error Handling

### API Error Handling

```typescript
try {
  // ... operation
} catch (error) {
  console.error("Error:", error);

  // Handle specific errors
  if (error?.code === 11000) {
    return Response.json(
      { error: "Duplicate entry" },
      { status: 400 }
    );
  }

  return Response.json(
    { error: error instanceof Error ? error.message : "Failed" },
    { status: 500 }
  );
}
```

### Component Error States

```typescript
{isLoading ? (
  <div className="flex flex-col items-center justify-center gap-3 py-12">
    <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
    <p className="text-sm text-muted-foreground">Loading...</p>
  </div>
) : isError ? (
  <div className="flex flex-col items-center justify-center gap-3 py-12">
    <AlertCircle className="h-8 w-8 text-red-400/60" />
    <p className="text-sm text-red-300/80">Error loading data</p>
  </div>
) : items.length === 0 ? (
  <div className="flex flex-col items-center justify-center gap-3 py-12">
    <Icon className="h-12 w-12 text-muted-foreground/40" />
    <p className="text-sm font-medium text-muted-foreground">No items found</p>
  </div>
) : (
  // Render data
)}
```

---

## Utility Functions

### Common Utilities

```typescript
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Escape regex for search
export function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Parse positive integer
export function parsePositiveInt(value: string | null, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}
```

---

## Key Patterns to Follow

### 1. File Naming
- Components: PascalCase (e.g., `TeachersTable.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useTeachers.ts`)
- Types: camelCase (e.g., `teacher.ts`)
- Constants: camelCase (e.g., `teachers.ts`)
- API routes: `route.ts` in folder

### 2. Component Structure
```typescript
"use client"; // Always at top for client components

import * as React from "react";
import { cn } from "@/lib/utils";
// ... other imports

type ComponentProps = {
  // Props
};

export function Component({ ... }: ComponentProps) {
  // Hooks
  // State
  // Effects
  // Handlers
  // Render
}
```

### 3. API Response Format
```typescript
{
  success: boolean;
  data: T | T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}
```

### 4. Query Key Structure
```typescript
queryKey: ["teachers", { page, limit, tab, sortBy, sortOrder, filters }]
```

### 5. Loading States
- Use `keepPreviousData` for pagination
- Use `staleTime` to control refetch frequency
- Show loading indicators with `isLoading`

### 6. Empty States
- Always provide helpful empty states
- Include action buttons when appropriate
- Use appropriate icons

### 7. Accessibility
- Use semantic HTML
- Add ARIA labels where needed
- Support keyboard navigation
- Ensure proper focus management

### 8. Responsive Design
- Mobile-first approach
- Use Tailwind breakpoints: `md:`, `lg:`, `xl:`, `2xl:`
- Hide/show elements based on screen size
- Stack vertically on mobile, horizontal on desktop

### 9. Performance
- Use `React.useMemo` for expensive computations
- Use `React.useCallback` for event handlers passed to children
- Lazy load heavy components
- Debounce search inputs

### 10. Code Organization
- Keep components focused and single-purpose
- Extract reusable logic into hooks
- Use TypeScript strictly
- Follow existing patterns consistently

---

## Example: Complete Teacher List Implementation

For reference, here's how a complete teacher list page should be structured following all these patterns:

1. **Page**: `src/app/(app)/admin/teachers/page.tsx` - Main page component
2. **Components**:
   - `TeachersToolbar.tsx` - Search and filters
   - `TeachersTabsNav.tsx` - Tab navigation
   - `TeachersTable.tsx` - Table view
   - `TeachersCardGrid.tsx` - Card view
   - `TeacherCard.tsx` - Individual card
   - `TeachersQuickStatsSection.tsx` - Stats cards
   - `TeachersBulkActionsBar.tsx` - Bulk actions
   - `TeachersCommandPalette.tsx` - Command palette
   - `TeachersPagination.tsx` - Pagination
3. **Hooks**: `src/hooks/admin/useTeachers.ts` - Data fetching
4. **Types**: `src/types/admin/teacher.ts` - TypeScript types
5. **Constants**: `src/constants/teachers.ts` - Constants
6. **API**: `src/app/api/admin/teachers/route.ts` - List endpoint

---

## Additional Notes

- Always use `"use client"` for components that use hooks or interactivity
- Use `NextRequest` and `NextResponse` for API routes
- Always call `connectToDatabase()` before database operations
- Use `requireSchoolAdmin()` for protected endpoints
- Follow the exact styling patterns from students page
- Maintain consistency with existing component structure
- Use the same error handling patterns
- Follow the same loading state patterns
- Use the same empty state patterns

This context should provide everything needed to build a world-class teachers page that matches the quality and patterns of the existing students page.
