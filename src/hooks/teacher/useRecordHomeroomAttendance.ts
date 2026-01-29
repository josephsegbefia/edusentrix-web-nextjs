import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithOfflineFallback } from "@/hooks/useOfflineQueue";
import type { HomeroomAttendanceRecord } from "./useHomeroomAttendance";

export type RecordHomeroomAttendanceInput = {
  classGroupId: string;
  date: string;
  records: Array<Pick<HomeroomAttendanceRecord, "studentId" | "status" | "lateMinutes" | "reason">>;
};

export function useRecordHomeroomAttendance() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RecordHomeroomAttendanceInput) => {
      try {
        const res = await fetchWithOfflineFallback(
          "/api/teacher/attendance/homeroom",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            queueDescription: "Homeroom attendance",
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to record attendance");
        return data;
      } catch (err: unknown) {
        if ((err as { isOfflineQueued?: boolean })?.isOfflineQueued) {
          return { queued: true } as { queued: true };
        }
        throw err;
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["teacher-homeroom-attendance", variables.date],
      });
      qc.invalidateQueries({ queryKey: ["teacher-dashboard"] });
      qc.invalidateQueries({ queryKey: ["teacher-context"] });
    },
  });
}
