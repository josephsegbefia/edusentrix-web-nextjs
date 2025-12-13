// src/hooks/admin/useAIInsights.ts
import { useQuery } from "@tanstack/react-query";

type AIInsightsResponse = {
  success: boolean;
  data: {
    riskLevel: "low" | "medium" | "high";
    summary: string;
    strengths: Array<{
      subject: string;
      reason: string;
      score: number;
    }>;
    weaknesses: Array<{
      subject: string;
      reason: string;
      score: number;
      trend?: "improving" | "declining" | "stable";
    }>;
    suggestedActions: {
      student: string[];
      parent: string[];
      teacher: string[];
    };
    prioritySubjects: string[];
    insights: {
      overallTrend: string;
      examVsCA: string;
      classComparison: string;
    };
  };
};

export function useAIInsights(
  studentId: string,
  termId: string | null,
  enabled = true
) {
  return useQuery<AIInsightsResponse>({
    queryKey: ["ai-insights", studentId, termId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (termId) params.set("termId", termId);
      const res = await fetch(
        `/api/admin/students/${studentId}/academics/ai-insights?${params.toString()}`
      );
      if (!res.ok) throw new Error("Failed to fetch AI insights");
      return res.json();
    },
    enabled: enabled && !!studentId,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });
}
