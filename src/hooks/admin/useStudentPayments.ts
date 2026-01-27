// src/hooks/admin/useStudentPayments.ts
import { useQuery } from "@tanstack/react-query";

export type StudentPaymentFilters = {
  invoiceId?: string;
  paymentMethod?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

export function useStudentPayments(
  studentId: string | undefined,
  filters?: StudentPaymentFilters
) {
  return useQuery({
    queryKey: ["student-payments", studentId, filters],
    queryFn: async () => {
      if (!studentId) return null;

      const params = new URLSearchParams();
      if (filters?.invoiceId) {
        params.set("invoiceId", filters.invoiceId);
      }
      if (filters?.paymentMethod) {
        params.set("paymentMethod", filters.paymentMethod);
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
        `/api/admin/students/${studentId}/fees/payments?${params.toString()}`
      );
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
    enabled: !!studentId,
  });
}

