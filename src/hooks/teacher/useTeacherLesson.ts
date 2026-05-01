import { useQuery } from "@tanstack/react-query";
import type { TeacherLessonDetailResponse } from "@/types/lessons";

export function useTeacherLesson(
  lessonId: string | null,
  enabled = true,
  opts?: { includeDisplayNote?: boolean }
) {
  const includeDisplayNote = opts?.includeDisplayNote ?? false;
  return useQuery<TeacherLessonDetailResponse>({
    queryKey: ["teacher-lesson", lessonId, includeDisplayNote],
    queryFn: async () => {
      const q = includeDisplayNote ? "?includeDisplayNote=1" : "";
      const res = await fetch(`/api/teacher/lessons/${lessonId}${q}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as TeacherLessonDetailResponse | null;
      if (!res.ok) {
        throw new Error(json?.error || "Failed to fetch lesson");
      }
      return json as TeacherLessonDetailResponse;
    },
    enabled: Boolean(lessonId) && enabled,
    staleTime: 30_000,
    refetchIntervalInBackground: false,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      return status === "published" || status === "archived" ? 45_000 : false;
    },
  });
}
