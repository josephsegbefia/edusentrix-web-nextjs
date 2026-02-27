// src/hooks/admin/usePromotionPreview.ts
// PROMO-FE-004: Hook for running promotion preview
import { useMutation, useQueryClient } from "@tanstack/react-query";

export type PreviewInput = {
  sourceAcademicPeriodId: string;
  targetAcademicPeriodId?: string;
  policyId?: string;
  scope?: {
    gradeIds?: string[];
    classGroupIds?: string[];
  };
};

export type PreviewResult = {
  cycleId: string;
  status: string;
  totals: {
    studentsEvaluated: number;
    promote: number;
    repeat: number;
    graduate: number;
    hold: number;
    overrides: number;
    errors: number;
  };
};

function generateIdempotencyKey(): string {
  return `preview-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function usePromotionPreview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PreviewInput): Promise<{ success: boolean; data: PreviewResult }> => {
      const res = await fetch("/api/admin/promotions/cycles/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": generateIdempotencyKey(),
        },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to run preview");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotionCycles"] });
    },
  });
}
