import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  TeacherSessionReflectionResponse,
  LessonReflectionUpsertPayload,
} from "@/types/lesson-reflection";

export function useTeacherSessionReflection(sessionId: string | null, enabled = true) {
  return useQuery<TeacherSessionReflectionResponse>({
    queryKey: ["teacher-session-reflection", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/reflection`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as TeacherSessionReflectionResponse | null;
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load reflection");
      }
      return json as TeacherSessionReflectionResponse;
    },
    enabled: Boolean(sessionId) && enabled,
    staleTime: 20_000,
  });
}

export function useTeacherUpsertSessionReflection(sessionId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: LessonReflectionUpsertPayload) => {
      const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/reflection`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as TeacherSessionReflectionResponse | null;
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save reflection");
      }
      return data as TeacherSessionReflectionResponse;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-session-reflection", sessionId] });
    },
  });
}
