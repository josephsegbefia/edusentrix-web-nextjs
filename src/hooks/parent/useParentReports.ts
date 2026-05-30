// src/hooks/parent/useParentReports.ts
import { useQuery } from "@tanstack/react-query";

export type ReportType = "term_report" | "progress_report" | "report_card";
export type ReportStatus = "available" | "pending" | "not_available";

export interface AvailableReport {
  id: string;
  type: ReportType;
  title: string;
  wardId: string;
  wardName: string;
  periodId: string;
  periodLabel: string;
  classGroup: string;
  status: ReportStatus;
  generatedAt: string | null;
  averageScore: number | null;
  classPosition: number | null;
  studentReportCardId?: string | null;
  source?: "snapshot" | "legacy";
}

export interface WardOption {
  id: string;
  name: string;
}

export interface PeriodOption {
  id: string;
  label: string;
}

export interface ParentReportsDTO {
  wards: WardOption[];
  reports: AvailableReport[];
  periods: PeriodOption[];
}

interface UseParentReportsOptions {
  wardId?: string;
}

/**
 * Hook to fetch available reports for parent's wards
 */
export function useParentReports(options: UseParentReportsOptions = {}) {
  const { wardId } = options;

  return useQuery<ParentReportsDTO>({
    queryKey: ["parent", "reports", wardId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (wardId) params.set("wardId", wardId);

      const res = await fetch(`/api/parent/reports?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch reports");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch reports");
      return json.data as ParentReportsDTO;
    },
    staleTime: 60_000,
  });
}
