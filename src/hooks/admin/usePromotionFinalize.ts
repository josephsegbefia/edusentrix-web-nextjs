// src/hooks/admin/usePromotionFinalize.ts
// PROMO-FE-007: Hooks for approve and finalize
import { useMutation, useQueryClient } from "@tanstack/react-query";

function generateIdempotencyKey(): string {
  return `promo-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function useApprovePromotionCycle(cycleId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/admin/promotions/cycles/${cycleId}/approve`,
        {
          method: "POST",
          headers: { "Idempotency-Key": generateIdempotencyKey() },
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to approve");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotionCycle", cycleId] });
      queryClient.invalidateQueries({ queryKey: ["promotionCycles"] });
    },
  });
}

export function useFinalizePromotionCycle(cycleId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/admin/promotions/cycles/${cycleId}/finalize`,
        {
          method: "POST",
          headers: { "Idempotency-Key": generateIdempotencyKey() },
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? json?.message ?? "Failed to finalize");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotionCycle", cycleId] });
      queryClient.invalidateQueries({ queryKey: ["promotionCycles"] });
      queryClient.invalidateQueries({ queryKey: ["promotionDecisions", cycleId] });
    },
  });
}

export function useRollbackPromotionCycle(cycleId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/admin/promotions/cycles/${cycleId}/rollback`,
        {
          method: "POST",
          headers: { "Idempotency-Key": generateIdempotencyKey() },
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? json?.message ?? "Failed to rollback");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotionCycle", cycleId] });
      queryClient.invalidateQueries({ queryKey: ["promotionCycles"] });
      queryClient.invalidateQueries({ queryKey: ["promotionDecisions", cycleId] });
    },
  });
}
