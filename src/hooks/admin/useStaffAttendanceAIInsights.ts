// src/hooks/admin/useStaffAttendanceAIInsights.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type StaffAttendanceAIInsights = {
  summary: string;
  insights: string[];
  recommendedActions: string[];
};

type LoadResponse = {
  success: boolean;
  data: StaffAttendanceAIInsights | null;
  source: "cache" | null;
  generatedAt: string | null;
  isStale?: boolean;
};

type GenerateResponse = {
  success: boolean;
  data: StaffAttendanceAIInsights;
  source: "generated";
  generatedAt: string;
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
};

/** Load cached AI insights for the given date (GET). */
export function useStaffAttendanceAIInsightsQuery(dateStr: string, enabled = true) {
  return useQuery<LoadResponse>({
    queryKey: ["staff-attendance", "ai-insights", dateStr],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/staff-attendance/ai-insights?date=${encodeURIComponent(dateStr)}`
      );
      if (!res.ok) throw new Error("Failed to load AI insights");
      return res.json();
    },
    enabled: enabled && !!dateStr,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

/** Generate AI insights and save to DB (POST). */
export function useStaffAttendanceAIInsights(dateStr: string) {
  const queryClient = useQueryClient();

  return useMutation<GenerateResponse, Error, void>({
    mutationFn: async () => {
      const res = await fetch("/api/admin/staff-attendance/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to generate AI insights");
      }
      if (!json.success || !json.data) {
        throw new Error("Invalid response from AI");
      }
      return json as GenerateResponse;
    },
    onSuccess: (_data, _variables, _context) => {
      queryClient.invalidateQueries({
        queryKey: ["staff-attendance", "ai-insights", dateStr],
      });
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to generate AI insights");
    },
  });
}
