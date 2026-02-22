import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { IRuleBasedInsights, IAIGeneratedInsights } from "@/models/AIInsightCache";

export interface StudentInsightsResponse {
  success: boolean;
  data: {
    studentId: string;
    studentName: string;
    gradeName: string | null;
    classGroupName: string | null;
    currentPeriodId: string | null;
    currentPeriodLabel: string | null;
    ruleBased: IRuleBasedInsights;
    subjectDetails: Array<{
      subjectName: string;
      totalScore: number;
      caPercentage: number;
      examPercentage: number;
      classAvg: number | null;
    }>;
    termHistory: Array<{
      label: string;
      averageScore: number | null;
      classAverage: number | null;
    }>;
    recentComments: Array<{
      comment: string;
      teacherName: string | null;
      type: string;
      date: string;
    }>;
    feesDetail: {
      totalBilledMinor: number;
      totalPaidMinor: number;
      outstandingMinor: number;
      currency: string;
    } | null;
    aiGenerated: IAIGeneratedInsights | null;
    generatedAt: string | null;
    tokenUsage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    } | null;
    canGenerate: boolean;
  };
}

export function useStudentInsights(studentId: string | undefined) {
  return useQuery<StudentInsightsResponse>({
    queryKey: ["student-insights", studentId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/students/${studentId}/insights`);
      if (!res.ok) throw new Error("Failed to fetch insights");
      return res.json();
    },
    enabled: !!studentId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

export function useGenerateInsights(studentId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (periodId?: string) => {
      const res = await fetch(
        `/api/admin/students/${studentId}/insights/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ periodId }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate insights");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-insights", studentId] });
    },
  });
}

export function useAskAI(studentId: string | undefined) {
  return useMutation({
    mutationFn: async ({
      question,
      onChunk,
    }: {
      question: string;
      onChunk: (text: string) => void;
    }) => {
      const res = await fetch(
        `/api/admin/students/${studentId}/insights/ask`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to ask AI");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        onChunk(fullText);
      }

      return fullText;
    },
  });
}
