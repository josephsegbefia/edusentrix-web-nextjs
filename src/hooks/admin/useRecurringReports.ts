import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type RecurringReportType = "term" | "weekly" | "biweekly" | "monthly";

export type RecurringReportSection = {
  title: string;
  content: string;
  highlights?: string[];
};

export type RecurringReportSuggestion = {
  text: string;
  category?: string;
  status?: "pending" | "in_progress" | "done" | "deferred";
};

export type RecurringReportContent = {
  summary: string;
  sections: RecurringReportSection[];
  suggestions: RecurringReportSuggestion[];
};

export type RecurringReportItem = {
  id: string;
  periodId: string;
  reportType: RecurringReportType;
  dateRange: {
    startDate: string;
    endDate: string;
  } | null;
  summary: string;
  generatedAt: string;
};

export type GeneratedRecurringReport = {
  id: string;
  periodId: string;
  reportType: RecurringReportType;
  dateRange: {
    startDate: string;
    endDate: string;
  } | null;
  content: RecurringReportContent;
  generatedAt: string;
  source: "cache" | "generated";
};

export function useRecurringReports(periodId: string | null) {
  return useQuery<RecurringReportItem[]>({
    queryKey: ["recurringReports", periodId],
    queryFn: async () => {
      if (!periodId) return [];
      const params = new URLSearchParams({ academicPeriodId: periodId });
      const res = await fetch(`/api/admin/reports?${params}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to fetch reports");
      }
      return (json.data ?? []) as RecurringReportItem[];
    },
    enabled: Boolean(periodId),
    staleTime: 30_000,
  });
}

export function useGenerateRecurringReport(periodId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<
    GeneratedRecurringReport,
    Error,
    {
      startDate: string;
      endDate: string;
      reportType: RecurringReportType;
      force?: boolean;
    }
  >({
    mutationFn: async (payload: {
      startDate: string;
      endDate: string;
      reportType: RecurringReportType;
      force?: boolean;
    }) => {
      if (!periodId) throw new Error("Period ID required");
      const res = await fetch("/api/admin/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          academicPeriodId: periodId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to generate report");
      }
      return {
        ...(json.data as Omit<GeneratedRecurringReport, "source">),
        source: json.source === "cache" ? "cache" : "generated",
      };
    },
    onSuccess: (_, variables) => {
      if (periodId) {
        void queryClient.invalidateQueries({ queryKey: ["recurringReports", periodId] });
      }
    },
  });
}
