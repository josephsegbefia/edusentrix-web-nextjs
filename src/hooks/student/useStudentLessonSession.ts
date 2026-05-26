import { useQuery } from "@tanstack/react-query";
import type { StudentLessonSessionContentDto } from "@/types/lesson-content-blocks";

type SessionResponse =
  | { success: true; data: StudentLessonSessionContentDto }
  | { success: false; error: string };

export function useStudentLessonSession(sessionId: string | null, enabled = true) {
  return useQuery<Extract<SessionResponse, { success: true }>>({
    queryKey: ["student-lesson-session", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/student/lesson-sessions/${sessionId}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as SessionResponse | null;
      if (!res.ok || !json?.success) {
        throw new Error(
          (json as { error?: string } | null)?.error || "Failed to load lesson"
        );
      }
      return json as Extract<SessionResponse, { success: true }>;
    },
    enabled: Boolean(sessionId) && enabled,
    staleTime: 60_000,
  });
}
