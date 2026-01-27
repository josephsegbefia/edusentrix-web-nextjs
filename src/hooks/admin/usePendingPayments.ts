/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";

export function usePendingPayments(filters: {
  studentId?: string;
  invoiceId?: string;
  academicPeriodId?: string;
  page?: number;
  limit?: number;
}) {
  const {
    studentId,
    invoiceId,
    academicPeriodId,
    page = 1,
    limit = 10,
  } = filters;

  return useQuery({
    queryKey: [
      "pending-payments",
      studentId,
      invoiceId,
      academicPeriodId,
      page,
      limit,
    ],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (studentId) sp.set("studentId", studentId);
      if (invoiceId) sp.set("invoiceId", invoiceId);
      if (academicPeriodId) sp.set("academicPeriodId", academicPeriodId);
      sp.set("page", String(page));
      sp.set("limit", String(limit));

      const res = await fetch(
        `/api/admin/fees/payments/pending?${sp.toString()}`,
        {
          cache: "no-store",
        }
      );
      if (!res.ok) throw new Error("Failed to fetch pending payments");
      return res.json() as Promise<{
        payments: any[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          pages: number;
        };
      }>;
    },
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
}
