import { useQuery } from "@tanstack/react-query";
import type { StudentSessionCompletionStatus } from "@/models/StudentSessionProgress";

type ProgressResponse =
  | {
      success: true;
      data: {
        completionStatus: StudentSessionCompletionStatus;
        completedAt: string | null;
        viewedAt: string | null;
      };
    }
  | { success: false; error: string };

/**
 * Fetches per-student progress for a session (viewed / completed).
 * The view beacon is fired separately via POST .../view; this hook is
 * read-only so it can be polled after a completion mutation.
 */
export function useStudentSessionProgress(sessionId: string | null, enabled = true) {
  return useQuery<Extract<ProgressResponse, { success: true }>>({
    queryKey: ["student-session-progress", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/student/lesson-sessions/${sessionId}/progress`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as ProgressResponse | null;
      if (!res.ok || !json?.success) {
        throw new Error(
          (json as { error?: string } | null)?.error || "Failed to load progress"
        );
      }
      return json as Extract<ProgressResponse, { success: true }>;
    },
    enabled: Boolean(sessionId) && enabled,
    staleTime: 30_000,
  });
}
