import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExamTimetableEntryDTO } from "@/types/academics/exam-scheduling-engine";
import type {
  CreateExamTimetableEntryBodyInput,
  UpdateExamTimetableEntryBodyInput,
} from "@/lib/exams/exam-timetable-entry-service";
import type { ExamSessionDTO } from "@/types/academics/exam-scheduling-engine";

type ExamTimetableEntryListResponse = {
  success: boolean;
  data: ExamTimetableEntryDTO[];
};

type ExamTimetableEntryResponse = {
  success: boolean;
  data: ExamTimetableEntryDTO;
  error?: string;
};

type ExamSessionResponse = {
  success: boolean;
  data: ExamSessionDTO;
  error?: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export function useExamSession(sessionId: string | null) {
  return useQuery<ExamSessionResponse>({
    queryKey: ["examSession", sessionId],
    enabled: Boolean(sessionId),
    queryFn: async () => {
      const res = await fetch(`/api/admin/exams/sessions/${encodeURIComponent(sessionId!)}`, {
        cache: "no-store",
      });
      const json = await parseJson<ExamSessionResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to fetch exam session");
      }
      return json;
    },
  });
}

export function useExamTimetableEntries(
  sessionId: string | null,
  filters?: {
    status?: string;
    classGroupId?: string;
    subjectId?: string;
    date?: string;
  }
) {
  return useQuery<ExamTimetableEntryListResponse>({
    queryKey: [
      "examTimetableEntries",
      sessionId,
      filters?.status ?? "all",
      filters?.classGroupId ?? "all",
      filters?.subjectId ?? "all",
      filters?.date ?? "all",
    ],
    enabled: Boolean(sessionId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status && filters.status !== "all") {
        params.set("status", filters.status);
      }
      if (filters?.classGroupId && filters.classGroupId !== "all") {
        params.set("classGroupId", filters.classGroupId);
      }
      if (filters?.subjectId && filters.subjectId !== "all") {
        params.set("subjectId", filters.subjectId);
      }
      if (filters?.date) {
        params.set("date", filters.date);
      }

      const query = params.toString();
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId!)}/entries${query ? `?${query}` : ""}`,
        { cache: "no-store" }
      );
      const json = await parseJson<{
        success?: boolean;
        error?: string;
        data?: ExamTimetableEntryDTO[];
      }>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to fetch exam timetable entries");
      }
      return { success: true, data: json.data ?? [] };
    },
  });
}

export function useCreateExamTimetableEntry(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateExamTimetableEntryBodyInput) => {
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId)}/entries`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      const json = await parseJson<ExamTimetableEntryResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to create exam timetable entry");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examTimetableEntries", sessionId] });
    },
  });
}

export function useUpdateExamTimetableEntry(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      entryId,
      input,
    }: {
      entryId: string;
      input: UpdateExamTimetableEntryBodyInput;
    }) => {
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId)}/entries/${encodeURIComponent(entryId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      const json = await parseJson<ExamTimetableEntryResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to update exam timetable entry");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examTimetableEntries", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["examConflictCheck", sessionId] });
    },
  });
}

export function useDeleteExamTimetableEntry(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entryId: string) => {
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId)}/entries/${encodeURIComponent(entryId)}`,
        { method: "DELETE" }
      );
      const json = await parseJson<{ success?: boolean; error?: string }>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to delete exam timetable entry");
      }
      return entryId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examTimetableEntries", sessionId] });
    },
  });
}

export function useGenerateExamDraftEntries(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      classGroupIds: string[];
      subjectIds: string[];
      defaultDurationMinutes: number;
      defaultMaxScore?: number | null;
      assessmentComponentKey?: string | null;
      contributesToReport?: boolean;
    }) => {
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId)}/entries/generate-drafts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      const json = await parseJson<{
        success?: boolean;
        error?: string;
        data?: {
          created: ExamTimetableEntryDTO[];
          skippedCount: number;
          createdCount: number;
        };
      }>(res);
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? "Failed to generate draft exam papers");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examTimetableEntries", sessionId] });
    },
  });
}
