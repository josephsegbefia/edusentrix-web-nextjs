import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StudioGradebookImportResult, StudioGradebookLinkDTO } from "@/lib/academics/assessment-engine/studio-to-gradebook-service";

export type AddStudioToGradebookInput = {
  classGroupId: string;
  contributionMode: "non_report" | "report";
  componentKey?: string | null;
};

export function useStudioGradebookLink(homeworkId?: string) {
  return useQuery<{ success: boolean; data: StudioGradebookLinkDTO }>({
    queryKey: ["teacher", "studio", "gradebook-link", homeworkId],
    queryFn: async () => {
      if (!homeworkId) throw new Error("Missing assignment id");
      const res = await fetch(`/api/teacher/studio/assignments/${homeworkId}/gradebook-link`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load gradebook link status");
      }
      return json;
    },
    enabled: Boolean(homeworkId),
    staleTime: 30_000,
  });
}

export function useAddStudioToGradebook(homeworkId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddStudioToGradebookInput) => {
      if (!homeworkId) throw new Error("Missing assignment id");
      const res = await fetch(`/api/teacher/studio/assignments/${homeworkId}/gradebook-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to add marks to gradebook");
      }
      return json.data as StudioGradebookImportResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "studio", "gradebook-link", homeworkId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-gradebook-v2"] });
    },
  });
}
