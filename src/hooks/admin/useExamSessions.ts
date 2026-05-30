import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExamSessionDTO } from "@/types/academics/exam-scheduling-engine";
import type {
  CreateExamSessionBodyInput,
  UpdateExamSessionBodyInput,
} from "@/lib/exams/exam-session-service";

export type ExamSessionBodyInput = CreateExamSessionBodyInput;
export type ExamSessionUpdateInput = UpdateExamSessionBodyInput;

type ExamSessionListResponse = {
  success: boolean;
  data: ExamSessionDTO[];
};

type ExamSessionResponse = {
  success: boolean;
  data: ExamSessionDTO;
  error?: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export function useExamSessions(filters?: {
  status?: string;
  academicPeriodId?: string;
}) {
  return useQuery<ExamSessionListResponse>({
    queryKey: [
      "examSessions",
      filters?.status ?? "all",
      filters?.academicPeriodId ?? "all",
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status && filters.status !== "all") {
        params.set("status", filters.status);
      }
      if (filters?.academicPeriodId && filters.academicPeriodId !== "all") {
        params.set("academicPeriodId", filters.academicPeriodId);
      }
      const query = params.toString();
      const res = await fetch(
        `/api/admin/exams/sessions${query ? `?${query}` : ""}`,
        { cache: "no-store" }
      );
      const json = await parseJson<{
        success?: boolean;
        error?: string;
        data?: ExamSessionDTO[];
      }>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to fetch exam sessions");
      }
      return { success: true, data: json.data ?? [] };
    },
  });
}

export function useCreateExamSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ExamSessionBodyInput) => {
      const res = await fetch("/api/admin/exams/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await parseJson<ExamSessionResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to create exam session");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examSessions"] });
    },
  });
}

export function useUpdateExamSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: ExamSessionUpdateInput;
    }) => {
      const res = await fetch(`/api/admin/exams/sessions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await parseJson<ExamSessionResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to update exam session");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examSessions"] });
    },
  });
}

export function useCancelExamSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/exams/sessions/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await parseJson<ExamSessionResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to cancel exam session");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examSessions"] });
    },
  });
}
