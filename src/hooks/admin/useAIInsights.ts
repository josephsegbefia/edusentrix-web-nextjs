// src/hooks/admin/useAIInsights.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type AcademicAIInsightData = {
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

type AIInsightsLoadResponse = {
  success: boolean;
  data: AcademicAIInsightData | null;
  source: "cache" | null;
  generatedAt: string | null;
  isStale?: boolean;
  currentFingerprint?: string;
};

type AIInsightsGenerateResponse = {
  success: boolean;
  data: AcademicAIInsightData;
  source: "generated";
  generatedAt: string;
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
};

/** Load cached AI insights (GET). Returns cached data if available. */
export function useAIInsights(
  studentId: string,
  termId: string | null,
  enabled = true
) {
  return useQuery<AIInsightsLoadResponse>({
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
    staleTime: 1000 * 60 * 5, // 5 min - refetch to check for stale
    refetchOnWindowFocus: false,
  });
}

/** Generate AI insights and save to DB (POST). */
export function useGenerateAcademicAIInsights(studentId: string, termId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<AIInsightsGenerateResponse, Error, void>({
    mutationFn: async () => {
      const res = await fetch(
        `/api/admin/students/${studentId}/academics/ai-insights`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ termId }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Failed to generate AI insights");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["ai-insights", studentId, termId],
      });
    },
  });
}
