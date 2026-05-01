import { useQuery } from "@tanstack/react-query";
import type {
  TeacherLessonsFilters,
  TeacherLessonsListResponse,
} from "@/types/lessons";

export function useTeacherLessons(
  filters: TeacherLessonsFilters = {},
  enabled = true
) {
  return useQuery<TeacherLessonsListResponse>({
    queryKey: ["teacher-lessons", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.lessonNoteId) params.set("lessonNoteId", filters.lessonNoteId);
      if (filters.limit) params.set("limit", String(filters.limit));

      const res = await fetch(`/api/teacher/lessons?${params.toString()}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as TeacherLessonsListResponse | null;
      if (!res.ok) {
        throw new Error(json?.error || "Failed to fetch lessons");
      }
      return json as TeacherLessonsListResponse;
    },
    enabled,
    staleTime: 30_000,
    refetchIntervalInBackground: false,
    refetchInterval: 90_000,
  });
}
