import { useQuery } from "@tanstack/react-query";
import type { StudentLessonResourcesResponse } from "@/types/lesson-resources";

export function useStudentSessionResources(sessionId: string | null, enabled = true) {
  return useQuery<Extract<StudentLessonResourcesResponse, { success: true }>>({
    queryKey: ["student-session-resources", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/student/lesson-sessions/${sessionId}/resources`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as StudentLessonResourcesResponse | null;
      if (!res.ok || !json?.success) {
        throw new Error(
          (json as { error?: string } | null)?.error || "Failed to load resources"
        );
      }
      return json as Extract<StudentLessonResourcesResponse, { success: true }>;
    },
    enabled: Boolean(sessionId) && enabled,
    staleTime: 60_000,
  });
}
