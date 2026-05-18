import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { LessonSessionDetailDto } from "@/types/lessons-v2";

type SubstituteResponse = {
  success: boolean;
  data: { session: LessonSessionDetailDto };
  error?: string;
};

export function useAssignSessionSubstitute(sessionId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      substituteTeacherId: string;
      substituteReason?: "leave" | "absence" | "delegation" | "other";
    }) => {
      const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/substitute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as SubstituteResponse | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to assign substitute");
      }
      return json;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-session", sessionId] });
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-week-plans"] });
    },
  });
}

export function useClearSessionSubstitute(sessionId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/substitute`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => null)) as SubstituteResponse | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to clear substitute");
      }
      return json;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-session", sessionId] });
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-week-plans"] });
    },
  });
}
