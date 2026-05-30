import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ExamPublishReadinessDTO,
  ExamPublishResultDTO,
  ExamTimetableVersionDTO,
} from "@/types/academics/exam-scheduling-engine";

type ExamPublishReadinessResponse = {
  success: boolean;
  data: ExamPublishReadinessDTO;
  error?: string;
};

type ExamPublishResponse = {
  success: boolean;
  data: ExamPublishResultDTO;
  error?: string;
};

type ExamTimetableVersionsResponse = {
  success: boolean;
  data: ExamTimetableVersionDTO[];
  error?: string;
};

type ExamTimetableVersionResponse = {
  success: boolean;
  data: ExamTimetableVersionDTO;
  error?: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export function useExamPublishReadiness(sessionId: string | null, enabled = true) {
  return useQuery<ExamPublishReadinessResponse>({
    queryKey: ["examPublishReadiness", sessionId],
    enabled: Boolean(sessionId && enabled),
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId!)}/publish/readiness`,
        { cache: "no-store" }
      );
      const json = await parseJson<ExamPublishReadinessResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load publish readiness");
      }
      return json;
    },
  });
}

export function useExamTimetableVersions(sessionId: string | null, enabled = true) {
  return useQuery<ExamTimetableVersionsResponse>({
    queryKey: ["examTimetableVersions", sessionId],
    enabled: Boolean(sessionId && enabled),
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId!)}/versions`,
        { cache: "no-store" }
      );
      const json = await parseJson<ExamTimetableVersionsResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load timetable versions");
      }
      return json;
    },
  });
}

export function useExamTimetableVersion(
  sessionId: string | null,
  versionId: string | null,
  enabled = true
) {
  return useQuery<ExamTimetableVersionResponse>({
    queryKey: ["examTimetableVersion", sessionId, versionId],
    enabled: Boolean(sessionId && versionId && enabled),
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId!)}/versions/${encodeURIComponent(versionId!)}`,
        { cache: "no-store" }
      );
      const json = await parseJson<ExamTimetableVersionResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load timetable version");
      }
      return json;
    },
  });
}

export function usePublishExamTimetable(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { changeSummary: string; syncToCalendar?: boolean }) => {
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId)}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            changeSummary: input.changeSummary,
            syncToCalendar: input.syncToCalendar ?? true,
          }),
        }
      );
      const json = await parseJson<ExamPublishResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to publish exam timetable");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examSession", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["examTimetableEntries", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["examPublishReadiness", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["examTimetableVersions", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["examConflictCheck", sessionId] });
    },
  });
}
