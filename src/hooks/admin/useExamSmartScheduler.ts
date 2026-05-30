import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ExamSmartScheduleApplyResultDTO,
  ExamSmartScheduleProposalDTO,
} from "@/types/academics/exam-scheduling-engine";

type GenerateInput = {
  dayStartTime?: string;
  dayEndTime?: string;
  slotGapMinutes?: number;
  onlyUnscheduledEntries?: boolean;
};

type ApplyInput = {
  proposal: ExamSmartScheduleProposalDTO;
};

async function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export function useGenerateSmartExamSchedule(sessionId: string) {
  return useMutation({
    mutationFn: async (input: GenerateInput) => {
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId)}/scheduler/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      const json = await parseJson<{
        success: boolean;
        data?: ExamSmartScheduleProposalDTO;
        error?: string;
      }>(res);
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? "Failed to generate smart schedule");
      }
      return json.data;
    },
  });
}

export function useApplySmartExamSchedule(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ApplyInput) => {
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId)}/scheduler/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposal: input.proposal }),
        }
      );
      const json = await parseJson<{
        success: boolean;
        data?: ExamSmartScheduleApplyResultDTO;
        error?: string;
      }>(res);
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? "Failed to apply smart schedule");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examSession", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["examTimetableEntries", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["examInvigilatorAssignments", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["examConflictCheck", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["examPublishReadiness", sessionId] });
    },
  });
}
