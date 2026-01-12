// src/hooks/admin/useTeacherAttendanceManagement.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { LeaveType } from "./useTeacherAttendance";

// Re-export the type so consumers can import from this module
export type TeacherAttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "on_leave"
  | "sick"
  | "other";

// ─────────────────────────────────────────────────────────────────────────────
// Types for Centralized Attendance Management
// ─────────────────────────────────────────────────────────────────────────────

export type TeacherAttendanceRecord = {
  id: string;
  date: string;
  status: TeacherAttendanceStatus;
  checkInTime: string | null;
  checkOutTime: string | null;
  minutesLate: number | null;
  leaveType: LeaveType | null;
  reason: string | null;
  notes: string | null;
  recordedBy: {
    id: string;
    name: string;
  } | null;
};

export type TeacherWithAttendance = {
  teacherId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  department: string | null;
  photoUrl: string | null;
  teacherStatus: "active" | "inactive" | "on_leave" | "terminated";
  attendance: TeacherAttendanceRecord | null;
};

export type DailyAttendanceResponse = {
  success: boolean;
  date: string;
  data: TeacherWithAttendance[];
  summary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    onLeave: number;
    notRecorded: number;
  };
};

export type BulkAttendanceInput = {
  date: string;
  records: Array<{
    teacherId: string;
    status: TeacherAttendanceStatus;
    checkInTime?: string | null;
    checkOutTime?: string | null;
    minutesLate?: number | null;
    leaveType?: LeaveType | null;
    reason?: string | null;
    notes?: string | null;
  }>;
};

export type BulkAttendanceResponse = {
  success: boolean;
  message: string;
  data: {
    date: string;
    processed: number;
    created: number;
    updated: number;
    errors: number;
    errorDetails?: Array<{ teacherId: string; error: string }>;
  };
};

export type LeaveRequestWithTeacher = {
  id: string;
  teacherId: string;
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string | null;
    department: string | null;
    photoUrl: string | null;
  } | null;
  date: string;
  leaveType: LeaveType;
  reason: string;
  notes: string | null;
  approvalStatus: "pending" | "approved" | "rejected";
  recordedBy: {
    id: string;
    name: string;
    email: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type AllLeaveRequestsResponse = {
  success: boolean;
  data: LeaveRequestWithTeacher[];
  summary: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Query Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useDailyAttendance - Fetch all teachers' attendance for a specific date
 */
export function useDailyAttendance(
  date: string,
  options?: {
    status?: TeacherAttendanceStatus;
    department?: string;
  }
) {
  return useQuery<DailyAttendanceResponse>({
    queryKey: ["teachers", "daily-attendance", date, options || {}],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("date", date);
      if (options?.status) params.set("status", options.status);
      if (options?.department) params.set("department", options.department);

      const res = await fetch(
        `/api/admin/teachers/attendance?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch daily attendance");
      return res.json();
    },
    enabled: !!date,
    staleTime: 30_000,
  });
}

/**
 * useAllLeaveRequests - Fetch all leave requests across all teachers
 */
export function useAllLeaveRequests(
  status?: "pending" | "approved" | "rejected",
  page?: number,
  limit?: number
) {
  return useQuery<AllLeaveRequestsResponse>({
    queryKey: ["teachers", "all-leave-requests", { status, page, limit }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (page) params.set("page", String(page));
      if (limit) params.set("limit", String(limit));

      const res = await fetch(
        `/api/admin/teachers/leave-requests?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch leave requests");
      return res.json();
    },
    staleTime: 30_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutation Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useBulkRecordAttendance - Record attendance for multiple teachers at once
 */
export function useBulkRecordAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      payload: BulkAttendanceInput
    ): Promise<BulkAttendanceResponse> => {
      const res = await fetch("/api/admin/teachers/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ error: "Failed to record attendance" }));
        throw new Error(error.error || "Failed to record attendance");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      // Invalidate daily attendance for the specific date
      queryClient.invalidateQueries({
        queryKey: ["teachers", "daily-attendance", variables.date],
      });
      // Also invalidate individual teacher attendance queries
      queryClient.invalidateQueries({
        queryKey: ["teachers", "attendance"],
      });
    },
  });
}

/**
 * useQuickMarkAttendance - Quick mark a single teacher's attendance
 */
export function useQuickMarkAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teacherId,
      date,
      status,
    }: {
      teacherId: string;
      date: string;
      status: TeacherAttendanceStatus;
    }): Promise<BulkAttendanceResponse> => {
      const res = await fetch("/api/admin/teachers/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          records: [{ teacherId, status }],
        }),
      });
      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ error: "Failed to record attendance" }));
        throw new Error(error.error || "Failed to record attendance");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["teachers", "daily-attendance", variables.date],
      });
      queryClient.invalidateQueries({
        queryKey: ["teachers", "attendance", variables.teacherId],
      });
    },
  });
}
