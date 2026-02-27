// src/hooks/admin/usePromotionPolicies.ts
// PROMO-FE-003: Hooks for promotion policy CRUD
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreatePromotionPolicyInput } from "@/schemas/promotion-policy";

export type PromotionPolicyDTO = {
  id: string;
  name: string;
  version: number;
  isActive: boolean;
  appliesTo: { stage?: string; gradeIds?: string[] };
  criteria: Array<{
    key: string;
    operator: string;
    value: number;
    weight?: number;
    required?: boolean;
  }>;
  logic: string;
  thresholds: { promote: number; holdForReview?: number };
  tieBreaker: string;
  attendanceComputation: { treatExcusedAsPresent: boolean };
  financeHold: { enabled: boolean; maxOutstandingMinor: number };
  manualOverrideRules: { requireReason: boolean; requireApprover: boolean };
  createdAt?: string;
  updatedAt?: string;
};

function generateIdempotencyKey(): string {
  return `promo-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function usePromotionPolicyActive() {
  return useQuery<{ success: boolean; data: PromotionPolicyDTO | null }>({
    queryKey: ["promotionPolicy", "active"],
    queryFn: async () => {
      const res = await fetch("/api/admin/promotions/policies/active");
      if (!res.ok) throw new Error("Failed to fetch active policy");
      return res.json();
    },
  });
}

export function useCreatePromotionPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePromotionPolicyInput) => {
      const res = await fetch("/api/admin/promotions/policies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": generateIdempotencyKey(),
        },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to create policy");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotionPolicy"] });
    },
  });
}

export function useActivatePromotionPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (policyId: string) => {
      const res = await fetch(
        `/api/admin/promotions/policies/${encodeURIComponent(policyId)}/activate`,
        {
          method: "POST",
          headers: {
            "Idempotency-Key": generateIdempotencyKey(),
          },
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to activate policy");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotionPolicy"] });
    },
  });
}
