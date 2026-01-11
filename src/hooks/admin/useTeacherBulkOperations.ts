// src/hooks/admin/useTeacherBulkOperations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";

export type BulkAssignSubjectsInput = {
  teacherIds: string[];
  subjectIds: string[];
};

export type BulkAssignSubjectsResponse = {
  success: boolean;
  message: string;
  data: {
    teachersProcessed: number;
    results: Array<{
      teacherId: string;
      success: boolean;
      subjectsAdded: number;
      message?: string;
    }>;
  };
};

export type BulkChangeStatusInput = {
  teacherIds: string[];
  status: "active" | "inactive" | "on_leave" | "terminated";
};

export type BulkChangeStatusResponse = {
  success: boolean;
  message: string;
  data: {
    teachersProcessed: number;
    status: string;
  };
};

/**
 * useBulkAssignSubjects - Mutation hook for bulk assigning subjects to teachers
 */
export function useBulkAssignSubjects() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      payload: BulkAssignSubjectsInput
    ): Promise<BulkAssignSubjectsResponse> => {
      const res = await fetch("/api/admin/teachers/bulk-assign-subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to assign subjects" }));
        throw new Error(error.error || "Failed to assign subjects");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
  });
}

/**
 * useBulkChangeStatus - Mutation hook for bulk changing teacher status
 */
export function useBulkChangeStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      payload: BulkChangeStatusInput
    ): Promise<BulkChangeStatusResponse> => {
      const res = await fetch("/api/admin/teachers/bulk-change-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to change status" }));
        throw new Error(error.error || "Failed to change status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
  });
}

/**
 * useBulkExportTeachers - Mutation hook for exporting teachers as CSV
 */
export function useBulkExportTeachers() {
  return useMutation({
    mutationFn: async (payload: { teacherIds?: string[]; filters?: Record<string, unknown> }): Promise<Blob> => {
      const res = await fetch("/api/admin/teachers/bulk-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to export teachers" }));
        throw new Error(error.error || "Failed to export teachers");
      }
      return res.blob();
    },
  });
}
