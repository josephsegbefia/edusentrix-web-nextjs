import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExamConflictCheckResultDTO } from "@/types/academics/exam-scheduling-engine";

type ExamConflictCheckResponse = {
  success: boolean;
  data: ExamConflictCheckResultDTO;
  error?: string;
};

export function useExamConflictCheck(sessionId: string | null) {
  return useQuery<ExamConflictCheckResponse>({
    queryKey: ["examConflictCheck", sessionId],
    enabled: Boolean(sessionId),
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId!)}/conflicts`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as ExamConflictCheckResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to run conflict review");
      }
      return json;
    },
  });
}

export function useOverrideExamConflict(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { conflictKey: string; reason?: string | null }) => {
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId)}/conflicts/override`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      const json = (await res.json()) as ExamConflictCheckResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to override conflict");
      }
      return json;
    },
    onSuccess: (response) => {
      if (response.success) {
        queryClient.setQueryData(["examConflictCheck", sessionId], response);
      }
    },
  });
}
