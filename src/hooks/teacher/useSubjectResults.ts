import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  SubjectResultPreviewDTO,
  SubjectResultSubmitSummaryDTO,
} from "@/types/academics/assessment-engine";

type SubjectResultPreviewResponse = {
  success: boolean;
  data: SubjectResultPreviewDTO;
  error?: string;
};

type SubjectResultSubmitResponse = {
  success: boolean;
  data: SubjectResultSubmitSummaryDTO;
  error?: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export function useSubjectResultPreview(
  classGroupId?: string,
  subjectId?: string,
  academicPeriodId?: string | null,
  enabled = true
) {
  return useQuery<SubjectResultPreviewResponse>({
    queryKey: [
      "teacher-subject-result-preview",
      classGroupId ?? "none",
      subjectId ?? "none",
      academicPeriodId ?? "current",
    ],
    queryFn: async () => {
      if (!classGroupId || !subjectId) {
        throw new Error("Missing gradebook identifiers");
      }

      const res = await fetch("/api/teacher/marks/subject-results/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classGroupId,
          subjectId,
          ...(academicPeriodId ? { academicPeriodId } : {}),
        }),
      });
      const json = await parseJson<SubjectResultPreviewResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to preview subject results");
      }
      return json;
    },
    enabled: enabled && Boolean(classGroupId && subjectId),
    staleTime: 15_000,
  });
}

export function useSubmitSubjectResults() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      classGroupId: string;
      subjectId: string;
      academicPeriodId?: string | null;
    }) => {
      const res = await fetch("/api/teacher/marks/subject-results/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classGroupId: input.classGroupId,
          subjectId: input.subjectId,
          ...(input.academicPeriodId ? { academicPeriodId: input.academicPeriodId } : {}),
        }),
      });
      const json = await parseJson<SubjectResultSubmitResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to submit subject results");
      }
      return json.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["teacher-gradebook-v2", variables.classGroupId, variables.subjectId],
      });
      queryClient.invalidateQueries({
        queryKey: [
          "teacher-subject-result-preview",
          variables.classGroupId,
          variables.subjectId,
        ],
      });
    },
  });
}
