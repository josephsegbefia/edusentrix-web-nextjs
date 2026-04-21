import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateSetupReadiness } from "@/lib/query/invalidate-setup-readiness";

export type AcademicPeriodDTO = {
  _id: string;
  yearLabel: string;
  term: string; // e.g. "Term 1"
  isCurrent?: boolean;
  startDate?: string;
  endDate?: string;
};

export function useAcademicPeriods() {
  return useQuery<{ periods: AcademicPeriodDTO[] }>({
    queryKey: ["academicPeriods"],
    queryFn: async () => {
      const res = await fetch("/api/admin/periods", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch academic periods");
      const json = await res.json();
      // Normalize response - ensure it always has a periods array
      if (Array.isArray(json.periods)) {
        return { periods: json.periods };
      }
      return { periods: [] };
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: 30_000,
  });
}

export type CreatePeriodInput = {
  yearLabel: string;
  term: string;
  startDate: string;
  endDate: string;
};

export function useCreatePeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePeriodInput) => {
      const res = await fetch("/api/admin/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearLabel: input.yearLabel,
          term: input.term,
          startDate: input.startDate,
          endDate: input.endDate,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to create period");
      }
      return json;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["academicPeriods"] });
      invalidateSetupReadiness(queryClient);
    },
  });
}

export function useSetCurrentPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (periodId: string) => {
      const res = await fetch(`/api/admin/periods/${periodId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCurrent: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to set current period");
      }
      return json;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["academicPeriods"] });
      invalidateSetupReadiness(queryClient);
    },
  });
}
