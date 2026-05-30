import { useMutation } from "@tanstack/react-query";
import type {
  ExamLeoConflictExplainDTO,
  ExamLeoInvigilatorSuggestionsDTO,
  ExamLeoParentMessageDraftDTO,
  ExamLeoScheduleImprovementsDTO,
} from "@/types/academics/exam-scheduling-engine";

async function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export function useExplainExamConflictWithLeo(sessionId: string) {
  return useMutation({
    mutationFn: async (conflictKey: string) => {
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId)}/leo/explain-conflict`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conflictKey }),
        }
      );
      const json = await parseJson<{
        success: boolean;
        data?: ExamLeoConflictExplainDTO;
        error?: string;
      }>(res);
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? "Could not explain conflict");
      }
      return json.data;
    },
  });
}

export function useSuggestExamScheduleImprovementsWithLeo(sessionId: string) {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId)}/leo/suggest-improvements`,
        { method: "POST" }
      );
      const json = await parseJson<{
        success: boolean;
        data?: ExamLeoScheduleImprovementsDTO;
        error?: string;
      }>(res);
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? "Could not load schedule suggestions");
      }
      return json.data;
    },
  });
}

export function useDraftExamParentMessageWithLeo(sessionId: string) {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId)}/leo/draft-parent-message`,
        { method: "POST" }
      );
      const json = await parseJson<{
        success: boolean;
        data?: ExamLeoParentMessageDraftDTO;
        error?: string;
      }>(res);
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? "Could not draft parent message");
      }
      return json.data;
    },
  });
}

export function useSuggestExamInvigilatorReplacementsWithLeo(sessionId: string) {
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId)}/leo/suggest-invigilator-replacements`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignmentId }),
        }
      );
      const json = await parseJson<{
        success: boolean;
        data?: ExamLeoInvigilatorSuggestionsDTO;
        error?: string;
      }>(res);
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? "Could not suggest replacements");
      }
      return json.data;
    },
  });
}
