import { useQuery } from "@tanstack/react-query";

export type PeriodSummaryData = {
  period: {
    id: string;
    yearLabel: string;
    term: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
  };
  counts: {
    invoices: number;
    assessments: number;
    teacherAssignments: number;
    timetableVersions: number;
    studentRoles: number;
  };
  revenueMinor: number;
};

export function usePeriodSummary(periodId: string | null) {
  return useQuery<PeriodSummaryData>({
    queryKey: ["periodSummary", periodId],
    queryFn: async () => {
      if (!periodId) throw new Error("Period ID required");
      const res = await fetch(`/api/admin/periods/${periodId}/summary`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to fetch period summary");
      }
      if (!json.success || !json.data) {
        throw new Error("Invalid period summary response");
      }
      return json.data;
    },
    enabled: Boolean(periodId),
    staleTime: 30_000,
  });
}
