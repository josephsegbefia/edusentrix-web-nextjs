import { useQuery } from "@tanstack/react-query";
import type { StudentLessonResourcesResponse } from "@/types/lesson-resources";

export function useStudentLessonResources(lessonId: string | null, enabled = true) {
  return useQuery<StudentLessonResourcesResponse>({
    queryKey: ["student-lesson-resources", lessonId],
    queryFn: async () => {
      const res = await fetch(`/api/student/lessons/${lessonId}/resources`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as StudentLessonResourcesResponse | null;
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load resources");
      }
      return json as StudentLessonResourcesResponse;
    },
    enabled: Boolean(lessonId) && enabled,
    staleTime: 30_000,
  });
}
