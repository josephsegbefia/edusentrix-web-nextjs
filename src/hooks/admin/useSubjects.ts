// src/hooks/admin/useSubjects.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type SubjectDTO = {
  id: string;
  name: string;
  code: string | null;
  classCount: number;
  teacherCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SubjectsResponse = {
  success: boolean;
  data: SubjectDTO[];
  error?: string;
};

export type AssignTeacherResponse = {
  success: boolean;
  message: string;
  data: {
    id: string;
    teacherId: string;
    subjectId: string;
    classGroupId: string;
    academicPeriodId: string;
    hasConflict: boolean;
  };
  conflict?: {
    type: string;
    message: string;
    existingTeacher: {
      id: string;
      name: string;
    };
  };
};

/**
 * Hook to fetch all subjects
 */
export function useSubjects(search?: string, isActive?: boolean) {
  return useQuery<SubjectsResponse>({
    queryKey: ["subjects", search, isActive],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (isActive !== undefined) params.set("isActive", String(isActive));

      const res = await fetch(`/api/admin/subjects?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch subjects");
      return res.json();
    },
    staleTime: 30_000,
  });
}

/**
 * Hook to assign a teacher to teach a subject in a class
 */
export function useAssignTeacherToSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teacherId,
      subjectId,
      classGroupId,
      academicPeriodId,
      workloadHours,
      notes,
      allowMultiple,
    }: {
      teacherId: string;
      subjectId: string;
      classGroupId: string;
      academicPeriodId?: string;
      workloadHours?: number;
      notes?: string;
      allowMultiple?: boolean;
    }): Promise<AssignTeacherResponse> => {
      const res = await fetch("/api/admin/subjects/assign-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          subjectId,
          classGroupId,
          academicPeriodId,
          workloadHours,
          notes,
          allowMultiple,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle conflict errors specially
        if (res.status === 409 && data.conflict) {
          throw new Error(data.conflict.message);
        }
        throw new Error(data.error || "Failed to assign teacher");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments"] });
    },
  });
}
