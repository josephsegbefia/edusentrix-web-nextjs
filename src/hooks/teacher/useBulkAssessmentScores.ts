import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AssessmentScoreDTO } from "@/types/academics/assessment-engine";
import type { BulkAssessmentScoresBody } from "@/lib/academics/assessment-engine/assessment-score-service";

type BulkAssessmentScoresResponse = {
  success: boolean;
  data: AssessmentScoreDTO[];
  updatedCount?: number;
  error?: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export function useBulkAssessmentScores() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      body,
      classGroupId,
      subjectId,
    }: {
      body: BulkAssessmentScoresBody;
      classGroupId: string;
      subjectId: string;
    }) => {
      const res = await fetch("/api/teacher/marks/scores/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await parseJson<BulkAssessmentScoresResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to save assessment scores");
      }
      return json;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [
          "teacher-gradebook-v2",
          variables.classGroupId,
          variables.subjectId,
        ],
      });
    },
  });
}
