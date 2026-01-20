// src/hooks/admin/useTeacherAssignments.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type TeacherAssignmentDTO = {
  id: string;
  academicPeriodId: string;
  subject: { id: string; name: string } | null;
  classGroup: {
    id: string;
    name: string;
    gradeName?: string | null;
    label?: string | null;
  } | null;
  schedule: {
    dayOfWeek: number | null;
    startTime: string | null;
    endTime: string | null;
    location: string | null;
  } | null;
  workloadHours: number;
  status: "active" | "inactive";
  notes: string | null;
  assignedBy: string | null;
  assignedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TeacherAssignmentsResponse = {
  success: true;
  data: TeacherAssignmentDTO[];
};

export type CreateTeacherAssignmentInput = {
  academicPeriodId: string;
  subjectId: string;
  classGroupId: string;
  status?: "active" | "inactive";
  workloadHours?: number;
  notes?: string;
  schedule?: {
    dayOfWeek?: number;
    startTime?: string;
    endTime?: string;
    location?: string;
  };
};

export type CreateTeacherAssignmentResponse = {
  success: true;
  data: { id: string };
  warnings?: string[];
};

export function useTeacherAssignments(
  teacherId: string,
  academicPeriodId?: string,
  status: "active" | "inactive" | "all" = "active"
) {
  return useQuery<TeacherAssignmentsResponse>({
    queryKey: [
      "teachers",
      "assignments",
      teacherId,
      { academicPeriodId: academicPeriodId || "", status },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (academicPeriodId) params.set("academicPeriodId", academicPeriodId);
      if (status) params.set("status", status);

      const res = await fetch(
        `/api/admin/teachers/${teacherId}/assignments?${params.toString()}`,
        {
          cache: "no-store",
        }
      );
      if (!res.ok) throw new Error("Failed to fetch teacher assignments");
      return res.json();
    },
    enabled: !!teacherId,
    staleTime: 30_000,
  });
}

export function useCreateTeacherAssignment(teacherId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      payload: CreateTeacherAssignmentInput
    ): Promise<CreateTeacherAssignmentResponse> => {
      const res = await fetch(`/api/admin/teachers/${teacherId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        // preserve structured details for UI (conflicts, etc.)
        const err = Object.assign(
          new Error(json?.error || "Failed to create assignment"),
          {
            status: res.status,
            meta: json,
          }
        );
        throw err;
      }

      return json as CreateTeacherAssignmentResponse;
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["teachers", "assignments", teacherId],
      });
      qc.invalidateQueries({ queryKey: ["teachers", "detail", teacherId] }); // subjects may get auto-added
    },
  });
}

export function useDeactivateTeacherAssignment(teacherId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await fetch(
        `/api/admin/teachers/${teacherId}/assignments/${assignmentId}`,
        {
          method: "DELETE",
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(json?.error || "Failed to deactivate assignment");
      return json as { success: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["teachers", "assignments", teacherId],
      });
    },
  });
}

export type UpdateTeacherAssignmentInput = {
  subjectId?: string;
  classGroupId?: string;
  academicPeriodId?: string;
  status?: "active" | "inactive";
  schedules?: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    location?: string;
  }> | null;
  workloadHours?: number;
  notes?: string | null;
};

export type UpdateTeacherAssignmentResponse = {
  success: true;
  data: { id: string };
  warnings?: string[];
};

export function useUpdateTeacherAssignment(teacherId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      assignmentId,
      payload,
    }: {
      assignmentId: string;
      payload: UpdateTeacherAssignmentInput;
    }): Promise<UpdateTeacherAssignmentResponse> => {
      const res = await fetch(
        `/api/admin/teachers/${teacherId}/assignments/${assignmentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        // preserve structured details for UI (conflicts, etc.)
        const err = Object.assign(
          new Error(json?.error || "Failed to update assignment"),
          {
            status: res.status,
            meta: json,
          }
        );
        throw err;
      }

      return json as UpdateTeacherAssignmentResponse;
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["teachers", "assignments", teacherId],
      });
      qc.invalidateQueries({ queryKey: ["teachers", "detail", teacherId] });
    },
  });
}
