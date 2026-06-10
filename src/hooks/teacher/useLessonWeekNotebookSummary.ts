import { useQuery } from "@tanstack/react-query";
import type { LessonWeekNotebookSummaryResponse } from "@/types/lesson-notebook-summary";

export function useLessonWeekNotebookSummary(weekPlanId: string | null, enabled = true) {
  return useQuery<Extract<LessonWeekNotebookSummaryResponse, { success: true }>>({
    queryKey: ["teacher-lesson-week-notebook-summary", weekPlanId],
    queryFn: async () => {
      const res = await fetch(
        `/api/teacher/lesson-week-plans/${weekPlanId}/notebook-summary`,
        { cache: "no-store" },
      );
      const json = (await res.json().catch(() => null)) as LessonWeekNotebookSummaryResponse | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load notebook summary");
      }
      return json as Extract<LessonWeekNotebookSummaryResponse, { success: true }>;
    },
    enabled: enabled && Boolean(weekPlanId),
    staleTime: 30_000,
  });
}
