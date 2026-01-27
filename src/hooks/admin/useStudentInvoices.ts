// src/hooks/admin/useStudentInvoices.ts
import { useQuery } from "@tanstack/react-query";

export type StudentInvoiceFilters = {
  academicPeriodId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

export function useStudentInvoices(
  studentId: string | undefined,
  filters?: StudentInvoiceFilters
) {
  return useQuery({
    queryKey: ["student-invoices", studentId, filters],
    queryFn: async () => {
      if (!studentId) return null;

      const params = new URLSearchParams();
      if (filters?.academicPeriodId) {
        params.set("academicPeriodId", filters.academicPeriodId);
      }
      if (filters?.status) {
        params.set("status", filters.status);
      }
      if (filters?.dateFrom) {
        params.set("dateFrom", filters.dateFrom);
      }
      if (filters?.dateTo) {
        params.set("dateTo", filters.dateTo);
      }
      if (filters?.page) {
        params.set("page", String(filters.page));
      }
      if (filters?.limit) {
        params.set("limit", String(filters.limit));
      }

      const res = await fetch(
        `/api/admin/students/${studentId}/fees/invoices?${params.toString()}`
      );
      if (!res.ok) throw new Error("Failed to fetch invoices");
      return res.json();
    },
    enabled: !!studentId,
  });
}

