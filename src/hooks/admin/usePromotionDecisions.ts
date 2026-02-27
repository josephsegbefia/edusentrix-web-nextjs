// src/hooks/admin/usePromotionDecisions.ts
// PROMO-FE-005: Hook for promotion decisions
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type PromotionDecisionDTO = {
  id: string;
  studentId: string;
  studentName: string;
  admissionNo: string | null;
  fromGradeId: string;
  fromGradeName: string;
  fromClassGroupId: string;
  fromClassGroupName: string;
  targetGradeId: string | null;
  targetGradeName: string | null;
  targetClassGroupId: string | null;
  targetClassGroupName: string | null;
  recommendedOutcome: string;
  finalOutcome: string;
  source: string;
  reasonCodes: string[];
  conflicts: string[];
  evidence: Record<string, unknown>;
  isApplied: boolean;
  version: number;
};

type DecisionsParams = {
  cycleId: string | null;
  page?: number;
  limit?: number;
  outcome?: string;
  conflict?: string;
  gradeId?: string;
  classGroupId?: string;
  search?: string;
};

export function usePromotionDecisions(params: DecisionsParams) {
  const { cycleId, page = 1, limit = 50, outcome, conflict, gradeId, classGroupId, search } = params;

  return useQuery<{
    success: boolean;
    data: PromotionDecisionDTO[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>({
    queryKey: ["promotionDecisions", cycleId, page, limit, outcome, conflict, gradeId, classGroupId, search],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("page", String(page));
      searchParams.set("limit", String(limit));
      if (outcome) searchParams.set("outcome", outcome);
      if (conflict) searchParams.set("conflict", conflict);
      if (gradeId) searchParams.set("gradeId", gradeId);
      if (classGroupId) searchParams.set("classGroupId", classGroupId);
      if (search) searchParams.set("search", search);

      const res = await fetch(
        `/api/admin/promotions/cycles/${cycleId}/decisions?${searchParams}`
      );
      if (!res.ok) throw new Error("Failed to fetch decisions");
      return res.json();
    },
    enabled: !!cycleId,
  });
}

function generateIdempotencyKey(): string {
  return `promo-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function useOverridePromotionDecision(cycleId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      studentId,
      finalOutcome,
      reasonText,
      version,
    }: {
      studentId: string;
      finalOutcome: string;
      reasonText: string;
      version: number;
    }) => {
      const res = await fetch(
        `/api/admin/promotions/cycles/${cycleId}/decisions/${studentId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": generateIdempotencyKey(),
          },
          body: JSON.stringify({ finalOutcome, reasonText, version }),
        }
      );
      const json = await res.json();
      if (res.status === 409) throw new Error(json?.message ?? "Data changed. Please refresh.");
      if (!res.ok) throw new Error(json?.error ?? "Failed to override");
      return json;
    },
    onSuccess: (_, v) => {
      queryClient.invalidateQueries({ queryKey: ["promotionDecisions", cycleId] });
      queryClient.invalidateQueries({ queryKey: ["promotionCycle", cycleId] });
    },
  });
}

export function useAutoAssignPlacements(cycleId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/admin/promotions/cycles/${cycleId}/placements/auto-assign`,
        {
          method: "POST",
          headers: {
            "Idempotency-Key": generateIdempotencyKey(),
          },
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to auto-assign");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotionDecisions", cycleId] });
      queryClient.invalidateQueries({ queryKey: ["promotionCycle", cycleId] });
    },
  });
}
