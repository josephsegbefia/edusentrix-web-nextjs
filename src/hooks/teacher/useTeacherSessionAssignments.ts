import { useQuery } from "@tanstack/react-query";
import type {
  SessionLinkedAssignmentItem,
  SessionLinkedAssignmentsSummary,
} from "@/types/lessons-v2";

type Response = {
  success: boolean;
  data: {
    summary: SessionLinkedAssignmentsSummary | null;
    items: SessionLinkedAssignmentItem[];
  };
  error?: string;
};

export function useTeacherSessionAssignments(sessionId: string | null, enabled = true) {
  return useQuery<Response>({
    queryKey: ["teacher-session-assignments", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/assignments`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as Response | null;
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load session tasks");
      }
      return json as Response;
    },
    enabled: Boolean(sessionId) && enabled,
    staleTime: 15_000,
  });
}
