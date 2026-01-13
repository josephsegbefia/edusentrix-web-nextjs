// src/hooks/admin/useClasses.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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

/**
 * Hook to fetch all classes
 */
export function useClasses(search?: string, gradeId?: string, isActive?: boolean) {
  return useQuery<ClassesResponse>({
    queryKey: ["classes", search, gradeId, isActive],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (gradeId) params.set("gradeId", gradeId);
      if (isActive !== undefined) params.set("isActive", String(isActive));

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
        const error = await res.json().catch(() => ({ error: "Failed to assign homeroom teacher" }));
        throw new Error(error.error || "Failed to assign homeroom teacher");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
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
        const error = await res.json().catch(() => ({ error: "Failed to assign subjects" }));
        throw new Error(error.error || "Failed to assign subjects");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
  });
}
