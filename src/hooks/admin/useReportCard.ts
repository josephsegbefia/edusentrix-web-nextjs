import { useQuery } from "@tanstack/react-query";
import type { ReportCardViewData } from "@/types/academics/report-card-view";

type ReportCardResponse = {
  success: boolean;
  data: ReportCardViewData;
  error?: string;
};

export function useReportCard(
  studentId: string | null | undefined,
  academicPeriodId: string | null | undefined
) {
  return useQuery<ReportCardViewData>({
    queryKey: ["report-card", studentId, academicPeriodId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/reports/cards?studentId=${studentId}&academicPeriodId=${academicPeriodId}`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as ReportCardResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load report card");
      }
      return json.data;
    },
    enabled: !!studentId && !!academicPeriodId,
  });
}

export function useReportTemplates() {
  return useQuery({
    queryKey: ["report-templates"],
    queryFn: async () => {
      const res = await fetch("/api/admin/reports/templates");
      if (!res.ok) {
        throw new Error("Failed to load report templates");
      }
      return res.json();
    },
  });
}
