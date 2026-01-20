// src/hooks/admin/useClasses.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ClassesSortBy, ClassesSortOrder } from "@/constants/classes";

export type ClassGroupDTO = {
  id: string;
  name: string;
  fullLabel: string;
  grade: {
    id: string;
    name: string;
    code: string | null;
    stage: string;
    order: number;
  };
  homeroomTeacher: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string | null;
    photoUrl: string | null;
  } | null;
  subjects: Array<{
    id: string;
    name: string;
    code: string | null;
  }>;
  studentCount: number;
  teacherCount: number;
  subjectCount: number;
  capacity: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClassesResponse = {
  success: boolean;
  data: ClassGroupDTO[];
  total?: number;
  error?: string;
};

export type AssignHomeroomResponse = {
  success: boolean;
  message: string;
  data: {
    id: string;
    name: string;
    homeroomTeacher: {
      id: string;
      firstName: string;
      lastName: string;
      fullName: string;
    } | null;
  };
};

export type AssignSubjectsResponse = {
  success: boolean;
  message: string;
  data: {
    id: string;
    name: string;
    subjects: Array<{
      id: string;
      name: string;
      code: string | null;
    }>;
  };
};

export type ClassesFilters = {
  search?: string;
  gradeId?: string;
  teacherId?: string;
  isActive?: boolean;
  sortBy?: ClassesSortBy;
  sortOrder?: ClassesSortOrder;
};

/**
 * Hook to fetch all classes with filters and sorting
 */
export function useClasses(filters: ClassesFilters = {}) {
  const { search, gradeId, teacherId, isActive, sortBy, sortOrder } = filters;

  return useQuery<ClassesResponse>({
    queryKey: ["classes", search, gradeId, teacherId, isActive, sortBy, sortOrder],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (gradeId) params.set("gradeId", gradeId);
      if (teacherId) params.set("teacherId", teacherId);
      if (isActive !== undefined) params.set("isActive", String(isActive));
      if (sortBy) params.set("sortBy", sortBy);
      if (sortOrder) params.set("sortOrder", sortOrder);

      const res = await fetch(`/api/admin/classes?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch classes");
      return res.json();
    },
    staleTime: 30_000,
  });
}

/**
 * Hook to fetch a single class detail
 */
export function useClassDetail(classId: string | undefined) {
  return useQuery({
    queryKey: ["class", classId],
    queryFn: async () => {
      if (!classId) throw new Error("Class ID is required");
      const res = await fetch(`/api/admin/classes/${classId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch class details");
      return res.json();
    },
    enabled: !!classId,
    staleTime: 30_000,
  });
}

/**
 * Hook to fetch teachers list for filter dropdown
 */
export function useTeachersForFilter() {
  return useQuery<{
    success: boolean;
    data: Array<{ id: string; fullName: string }>;
  }>({
    queryKey: ["teachers-filter"],
    queryFn: async () => {
      const res = await fetch("/api/admin/teachers?limit=200&sortBy=name&sortOrder=asc", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch teachers");
      const json = await res.json();
      // Map to simple format for filter dropdown
      const data = (json.data || []).map((t: { id: string; fullName: string }) => ({
        id: t.id,
        fullName: t.fullName,
      }));
      return { success: true, data };
    },
    staleTime: 60_000,
  });
}

/**
 * Hook to assign homeroom teacher to a class
 */
export function useAssignHomeroomTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      classId,
      teacherId,
    }: {
      classId: string;
      teacherId: string | null;
    }): Promise<AssignHomeroomResponse> => {
      const res = await fetch(`/api/admin/classes/${classId}/assign-homeroom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId }),
      });
      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ error: "Failed to assign homeroom teacher" }));
        throw new Error(error.error || "Failed to assign homeroom teacher");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["class"] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
  });
}

/**
 * Hook to assign subjects to a class
 */
export function useAssignSubjectsToClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      classId,
      subjectIds,
    }: {
      classId: string;
      subjectIds: string[];
    }): Promise<AssignSubjectsResponse> => {
      const res = await fetch(`/api/admin/classes/${classId}/assign-subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectIds }),
      });
      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ error: "Failed to assign subjects" }));
        throw new Error(error.error || "Failed to assign subjects");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["class"] });
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
  });
}

/**
 * Hook to add a student to a class
 */
export function useAddStudentToClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      classId,
      studentId,
    }: {
      classId: string;
      studentId: string;
    }) => {
      const res = await fetch(`/api/admin/classes/${classId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ error: "Failed to add student to class" }));
        throw new Error(error.error || "Failed to add student to class");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["class"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });
}
