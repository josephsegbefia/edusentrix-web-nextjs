"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type AttendanceStudentStatus =
  | "present"
  | "absent"
  | "left_early"
  | "arrived_late"
  | "not_recorded";

export type RosterEntry = {
  studentId: string;
  name: string;
  admissionNo: string | null;
  preLesson: AttendanceStudentStatus;
  postLesson: AttendanceStudentStatus;
};

type AttendanceContextResponse = {
  success: boolean;
  error?: string;
  data?: {
    sessionTitle: string;
    scheduledDate: string;
    startTime: string;
    endTime: string;
    roster: RosterEntry[];
    preRecorded: boolean;
    postRecorded: boolean;
    preRecordedAt: string | null;
    postRecordedAt: string | null;
    deliveryId: string | null;
  };
};

export function useLessonAttendanceRoster(sessionId: string | null) {
  return useQuery<AttendanceContextResponse>({
    queryKey: ["lesson-attendance-roster", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/attendance`);
      const json = (await res.json().catch(() => null)) as AttendanceContextResponse | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error ?? "Failed to load attendance roster");
      }
      return json;
    },
    enabled: Boolean(sessionId),
    staleTime: 30_000,
  });
}

export function useSavePreLessonAttendance(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      marks: Array<{ studentId: string; preLesson: AttendanceStudentStatus }>,
    ) => {
      const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "pre", marks }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error ?? "Failed to save pre-lesson attendance");
      }
      return json as {
        success: true;
        data: {
          attendanceId: string;
          totalEnrolled: number;
          presentCount: number;
          absentCount: number;
          preRecordedAt: string | null;
        };
      };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["lesson-attendance-roster", sessionId] });
    },
  });
}

export function useSavePostLessonAttendance(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      marks: Array<{ studentId: string; postLesson: AttendanceStudentStatus }>,
    ) => {
      const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "post", marks }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error ?? "Failed to save post-lesson attendance");
      }
      return json as { success: true; data: { attendanceId: string; postRecordedAt: string | null } };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["lesson-attendance-roster", sessionId] });
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-session", sessionId] });
    },
  });
}
