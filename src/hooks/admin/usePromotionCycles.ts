// src/hooks/admin/usePromotionCycles.ts
// PROMO-FE-004/008: Hooks for promotion cycles
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type PromotionCycleDTO = {
  id: string;
  sourceYearLabel: string;
  status: string;
  sourceAcademicPeriodId?: string | null;
  targetAcademicPeriodId?: string | null;
  totals: {
    studentsEvaluated: number;
    promote: number;
    repeat: number;
    graduate: number;
    hold: number;
    overrides: number;
    errors: number;
  };
  createdAt: string;
  approvedAt?: string | null;
  finalizedAt?: string | null;
};

type CyclesParams = {
  page?: number;
  limit?: number;
  status?: string;
  yearLabel?: string;
};

export function usePromotionCycles(params: CyclesParams = {}) {
  const { page = 1, limit = 25, status, yearLabel } = params;

  return useQuery<{
    success: boolean;
    data: PromotionCycleDTO[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>({
    queryKey: ["promotionCycles", page, limit, status, yearLabel],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("page", String(page));
      searchParams.set("limit", String(limit));
      if (status) searchParams.set("status", status);
      if (yearLabel) searchParams.set("yearLabel", yearLabel);

      const res = await fetch(`/api/admin/promotions/cycles?${searchParams}`);
      if (!res.ok) throw new Error("Failed to fetch cycles");
      return res.json();
    },
  });
}

export function usePromotionCycle(cycleId: string | null, options?: { pollWhenActive?: boolean }) {
  return useQuery<{
    success: boolean;
    data: PromotionCycleDTO & {
      progress?: unknown;
      policySnapshot?: unknown;
    };
  }>({
    queryKey: ["promotionCycle", cycleId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/promotions/cycles/${cycleId}`);
      if (!res.ok) throw new Error("Failed to fetch cycle");
      return res.json();
    },
    enabled: !!cycleId,
    refetchInterval: (query) => {
      if (!options?.pollWhenActive) return false;
      const status = (query.state.data as { data?: { status?: string } } | undefined)?.data?.status;
      return status === "finalizing" || status === "rolling_back" ? 4000 : false;
    },
  });
}

export function useDeletePromotionCycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cycleId: string) => {
      const res = await fetch(`/api/admin/promotions/cycles/${cycleId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to delete cycle");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotionCycles"] });
      queryClient.invalidateQueries({ queryKey: ["promotionCycle"] });
      queryClient.invalidateQueries({ queryKey: ["promotionDecisions"] });
    },
  });
}
