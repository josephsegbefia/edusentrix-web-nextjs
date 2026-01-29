import { useQuery } from "@tanstack/react-query";

export type TeacherAnalyticsAttendanceResponse = {
  success: boolean;
  data: {
    summary: {
      present: number;
      absent: number;
      late: number;
      excused: number;
      total: number;
      attendanceRate: number;
    };
    byClass: Array<{
      classGroupId: string;
      className: string;
      total: number;
      attendanceRate: number;
    }>;
  };
};

export type TeacherAnalyticsAttendanceFilters = {
  classGroupId?: string;
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
};

export function useTeacherAnalyticsAttendance(filters?: TeacherAnalyticsAttendanceFilters) {
  return useQuery<TeacherAnalyticsAttendanceResponse>({
    queryKey: ["teacher-analytics-attendance", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.classGroupId) params.set("classGroupId", filters.classGroupId);
      if (filters?.startDate) params.set("startDate", filters.startDate);
      if (filters?.endDate) params.set("endDate", filters.endDate);
      const res = await fetch(`/api/teacher/analytics/attendance?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to fetch attendance analytics");
      }
      return data;
    },
    enabled: filters?.enabled ?? true,
    staleTime: 30_000,
  });
}
