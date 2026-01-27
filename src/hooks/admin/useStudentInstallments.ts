// src/hooks/admin/useStudentInstallments.ts
import { useQuery } from "@tanstack/react-query";

export type StudentInstallmentFilters = {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  upcomingOnly?: boolean;
};

export function useStudentInstallments(
  studentId: string | undefined,
  filters?: StudentInstallmentFilters
) {
  return useQuery({
    queryKey: ["student-installments", studentId, filters],
    queryFn: async () => {
      if (!studentId) return null;

      const params = new URLSearchParams();
      if (filters?.status) {
        params.set("status", filters.status);
      }
      if (filters?.dateFrom) {
        params.set("dateFrom", filters.dateFrom);
      }
      if (filters?.dateTo) {
        params.set("dateTo", filters.dateTo);
      }
      if (filters?.upcomingOnly) {
        params.set("upcomingOnly", "true");
      }

      const res = await fetch(
        `/api/admin/students/${studentId}/fees/installments?${params.toString()}`
      );
      if (!res.ok) throw new Error("Failed to fetch installments");
      return res.json();
    },
    enabled: !!studentId,
  });
}

