import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type PeriodReportSection = {
  title: string;
  content: string;
  highlights?: string[];
};

export type PeriodReportSuggestion = {
  text: string;
  category?: string;
  status?: string;
};

export type PeriodReportContent = {
  summary: string;
  sections: PeriodReportSection[];
  suggestions: PeriodReportSuggestion[];
};

export type PeriodReportData = {
  id: string;
  periodId: string;
  reportType: string;
  content: PeriodReportContent;
  generatedAt: string;
};

export function usePeriodReport(periodId: string | null) {
  return useQuery<PeriodReportData | null>({
    queryKey: ["periodReport", periodId],
    queryFn: async () => {
      if (!periodId) return null;
      const res = await fetch(`/api/admin/periods/${periodId}/report`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to fetch report");
      }
      return json.data ?? null;
    },
    enabled: Boolean(periodId),
    staleTime: 60_000,
  });
}

export function useGeneratePeriodReport(periodId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (force?: boolean) => {
      if (!periodId) throw new Error("Period ID required");
      const res = await fetch(`/api/admin/periods/${periodId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: force ?? false }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to generate report");
      }
      return json.data as PeriodReportData;
    },
    onSuccess: () => {
      if (periodId) {
        void queryClient.invalidateQueries({ queryKey: ["periodReport", periodId] });
      }
    },
  });
}
