// src/hooks/admin/useTeacherAttendance.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type TeacherAttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "on_leave"
  | "sick"
  | "other";

export type LeaveType = "sick" | "vacation" | "personal" | "professional" | "other";

export type TeacherAttendanceDTO = {
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
    email: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type TeacherAttendanceResponse = {
  success: boolean;
  data: TeacherAttendanceDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type RecordAttendanceInput = {
  date: string; // ISO date string or YYYY-MM-DD
  status: TeacherAttendanceStatus;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  minutesLate?: number | null;
  leaveType?: LeaveType | null;
  reason?: string | null;
  notes?: string | null;
};

export type RecordAttendanceResponse = {
  success: boolean;
  message: string;
  data: {
    id: string;
    date: string;
    status: TeacherAttendanceStatus;
  };
};

export type UpdateAttendanceInput = {
  status?: TeacherAttendanceStatus;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  minutesLate?: number | null;
  leaveType?: LeaveType | null;
  reason?: string | null;
  notes?: string | null;
};

export type UpdateAttendanceResponse = {
  success: boolean;
  message: string;
  data: {
    id: string;
  };
};

export type TeacherLeaveRequestDTO = {
  id: string;
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

export type LeaveRequestsResponse = {
  success: boolean;
  data: TeacherLeaveRequestDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type SubmitLeaveRequestInput = {
  startDate: string; // ISO date string or YYYY-MM-DD
  endDate: string;
  leaveType: LeaveType;
  reason: string;
  notes?: string | null;
};

export type SubmitLeaveRequestResponse = {
  success: boolean;
  message: string;
  data: {
    count: number;
    startDate: string;
    endDate: string;
    recordIds: string[];
  };
};

export type AttendanceFilters = {
  startDate?: string;
  endDate?: string;
  status?: TeacherAttendanceStatus;
  page?: number;
  limit?: number;
};

/**
 * useTeacherAttendance - Query hook for fetching teacher attendance records
 */
export function useTeacherAttendance(
  teacherId: string,
  filters?: AttendanceFilters
) {
  return useQuery<TeacherAttendanceResponse>({
    queryKey: [
      "teachers",
      "attendance",
      teacherId,
      filters || {},
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.set("startDate", filters.startDate);
      if (filters?.endDate) params.set("endDate", filters.endDate);
      if (filters?.status) params.set("status", filters.status);
      if (filters?.page) params.set("page", String(filters.page));
      if (filters?.limit) params.set("limit", String(filters.limit));

      const res = await fetch(
        `/api/admin/teachers/${teacherId}/attendance?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch teacher attendance");
      return res.json();
    },
    enabled: !!teacherId,
    staleTime: 30_000,
  });
}

/**
 * useRecordAttendance - Mutation hook for recording attendance
 */
export function useRecordAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teacherId,
      payload,
    }: {
      teacherId: string;
      payload: RecordAttendanceInput;
    }): Promise<RecordAttendanceResponse> => {
      const res = await fetch(`/api/admin/teachers/${teacherId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to record attendance" }));
        throw new Error(error.error || "Failed to record attendance");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["teachers", "attendance", variables.teacherId],
      });
      queryClient.invalidateQueries({
        queryKey: ["teachers", "detail", variables.teacherId],
      });
    },
  });
}

/**
 * useUpdateAttendance - Mutation hook for updating attendance
 */
export function useUpdateAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      attendanceId,
      payload,
    }: {
      attendanceId: string;
      payload: UpdateAttendanceInput;
    }): Promise<UpdateAttendanceResponse> => {
      const res = await fetch(`/api/admin/teachers/attendance/${attendanceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to update attendance" }));
        throw new Error(error.error || "Failed to update attendance");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      // Invalidate all attendance queries (we don't know teacherId from attendanceId)
      queryClient.invalidateQueries({ queryKey: ["teachers", "attendance"] });
      queryClient.invalidateQueries({ queryKey: ["teachers", "leave-requests"] });
    },
  });
}

/**
 * useLeaveRequests - Query hook for fetching leave requests
 */
export function useLeaveRequests(
  teacherId: string,
  status?: "pending" | "approved" | "rejected",
  page?: number,
  limit?: number
) {
  return useQuery<LeaveRequestsResponse>({
    queryKey: [
      "teachers",
      "leave-requests",
      teacherId,
      { status, page, limit },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (page) params.set("page", String(page));
      if (limit) params.set("limit", String(limit));

      const res = await fetch(
        `/api/admin/teachers/${teacherId}/leave-requests?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch leave requests");
      return res.json();
    },
    enabled: !!teacherId,
    staleTime: 30_000,
  });
}

/**
 * useSubmitLeaveRequest - Mutation hook for submitting leave request
 */
export function useSubmitLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teacherId,
      payload,
    }: {
      teacherId: string;
      payload: SubmitLeaveRequestInput;
    }): Promise<SubmitLeaveRequestResponse> => {
      const res = await fetch(`/api/admin/teachers/${teacherId}/leave-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to submit leave request" }));
        throw new Error(error.error || "Failed to submit leave request");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["teachers", "leave-requests", variables.teacherId],
      });
      queryClient.invalidateQueries({
        queryKey: ["teachers", "attendance", variables.teacherId],
      });
      queryClient.invalidateQueries({
        queryKey: ["teachers", "detail", variables.teacherId],
      });
    },
  });
}

/**
 * useApproveLeave - Mutation hook for approving leave request
 */
export function useApproveLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leaveRequestId: string): Promise<{ success: boolean; message: string; data: { id: string } }> => {
      const res = await fetch(
        `/api/admin/teachers/leave-requests/${leaveRequestId}/approve`,
        {
          method: "PATCH",
        }
      );
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to approve leave request" }));
        throw new Error(error.error || "Failed to approve leave request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers", "leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["teachers", "attendance"] });
    },
  });
}

/**
 * useRejectLeave - Mutation hook for rejecting leave request
 */
export function useRejectLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      leaveRequestId,
      rejectionReason,
    }: {
      leaveRequestId: string;
      rejectionReason?: string;
    }): Promise<{ success: boolean; message: string; data: { id: string } }> => {
      const res = await fetch(
        `/api/admin/teachers/leave-requests/${leaveRequestId}/reject`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rejectionReason }),
        }
      );
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to reject leave request" }));
        throw new Error(error.error || "Failed to reject leave request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers", "leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["teachers", "attendance"] });
    },
  });
}
