import { useQuery } from "@tanstack/react-query";

export type PeriodAttendanceRecord = {
  studentId: string;
  name: string;
  admissionNo?: string;
  photoUrl?: string;
  status: "present" | "absent" | "late" | "excused";
  lateMinutes: number | null;
  reason: string | null;
};

export type PeriodAttendanceResponse = {
  success: boolean;
  data: {
    date: string;
    classGroupId: string;
    subjectId: string | null;
    periodNumber: number;
    records: PeriodAttendanceRecord[];
    summary: {
      present: number;
      absent: number;
      late: number;
      excused: number;
      total: number;
    };
  };
};

export function usePeriodAttendance(params: {
  classGroupId?: string;
  subjectId?: string;
  date?: string;
  periodNumber?: number;
  enabled?: boolean;
}) {
  return useQuery<PeriodAttendanceResponse>({
    queryKey: ["teacher-period-attendance", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.classGroupId) searchParams.set("classGroupId", params.classGroupId);
      if (params.subjectId) searchParams.set("subjectId", params.subjectId);
      if (params.date) searchParams.set("date", params.date);
      if (params.periodNumber) searchParams.set("periodNumber", String(params.periodNumber));

      const res = await fetch(`/api/teacher/attendance/period?${searchParams.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch period attendance");
      return res.json();
    },
    enabled:
      params.enabled ??
      Boolean(params.classGroupId && params.subjectId && params.date && params.periodNumber),
    staleTime: 30_000,
  });
}
