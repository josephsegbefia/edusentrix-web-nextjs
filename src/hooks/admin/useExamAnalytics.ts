import { useMutation, useQuery } from "@tanstack/react-query";
import type { ExamSchedulingAnalyticsDTO } from "@/types/academics/exam-scheduling-engine";

type AnalyticsResponse = {
  success: boolean;
  data: ExamSchedulingAnalyticsDTO;
  error?: string;
};

export function useExamSchedulingAnalytics(academicPeriodId?: string | null) {
  return useQuery<AnalyticsResponse>({
    queryKey: ["examSchedulingAnalytics", academicPeriodId ?? "all"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (academicPeriodId && academicPeriodId !== "all") {
        params.set("academicPeriodId", academicPeriodId);
      }
      const query = params.toString();
      const res = await fetch(`/api/admin/exams/analytics${query ? `?${query}` : ""}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as AnalyticsResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load exam analytics");
      }
      return json;
    },
  });
}
