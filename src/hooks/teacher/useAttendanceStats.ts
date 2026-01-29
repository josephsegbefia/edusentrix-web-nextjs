import { useQuery } from "@tanstack/react-query";

export type AttendanceStatsResponse = {
  success: boolean;
  data: {
    counts: {
      present: number;
      absent: number;
      late: number;
      excused: number;
    };
    total: number;
    attendanceRate: number;
  };
};

export function useAttendanceStats(params?: {
  classGroupId?: string;
  startDate?: string;
  endDate?: string;
  type?: "homeroom" | "period";
  enabled?: boolean;
}) {
  return useQuery<AttendanceStatsResponse>({
    queryKey: ["teacher-attendance-stats", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.classGroupId) searchParams.set("classGroupId", params.classGroupId);
      if (params?.startDate) searchParams.set("startDate", params.startDate);
      if (params?.endDate) searchParams.set("endDate", params.endDate);
      if (params?.type) searchParams.set("type", params.type);

      const res = await fetch(`/api/teacher/attendance/stats?${searchParams.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch attendance stats");
      return res.json();
    },
    enabled: params?.enabled ?? true,
    staleTime: 30_000,
  });
}
