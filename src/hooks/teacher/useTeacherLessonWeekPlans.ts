import { useQuery } from "@tanstack/react-query";
import type { LessonWeekPlansListResponse } from "@/types/lessons-v2";

export function useTeacherLessonWeekPlans(classGroupId?: string | null) {
  return useQuery<LessonWeekPlansListResponse>({
    queryKey: ["teacher-lesson-week-plans", classGroupId ?? "all"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (classGroupId) params.set("classGroupId", classGroupId);
      const res = await fetch(`/api/teacher/lesson-week-plans?${params}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as LessonWeekPlansListResponse | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load lesson week plans");
      }
      return json;
    },
    staleTime: 20_000,
  });
}
