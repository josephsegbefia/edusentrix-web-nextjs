import { useQuery } from "@tanstack/react-query";

export type TeacherAnalyticsPerformanceResponse = {
  success: boolean;
  data: {
    summary: {
      averageScore: number;
      passRate: number;
      studentCount: number;
    };
    distribution: Array<{
      label: string;
      count: number;
    }>;
  };
};

export type TeacherAnalyticsPerformanceFilters = {
  classGroupId?: string;
  subjectId?: string;
  enabled?: boolean;
};

export function useTeacherAnalyticsPerformance(filters?: TeacherAnalyticsPerformanceFilters) {
  return useQuery<TeacherAnalyticsPerformanceResponse>({
    queryKey: ["teacher-analytics-performance", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.classGroupId) params.set("classGroupId", filters.classGroupId);
      if (filters?.subjectId) params.set("subjectId", filters.subjectId);
      const res = await fetch(`/api/teacher/analytics/class-performance?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to fetch performance analytics");
      }
      return data;
    },
    enabled: filters?.enabled ?? true,
    staleTime: 30_000,
  });
}
