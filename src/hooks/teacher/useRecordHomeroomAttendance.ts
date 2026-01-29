import { useMutation, useQueryClient } from "@tanstack/react-query";
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
      const res = await fetch("/api/teacher/attendance/homeroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to record attendance");
      return data;
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
