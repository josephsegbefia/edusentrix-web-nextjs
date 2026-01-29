import { useQuery } from "@tanstack/react-query";

export type HomeroomAttendanceRecord = {
  studentId: string;
  name: string;
  admissionNo?: string;
  photoUrl?: string;
  status: "present" | "absent" | "late" | "excused";
  lateMinutes: number | null;
  reason: string | null;
};

export type HomeroomAttendanceResponse = {
  success: boolean;
  data: {
    date: string;
    classGroupId: string;
    records: HomeroomAttendanceRecord[];
    summary: {
      present: number;
      absent: number;
      late: number;
      excused: number;
      total: number;
    };
  };
};

export function useHomeroomAttendance(date?: string) {
  return useQuery<HomeroomAttendanceResponse>({
    queryKey: ["teacher-homeroom-attendance", date],
    queryFn: async () => {
      if (!date) {
        return {
          success: true,
          data: {
            date: "",
            classGroupId: "",
            records: [],
            summary: { present: 0, absent: 0, late: 0, excused: 0, total: 0 },
          },
        } as HomeroomAttendanceResponse;
      }
      const res = await fetch(`/api/teacher/attendance/homeroom/${date}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch homeroom attendance");
      return res.json();
    },
    enabled: !!date,
    staleTime: 30_000,
  });
}
