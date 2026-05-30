import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ExamInvigilatorAssignmentDTO,
  ExamInvigilatorRole,
} from "@/types/academics/exam-scheduling-engine";

type ExamInvigilatorListResponse = {
  success: boolean;
  data: ExamInvigilatorAssignmentDTO[];
  error?: string;
};

type ExamInvigilatorResponse = {
  success: boolean;
  data: ExamInvigilatorAssignmentDTO;
  error?: string;
};

export type AssignExamInvigilatorInput = {
  examTimetableEntryId: string;
  teacherId: string;
  role?: ExamInvigilatorRole;
  notes?: string | null;
};

async function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export function useExamInvigilatorAssignments(
  sessionId: string | null,
  filters?: {
    entryId?: string | null;
    teacherId?: string | null;
    status?: string | null;
  }
) {
  return useQuery<ExamInvigilatorListResponse>({
    queryKey: [
      "examInvigilatorAssignments",
      sessionId,
      filters?.entryId ?? "all",
      filters?.teacherId ?? "all",
      filters?.status ?? "all",
    ],
    enabled: Boolean(sessionId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.entryId) params.set("entryId", filters.entryId);
      if (filters?.teacherId) params.set("teacherId", filters.teacherId);
      if (filters?.status) params.set("status", filters.status);

      const query = params.toString();
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId!)}/invigilators${
          query ? `?${query}` : ""
        }`,
        { cache: "no-store" }
      );
      const json = await parseJson<ExamInvigilatorListResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to fetch invigilator assignments");
      }
      return json;
    },
  });
}

export function useAssignExamInvigilator(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AssignExamInvigilatorInput) => {
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId)}/invigilators`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      const json = await parseJson<ExamInvigilatorResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to assign invigilator");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examInvigilatorAssignments", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["examConflictCheck", sessionId] });
    },
  });
}

export function useRemoveExamInvigilator(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId)}/invigilators/${encodeURIComponent(assignmentId)}`,
        { method: "DELETE" }
      );
      const json = await parseJson<{ success: boolean; error?: string }>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to remove invigilator");
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examInvigilatorAssignments", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["examConflictCheck", sessionId] });
    },
  });
}

export function useReplaceExamInvigilator(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      assignmentId: string;
      teacherId: string;
      role?: ExamInvigilatorRole;
      replacementReason?: string | null;
    }) => {
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId)}/invigilators/${encodeURIComponent(input.assignmentId)}/replace`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teacherId: input.teacherId,
            role: input.role,
            replacementReason: input.replacementReason ?? null,
          }),
        }
      );
      const json = await parseJson<{
        success: boolean;
        error?: string;
        data?: {
          assignment: ExamInvigilatorAssignmentDTO;
        };
      }>(res);
      if (!res.ok || !json.success || !json.data?.assignment) {
        throw new Error(json.error ?? "Failed to replace invigilator");
      }
      return json.data.assignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examInvigilatorAssignments", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["examConflictCheck", sessionId] });
    },
  });
}

export function useTeacherLabelMap(teacherIds: string[]) {
  const sortedKey = [...teacherIds].sort().join(",");

  return useQuery<Map<string, string>>({
    queryKey: ["teacherLabelMap", sortedKey],
    enabled: teacherIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const map = new Map<string, string>();
      await Promise.all(
        teacherIds.map(async (id) => {
          const res = await fetch(`/api/admin/teachers/${encodeURIComponent(id)}`, {
            cache: "no-store",
          });
          if (!res.ok) {
            map.set(id, "Teacher");
            return;
          }
          const json = (await res.json()) as {
            success?: boolean;
            data?: { fullName?: string };
          };
          map.set(id, json.data?.fullName?.trim() || "Teacher");
        })
      );
      return map;
    },
  });
}
