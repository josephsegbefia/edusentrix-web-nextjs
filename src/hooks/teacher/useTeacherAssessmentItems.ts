import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AssessmentItemDTO } from "@/types/academics/assessment-engine";
import type {
  CreateAssessmentItemBody,
  UpdateAssessmentItemBody,
} from "@/lib/academics/assessment-engine/assessment-item-service";

type AssessmentItemResponse = {
  success: boolean;
  data: AssessmentItemDTO;
  error?: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export function useCreateAssessmentItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAssessmentItemBody) => {
      const res = await fetch("/api/teacher/marks/assessment-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await parseJson<AssessmentItemResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to create assessment item");
      }
      return json.data;
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

export function useUpdateAssessmentItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      input,
      classGroupId,
      subjectId,
    }: {
      id: string;
      input: UpdateAssessmentItemBody;
      classGroupId: string;
      subjectId: string;
    }) => {
      const res = await fetch(`/api/teacher/marks/assessment-items/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await parseJson<AssessmentItemResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to update assessment item");
      }
      return json.data;
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
