import { useQuery } from "@tanstack/react-query";

export function useReportCard(
  studentId: string | null | undefined,
  academicPeriodId: string | null | undefined
) {
  return useQuery({
    queryKey: ["report-card", studentId, academicPeriodId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/reports/cards?studentId=${studentId}&academicPeriodId=${academicPeriodId}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to load report card");
      }
      return res.json();
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
