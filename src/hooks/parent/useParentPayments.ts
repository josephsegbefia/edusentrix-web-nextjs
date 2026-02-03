// src/hooks/parent/useParentPayments.ts
import { useQuery } from "@tanstack/react-query";

export interface PaymentRecord {
  id: string;
  wardId: string;
  wardName: string;
  amount: number;
  date: string;
  method: string;
  reference: string;
  invoiceTitle: string;
  notes: string;
}

export interface WardOption {
  id: string;
  name: string;
}

export interface PaymentSummary {
  totalPayments: number;
  totalAmount: number;
  thisMonthAmount: number;
  thisYearAmount: number;
}

export interface ParentPaymentsDTO {
  payments: PaymentRecord[];
  wards: WardOption[];
  summary: PaymentSummary;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface UseParentPaymentsOptions {
  limit?: number;
  offset?: number;
  wardId?: string;
  year?: string;
  month?: string;
}

/**
 * Hook to fetch payment history for all wards
 */
export function useParentPayments(options: UseParentPaymentsOptions = {}) {
  const { limit = 50, offset = 0, wardId, year, month } = options;

  return useQuery<ParentPaymentsDTO>({
    queryKey: ["parent", "payments", limit, offset, wardId, year, month],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      if (wardId) params.set("wardId", wardId);
      if (year) params.set("year", year);
      if (month) params.set("month", month);

      const res = await fetch(`/api/parent/payments?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch payments");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch payments");
      return json.data as ParentPaymentsDTO;
    },
    staleTime: 60_000,
  });
}
