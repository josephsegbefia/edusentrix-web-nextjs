// src/hooks/admin/useSubjects.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBusyToast } from "@/hooks/useBusyToast";

export type SubjectDetailDTO = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  classCount: number;
  teacherCount: number;
  classes: Array<{
    id: string;
    name: string;
    fullLabel: string;
    grade: { id: string; name: string } | null;
  }>;
  teachers: Array<{
    assignmentId: string;
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string | null;
    photoUrl: string | null;
    classId: string;
    className: string;
  }>;
  currentPeriod: {
    id: string;
    yearLabel: string;
    term: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Hook to fetch a single subject detail
 */
export function useSubjectDetail(subjectId: string | undefined) {
  return useQuery<{ success: boolean; data: SubjectDetailDTO }>({
    queryKey: ["subject", subjectId],
    queryFn: async () => {
      if (!subjectId) throw new Error("Subject ID is required");
      const res = await fetch(`/api/admin/subjects/${subjectId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch subject details");
      return res.json();
    },
    enabled: !!subjectId,
    staleTime: 30_000,
  });
}

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

export type SubjectCategoryValue =
  | "core"
  | "elective"
  | "foundation"
  | "optional"
  | "transdisciplinary_theme"
  | "subject_group";

export type CreateSubjectPayload = {
  name: string;
  code?: string | null;
  category?: SubjectCategoryValue | null;
  isActive?: boolean;
};

export type CreateSubjectResponse = {
  success: boolean;
  data: {
    id: string;
    name: string;
    code: string | null;
    category: SubjectCategoryValue | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
};

export type UpdateSubjectPayload = {
  subjectId: string;
  name?: string;
  code?: string | null;
  isActive?: boolean;
};

export type UpdateSubjectResponse = {
  success: boolean;
  data: {
    id: string;
    name: string;
    code: string | null;
  };
};

export type AssignTeacherResponse = {
  success: boolean;
  message: string;
  warnings?: string[];
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
 * Hook to create a subject
 */
export function useCreateSubject() {
  const queryClient = useQueryClient();
  const busy = useBusyToast();

  return useMutation({
    mutationFn: async (payload: CreateSubjectPayload): Promise<CreateSubjectResponse> => {
      const res = await fetch("/api/admin/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as CreateSubjectResponse & { error?: string };

      if (!res.ok) {
        throw new Error(data.error || "Failed to create subject");
      }

      return data;
    },
    onMutate: () => {
      busy.toast("Creating subject…");
    },
    onSuccess: ({ data }) => {
      busy.success(`Subject "${data.name}" created`);
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
    onError: (error: unknown) => {
      busy.error(
        error instanceof Error ? error.message : "Failed to create subject"
      );
    },
  });
}

/**
 * Hook to update a subject
 */
export function useUpdateSubject() {
  const queryClient = useQueryClient();
  const busy = useBusyToast();

  return useMutation({
    mutationFn: async ({
      subjectId,
      ...payload
    }: UpdateSubjectPayload): Promise<UpdateSubjectResponse> => {
      const res = await fetch(`/api/admin/subjects/${subjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as UpdateSubjectResponse & { error?: string };

      if (!res.ok) {
        throw new Error(data.error || "Failed to update subject");
      }

      return data;
    },
    onMutate: () => {
      busy.toast("Updating subject…");
    },
    onSuccess: ({ data }) => {
      busy.success(`Subject "${data.name}" updated`);
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["subject", data.id] });
    },
    onError: (error: unknown) => {
      busy.error(
        error instanceof Error ? error.message : "Failed to update subject"
      );
    },
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["subject", variables.subjectId] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({ queryKey: ["teachers", "assignments"] });
      queryClient.invalidateQueries({ queryKey: ["teachers", "detail", variables.teacherId] });
    },
  });
}

/**
 * Hook to unassign a teacher from a subject in a class
 */
export function useUnassignTeacher(subjectId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentId: string): Promise<{ success: boolean }> => {
      const res = await fetch("/api/admin/subjects/unassign-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to unassign teacher");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      if (subjectId) {
        queryClient.invalidateQueries({ queryKey: ["subject", subjectId] });
      }
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({ queryKey: ["teachers", "assignments"] });
    },
  });
}
