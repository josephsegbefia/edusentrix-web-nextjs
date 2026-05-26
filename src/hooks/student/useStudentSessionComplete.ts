import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useStudentSessionComplete(sessionId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error("Missing session");
      const res = await fetch(`/api/student/lesson-sessions/${sessionId}/complete`, {
        method: "POST",
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        data?: { completedAt: string; completionStatus: "completed" };
      };
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || "Could not save");
      }
      return json.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["student-lesson-sessions"] });
      if (sessionId) {
        void qc.invalidateQueries({ queryKey: ["student-lesson-session", sessionId] });
      }
    },
  });
}
