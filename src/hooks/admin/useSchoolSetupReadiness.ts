"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import type {
  SetupReadinessItem,
  SchoolSetupReadinessResult,
} from "@/types/admin/setup-readiness";

export type { SetupReadinessItem, SchoolSetupReadinessResult };

export function useSchoolSetupReadiness(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "setup-readiness"],
    queryFn: async (): Promise<SchoolSetupReadinessResult> => {
      const res = await fetch("/api/admin/setup-readiness", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to load setup checklist");
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to load setup checklist");
      return json.data as SchoolSetupReadinessResult;
    },
    enabled,
    staleTime: 45_000,
  });
}

export type SetupReadinessCoachResult = {
  coachMessage: string;
  fallback: boolean;
};

export function useSetupReadinessCoach() {
  return useMutation({
    mutationFn: async (): Promise<SetupReadinessCoachResult> => {
      const res = await fetch("/api/admin/setup-readiness/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Leo could not expand this tip right now.");
      }
      return {
        coachMessage: String(json.coachMessage || ""),
        fallback: Boolean(json.fallback),
      };
    },
  });
}
