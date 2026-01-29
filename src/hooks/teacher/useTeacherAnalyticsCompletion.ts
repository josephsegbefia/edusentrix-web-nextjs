import { useQuery } from "@tanstack/react-query";

export type TeacherCompletionAssignment = {
  id: string;
  title: string;
  dueDate: string | null;
  status: string;
  classGroups: Array<{ id: string; name: string }>;
  subject: { id: string; name: string } | null;
  expected: number;
  submitted: number;
  completionRate: number;
};

export type TeacherAnalyticsCompletionResponse = {
  success: boolean;
  data: {
    summary: {
      totalAssignments: number;
      totalExpected: number;
      totalSubmitted: number;
      completionRate: number;
    };
    assignments: TeacherCompletionAssignment[];
  };
};

export type TeacherAnalyticsCompletionFilters = {
  classGroupId?: string;
  subjectId?: string;
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
};

export function useTeacherAnalyticsCompletion(filters?: TeacherAnalyticsCompletionFilters) {
  return useQuery<TeacherAnalyticsCompletionResponse>({
    queryKey: ["teacher-analytics-completion", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.classGroupId) params.set("classGroupId", filters.classGroupId);
      if (filters?.subjectId) params.set("subjectId", filters.subjectId);
      if (filters?.startDate) params.set("startDate", filters.startDate);
      if (filters?.endDate) params.set("endDate", filters.endDate);
      const res = await fetch(`/api/teacher/analytics/completion?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to fetch completion analytics");
      }
      return data;
    },
    enabled: filters?.enabled ?? true,
    staleTime: 30_000,
  });
}
