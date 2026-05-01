import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  TeacherLessonReflectionResponse,
  LessonReflectionUpsertPayload,
} from "@/types/lesson-reflection";

export function useTeacherLessonReflection(lessonId: string | null, enabled = true) {
  return useQuery<TeacherLessonReflectionResponse>({
    queryKey: ["teacher-lesson-reflection", lessonId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/lessons/${lessonId}/reflection`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as TeacherLessonReflectionResponse | null;
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load reflection");
      }
      return json as TeacherLessonReflectionResponse;
    },
    enabled: Boolean(lessonId) && enabled,
    staleTime: 20_000,
  });
}

export function useTeacherUpsertLessonReflection(lessonId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: LessonReflectionUpsertPayload) => {
      const res = await fetch(`/api/teacher/lessons/${lessonId}/reflection`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as TeacherLessonReflectionResponse | null;
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save reflection");
      }
      return data as TeacherLessonReflectionResponse;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-reflection", lessonId] });
    },
  });
}
