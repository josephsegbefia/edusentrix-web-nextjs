/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";

export type PaymentInboxQueue =
  | "pending_approval"
  | "unmatched"
  | "needs_reconciliation"
  | "reversal_blocked";

export function usePendingPayments(filters: {
  queue?: PaymentInboxQueue;
  studentId?: string;
  invoiceId?: string;
  academicPeriodId?: string;
  page?: number;
  limit?: number;
}) {
  const {
    queue = "pending_approval",
    studentId,
    invoiceId,
    academicPeriodId,
    page = 1,
    limit = 10,
  } = filters;

  return useQuery({
    queryKey: [
      "pending-payments",
      queue,
      studentId,
      invoiceId,
      academicPeriodId,
      page,
      limit,
    ],
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set("queue", queue);
      if (studentId) sp.set("studentId", studentId);
      if (invoiceId) sp.set("invoiceId", invoiceId);
      if (academicPeriodId) sp.set("academicPeriodId", academicPeriodId);
      sp.set("page", String(page));
      sp.set("limit", String(limit));

      const res = await fetch(`/api/admin/fees/payments/pending?${sp.toString()}`, {
        cache: "no-store",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to fetch payment inbox");
      return payload as {
        queue: PaymentInboxQueue;
        queues: Array<{
          key: PaymentInboxQueue;
          label: string;
          description: string;
          slaHours: number;
          count: number;
        }>;
        alerts: Array<{
          id: string;
          severity: "info" | "warning" | "critical";
          title: string;
          description: string;
          count: number;
          queue?: PaymentInboxQueue;
        }>;
        kpis: {
          unreconciledCount: number;
          averageApprovalLagHours: number;
          reversalRatePct: number;
        };
        payments: any[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          pages: number;
        };
      };
    },
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    refetchInterval: 15_000,
  });
}
