import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SessionTeachContextResponse } from "@/types/teaching-deck";

export function useLessonSessionTeach(sessionId: string | null) {
  return useQuery<SessionTeachContextResponse>({
    queryKey: ["lesson-session-teach", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/teach`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as SessionTeachContextResponse | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load teaching mode");
      }
      return json;
    },
    enabled: Boolean(sessionId),
    staleTime: 5_000,
  });
}

export function useStartLessonTeach(sessionId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/teach/start`, {
        method: "POST",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to start teaching");
      }
      return json;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["lesson-session-teach", sessionId] });
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-session", sessionId] });
    },
  });
}

export function useEndLessonTeach(sessionId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/teach/end`, {
        method: "POST",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to end teaching");
      }
      return json;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["lesson-session-teach", sessionId] });
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-session", sessionId] });
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-week-plans"] });
    },
  });
}

export function useCompleteLessonDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (deliveryId: string) => {
      const res = await fetch(`/api/teacher/lesson-deliveries/${deliveryId}/complete`, {
        method: "POST",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to complete delivery");
      }
      return json as {
        success: true;
        data: { coverageRecordsWritten: number };
      };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-session"] });
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-week-plans"] });
    },
  });
}

export function useLinkLessonAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      deliveryId: string;
      phase: "before" | "after";
      periodNumber?: number;
      records?: Array<{
        studentId: string;
        status: "present" | "absent" | "late" | "excused";
        lateMinutes?: number | null;
        reason?: string | null;
      }>;
    }) => {
      const res = await fetch(`/api/teacher/lesson-deliveries/${input.deliveryId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: input.phase,
          periodNumber: input.periodNumber,
          records: input.records,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to save attendance link");
      }
      return json;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-session"] });
    },
  });
}
