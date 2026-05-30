import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ExamInvigilatorAssignmentDTO,
  TeacherExamInvigilationDutyDTO,
  TeacherExamMarksPendingDTO,
  TeacherExamSummaryDTO,
  TeacherExamTimetableEntryDTO,
} from "@/types/academics/exam-scheduling-engine";

type TeacherExamListResponse<T> = {
  success: boolean;
  data: T;
  error?: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export function useTeacherExamSummary() {
  return useQuery<TeacherExamListResponse<TeacherExamSummaryDTO>>({
    queryKey: ["teacherExamSummary"],
    queryFn: async () => {
      const res = await fetch("/api/teacher/exams/summary", { cache: "no-store" });
      const json = await parseJson<TeacherExamListResponse<TeacherExamSummaryDTO>>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load exam summary");
      }
      return json;
    },
  });
}

export function useTeacherExamTimetable() {
  return useQuery<TeacherExamListResponse<TeacherExamTimetableEntryDTO[]>>({
    queryKey: ["teacherExamTimetable"],
    queryFn: async () => {
      const res = await fetch("/api/teacher/exams/timetable", { cache: "no-store" });
      const json = await parseJson<TeacherExamListResponse<TeacherExamTimetableEntryDTO[]>>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load exam timetable");
      }
      return json;
    },
  });
}

export function useTeacherInvigilationDuties() {
  return useQuery<TeacherExamListResponse<TeacherExamInvigilationDutyDTO[]>>({
    queryKey: ["teacherInvigilationDuties"],
    queryFn: async () => {
      const res = await fetch("/api/teacher/exams/invigilation-duties", { cache: "no-store" });
      const json = await parseJson<TeacherExamListResponse<TeacherExamInvigilationDutyDTO[]>>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load invigilation duties");
      }
      return json;
    },
  });
}

export function useTeacherExamMarksPending() {
  return useQuery<TeacherExamListResponse<TeacherExamMarksPendingDTO[]>>({
    queryKey: ["teacherExamMarksPending"],
    queryFn: async () => {
      const res = await fetch("/api/teacher/exams/marks-pending", { cache: "no-store" });
      const json = await parseJson<TeacherExamListResponse<TeacherExamMarksPendingDTO[]>>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load marks pending");
      }
      return json;
    },
  });
}

export function useAcknowledgeInvigilationDuty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await fetch(
        `/api/teacher/exams/invigilators/${encodeURIComponent(assignmentId)}/acknowledge`,
        { method: "POST" }
      );
      const json = await parseJson<{
        success: boolean;
        data: ExamInvigilatorAssignmentDTO;
        error?: string;
      }>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to acknowledge duty");
      }
      return json.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["teacherInvigilationDuties"] });
      void queryClient.invalidateQueries({ queryKey: ["teacherExamSummary"] });
    },
  });
}

export function useMarkExamStarted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryId: string) => {
      const res = await fetch(
        `/api/teacher/exams/entries/${encodeURIComponent(entryId)}/start`,
        { method: "POST" }
      );
      const json = await parseJson<{ success: boolean; error?: string }>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to mark exam as started");
      }
      return json;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["teacherInvigilationDuties"] });
      void queryClient.invalidateQueries({ queryKey: ["teacherExamTimetable"] });
      void queryClient.invalidateQueries({ queryKey: ["teacherExamMarksPending"] });
    },
  });
}

export function useMarkExamCompleted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryId: string) => {
      const res = await fetch(
        `/api/teacher/exams/entries/${encodeURIComponent(entryId)}/complete`,
        { method: "POST" }
      );
      const json = await parseJson<{ success: boolean; error?: string }>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to mark exam as completed");
      }
      return json;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["teacherInvigilationDuties"] });
      void queryClient.invalidateQueries({ queryKey: ["teacherExamTimetable"] });
      void queryClient.invalidateQueries({ queryKey: ["teacherExamMarksPending"] });
      void queryClient.invalidateQueries({ queryKey: ["teacherExamSummary"] });
    },
  });
}

export function useReportExamIncident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      entryId: string;
      type: string;
      severity: string;
      description: string;
      actionTaken?: string | null;
    }) => {
      const res = await fetch(
        `/api/teacher/exams/entries/${encodeURIComponent(input.entryId)}/incidents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: input.type,
            severity: input.severity,
            description: input.description,
            actionTaken: input.actionTaken ?? null,
          }),
        }
      );
      const json = await parseJson<{ success: boolean; error?: string }>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to report incident");
      }
      return json;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["teacherInvigilationDuties"] });
    },
  });
}
