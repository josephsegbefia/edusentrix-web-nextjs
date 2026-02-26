// src/hooks/admin/useRolesDutiesAIInsights.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type RolesDutiesTab = "student-roles" | "teacher-duties" | "class-roles";

export type RolesDutiesAIInsights = {
  summary: string;
  insights: string[];
  recommendedActions: string[];
};

type LoadResponse = {
  success: boolean;
  data: RolesDutiesAIInsights | null;
  source: "cache" | null;
  generatedAt: string | null;
  isStale?: boolean;
};

type GenerateResponse = {
  success: boolean;
  data: RolesDutiesAIInsights;
  source: "generated";
  generatedAt: string;
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
};

/** Load cached AI insights for the given tab (GET). */
export function useRolesDutiesAIInsightsQuery(tab: RolesDutiesTab, enabled = true) {
  return useQuery<LoadResponse>({
    queryKey: ["roles-duties", "ai-insights", tab],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/roles-duties/ai-insights?tab=${encodeURIComponent(tab)}`
      );
      if (!res.ok) throw new Error("Failed to load AI insights");
      return res.json();
    },
    enabled: enabled && !!tab,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

/** Generate AI insights and save to DB (POST). */
export function useRolesDutiesAIInsights(tab: RolesDutiesTab) {
  const queryClient = useQueryClient();

  return useMutation<GenerateResponse, Error, void>({
    mutationFn: async () => {
      const res = await fetch("/api/admin/roles-duties/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab }),
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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["roles-duties", "ai-insights", tab],
      });
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to generate AI insights");
    },
  });
}
