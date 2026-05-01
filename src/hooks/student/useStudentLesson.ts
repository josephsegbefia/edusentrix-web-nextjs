import { useQuery } from "@tanstack/react-query";
import type { StudentLessonDetailResponse } from "@/types/lessons";

export function useStudentLesson(lessonId: string | null, enabled = true) {
  return useQuery<StudentLessonDetailResponse>({
    queryKey: ["student-lesson", lessonId],
    queryFn: async () => {
      const res = await fetch(`/api/student/lessons/${lessonId}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as StudentLessonDetailResponse | null;
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load lesson");
      }
      return json as StudentLessonDetailResponse;
    },
    enabled: Boolean(lessonId) && enabled,
    staleTime: 60_000,
  });
}
