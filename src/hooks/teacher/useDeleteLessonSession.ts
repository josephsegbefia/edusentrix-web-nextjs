import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SessionDeleteImpact } from "@/lib/lessons/session-delete";

type ImpactResponse = { success: boolean; data: SessionDeleteImpact; error?: string };
type DeleteResponse = { success: boolean; error?: string };

export function useSessionDeleteImpact(sessionId: string, enabled = true) {
  return useQuery<SessionDeleteImpact>({
    queryKey: ["session-delete-impact", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/delete-impact`);
      const json = (await res.json().catch(() => null)) as ImpactResponse | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load delete impact");
      }
      return json.data;
    },
    enabled: Boolean(sessionId) && enabled,
    staleTime: 30_000,
  });
}

export function useDeleteLessonSession(sessionId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error>({
    mutationFn: async () => {
      const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => null)) as DeleteResponse | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to delete session");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-lesson-sessions"] });
      qc.invalidateQueries({ queryKey: ["teacher-lesson-week-plans"] });
      qc.invalidateQueries({ queryKey: ["teacher-lesson-session", sessionId] });
    },
  });
}
