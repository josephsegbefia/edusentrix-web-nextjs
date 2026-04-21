// src/hooks/admin/useTeachers.ts
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { invalidateSetupReadiness } from "@/lib/query/invalidate-setup-readiness";
import type {
  TeacherListResponse,
  TeacherDetailResponse,
} from "@/types/admin/teacher";
import type { CreateTeacherInput, UpdateTeacherInput } from "@/schemas/teacher";
import type {
  TeachersTabId,
  TeachersSortBy,
  TeachersSortOrder,
} from "@/constants/teachers";

export type TeachersFilters = {
  search?: string;
  subjectId?: string;
  classGroupId?: string; // (reserved for future "teaches class group" when TeacherAssignment lands)
  department?: string;
};

export type UseTeachersArgs = {
  page?: number;
  limit?: number;
  tab?: TeachersTabId;
  sortBy?: TeachersSortBy;
  sortOrder?: TeachersSortOrder;
  filters?: TeachersFilters;
};

export function useTeachers({
  page = 1,
  limit = 25,
  tab = "all",
  sortBy = "name",
  sortOrder = "asc",
  filters = {},
}: UseTeachersArgs) {
  return useQuery<TeacherListResponse>({
    queryKey: ["teachers", { page, limit, tab, sortBy, sortOrder, filters }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("tab", tab);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      if (filters.search) params.set("search", filters.search);
      if (filters.subjectId) params.set("subjectId", filters.subjectId);
      if (filters.classGroupId)
        params.set("classGroupId", filters.classGroupId);
      if (filters.department) params.set("department", filters.department);

      const res = await fetch(`/api/admin/teachers?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch teachers");
      return res.json();
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useTeacher(teacherId: string) {
  return useQuery<TeacherDetailResponse>({
    queryKey: ["teachers", "detail", teacherId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/teachers/${teacherId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch teacher detail");
      return res.json();
    },
    enabled: !!teacherId,
    staleTime: 30_000,
  });
}

export function useTeacherListData(args: UseTeachersArgs) {
  const { data, isLoading, isError, error } = useTeachers(args);

  return {
    teachers: data?.data ?? [],
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

export function useCreateTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTeacherInput): Promise<void> => {
      const res = await fetch("/api/admin/teachers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to create teacher" }));
        throw new Error(error.error || "Failed to create teacher");
      }
    },
    onSuccess: () => {
      // Invalidate teachers list queries
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      invalidateSetupReadiness(queryClient);
    },
  });
}

/**
 * useUpdateTeacher - Mutation hook for updating teacher information
 */
export function useUpdateTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teacherId,
      payload,
    }: {
      teacherId: string;
      payload: UpdateTeacherInput;
    }): Promise<TeacherDetailResponse> => {
      const res = await fetch(`/api/admin/teachers/${teacherId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to update teacher" }));
        throw new Error(error.error || "Failed to update teacher");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      // Invalidate teachers list and detail queries
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({ queryKey: ["teachers", "detail", variables.teacherId] });
      // Also invalidate stats
      queryClient.invalidateQueries({ queryKey: ["teachers", "stats"] });
    },
  });
}

type SuggestEmployeeIdResponse = {
  success: boolean;
  employeeId: string;
  length: number;
};

export function useSuggestEmployeeId() {
  return useMutation({
    mutationFn: async (length: 5 | 6): Promise<SuggestEmployeeIdResponse> => {
      const res = await fetch(
        `/api/admin/teachers/suggest-employee-id?length=${length}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to generate ID" }));
        throw new Error(err.error || "Failed to generate employee ID");
      }
      return res.json();
    },
  });
}

// ============== STATUS MANAGEMENT HOOKS ==============

type StatusChangeResponse = {
  success: boolean;
  message: string;
  data: { id: string; status: string };
};

type StartLeaveResponse = {
  success: boolean;
  message: string;
  data: {
    id: string;
    status: "on_leave";
    leaveStartDate: string;
    leaveEndDate: string;
    leaveReason: string | null;
  };
};

/**
 * useActivateTeacher - Mutation hook for activating a teacher
 */
export function useActivateTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teacherId: string): Promise<StatusChangeResponse> => {
      const res = await fetch(`/api/admin/teachers/${teacherId}/activate`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to activate teacher" }));
        throw new Error(error.error || "Failed to activate teacher");
      }
      return res.json();
    },
    onSuccess: (_data, teacherId) => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({ queryKey: ["teachers", "detail", teacherId] });
      queryClient.invalidateQueries({ queryKey: ["teachers", "stats"] });
    },
  });
}

/**
 * useDeactivateTeacher - Mutation hook for deactivating a teacher
 */
export function useDeactivateTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teacherId: string): Promise<StatusChangeResponse> => {
      const res = await fetch(`/api/admin/teachers/${teacherId}/deactivate`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to deactivate teacher" }));
        throw new Error(error.error || "Failed to deactivate teacher");
      }
      return res.json();
    },
    onSuccess: (_data, teacherId) => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({ queryKey: ["teachers", "detail", teacherId] });
      queryClient.invalidateQueries({ queryKey: ["teachers", "stats"] });
    },
  });
}

/**
 * useDeleteTeacher - Mutation hook for soft-deleting (terminating) a teacher
 */
export function useDeleteTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teacherId: string): Promise<StatusChangeResponse> => {
      const res = await fetch(`/api/admin/teachers/${teacherId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to terminate teacher" }));
        throw new Error(error.error || "Failed to terminate teacher");
      }
      return res.json();
    },
    onSuccess: (_data, teacherId) => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({ queryKey: ["teachers", "detail", teacherId] });
      queryClient.invalidateQueries({ queryKey: ["teachers", "stats"] });
      // Also invalidate assignments as they get deactivated
      queryClient.invalidateQueries({ queryKey: ["teachers", "assignments", teacherId] });
    },
  });
}

/**
 * useStartTeacherLeave - Mutation hook for starting a teacher leave period
 */
export function useStartTeacherLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teacherId,
      startDate,
      endDate,
      reason,
    }: {
      teacherId: string;
      startDate: string;
      endDate: string;
      reason?: string;
    }): Promise<StartLeaveResponse> => {
      const res = await fetch(`/api/admin/teachers/${teacherId}/leave/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate,
          reason: reason?.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ error: "Failed to start teacher leave period" }));
        throw new Error(error.error || "Failed to start teacher leave period");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({
        queryKey: ["teachers", "detail", variables.teacherId],
      });
      queryClient.invalidateQueries({ queryKey: ["teachers", "stats"] });
    },
  });
}

/**
 * useUpdateTeacherLeave - Mutation hook for updating a teacher's leave dates
 */
export function useUpdateTeacherLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teacherId,
      startDate,
      endDate,
      reason,
    }: {
      teacherId: string;
      startDate: string;
      endDate: string;
      reason?: string;
    }): Promise<{ success: boolean; data: unknown }> => {
      const res = await fetch(`/api/admin/teachers/${teacherId}/leave/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate,
          reason: reason?.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ error: "Failed to update teacher leave period" }));
        throw new Error(error.error || "Failed to update teacher leave period");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({
        queryKey: ["teachers", "detail", variables.teacherId],
      });
      queryClient.invalidateQueries({ queryKey: ["teachers", "stats"] });
    },
  });
}

// ============== SUBJECT & HOMEROOM MANAGEMENT HOOKS ==============

export type TeacherSubjectDTO = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
};

export type TeacherSubjectsResponse = {
  success: boolean;
  data: TeacherSubjectDTO[];
};

export type AssignSubjectsResponse = {
  success: boolean;
  message: string;
  data: {
    added: number;
    subjectNames: string[];
  };
};

export type RemoveSubjectResponse = {
  success: boolean;
  message: string;
  data: {
    subjectId: string;
    subjectName: string;
  };
};

/**
 * useTeacherSubjects - Query hook for fetching teacher's subjects
 */
export function useTeacherSubjects(teacherId: string) {
  return useQuery<TeacherSubjectsResponse>({
    queryKey: ["teachers", "subjects", teacherId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/teachers/${teacherId}/subjects`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch teacher subjects");
      return res.json();
    },
    enabled: !!teacherId,
    staleTime: 30_000,
  });
}

/**
 * useAssignSubjects - Mutation hook for assigning subjects to a teacher
 */
export function useAssignSubjects() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teacherId,
      subjectIds,
    }: {
      teacherId: string;
      subjectIds: string[];
    }): Promise<AssignSubjectsResponse> => {
      const res = await fetch(`/api/admin/teachers/${teacherId}/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectIds }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to assign subjects" }));
        throw new Error(error.error || "Failed to assign subjects");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teachers", "subjects", variables.teacherId] });
      queryClient.invalidateQueries({ queryKey: ["teachers", "detail", variables.teacherId] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
  });
}

/**
 * useRemoveSubject - Mutation hook for removing a subject from a teacher
 */
export function useRemoveSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teacherId,
      subjectId,
    }: {
      teacherId: string;
      subjectId: string;
    }): Promise<RemoveSubjectResponse> => {
      const res = await fetch(
        `/api/admin/teachers/${teacherId}/subjects/${subjectId}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to remove subject" }));
        throw new Error(error.error || "Failed to remove subject");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teachers", "subjects", variables.teacherId] });
      queryClient.invalidateQueries({ queryKey: ["teachers", "detail", variables.teacherId] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
  });
}

export type TeacherHomeroomResponse = {
  success: boolean;
  data: {
    id: string;
    name: string;
    gradeName: string | null;
  } | null;
};

export type AssignHomeroomResponse = {
  success: boolean;
  message: string;
  data: {
    id: string;
    name: string;
    gradeName: string | null;
  };
};

export type RemoveHomeroomResponse = {
  success: boolean;
  message: string;
  data: {
    classGroupId: string;
    className: string;
  };
};

/**
 * useTeacherHomeroom - Query hook for fetching teacher's homeroom
 */
export function useTeacherHomeroom(teacherId: string) {
  return useQuery<TeacherHomeroomResponse>({
    queryKey: ["teachers", "homeroom", teacherId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/teachers/${teacherId}/homeroom`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch teacher homeroom");
      return res.json();
    },
    enabled: !!teacherId,
    staleTime: 30_000,
  });
}

/**
 * useAssignHomeroom - Mutation hook for assigning homeroom to a teacher
 */
export function useAssignHomeroom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teacherId,
      classGroupId,
      replaceExisting,
    }: {
      teacherId: string;
      classGroupId: string;
      replaceExisting?: boolean;
    }): Promise<AssignHomeroomResponse> => {
      const res = await fetch(`/api/admin/teachers/${teacherId}/homeroom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classGroupId,
          ...(replaceExisting ? { replaceExisting: true } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = Object.assign(
          new Error(
            typeof json?.error === "string"
              ? json.error
              : "Failed to assign homeroom"
          ),
          { status: res.status, meta: json as Record<string, unknown> }
        );
        throw err;
      }
      return json as AssignHomeroomResponse;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teachers", "homeroom", variables.teacherId] });
      queryClient.invalidateQueries({ queryKey: ["teachers", "detail", variables.teacherId] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["classGroups"] });
    },
  });
}

/**
 * useRemoveHomeroom - Mutation hook for removing homeroom from a teacher
 */
export function useRemoveHomeroom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teacherId: string): Promise<RemoveHomeroomResponse> => {
      const res = await fetch(`/api/admin/teachers/${teacherId}/homeroom`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to remove homeroom" }));
        throw new Error(error.error || "Failed to remove homeroom");
      }
      return res.json();
    },
    onSuccess: (_data, teacherId) => {
      queryClient.invalidateQueries({ queryKey: ["teachers", "homeroom", teacherId] });
      queryClient.invalidateQueries({ queryKey: ["teachers", "detail", teacherId] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
  });
}
