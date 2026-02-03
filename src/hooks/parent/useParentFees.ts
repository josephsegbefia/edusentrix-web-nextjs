// src/hooks/parent/useParentFees.ts
import { useQuery } from "@tanstack/react-query";

export type FeeStatus = "clear" | "partial" | "owing";
export type InvoiceStatus = "pending" | "partial" | "overdue";

export interface WardFeeSummary {
  wardId: string;
  wardName: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  classGroup: string;
  totalFees: number;
  amountPaid: number;
  balanceDue: number;
  paymentProgress: number;
  status: FeeStatus;
  pendingInvoices: number;
  overdueInvoices: number;
}

export interface PendingInvoice {
  id: string;
  wardId: string;
  wardName: string;
  title: string;
  amount: number;
  balanceDue: number;
  dueDate: string;
  status: InvoiceStatus;
  isOverdue: boolean;
}

export interface RecentPayment {
  id: string;
  wardId: string;
  wardName: string;
  amount: number;
  date: string;
  method: string;
  reference: string;
}

export interface OverallFeeSummary {
  totalFees: number;
  totalPaid: number;
  totalBalance: number;
  paymentProgress: number;
  pendingCount: number;
  overdueCount: number;
}

export interface ParentFeesDTO {
  wards: WardFeeSummary[];
  pendingInvoices: PendingInvoice[];
  overallSummary: OverallFeeSummary;
  recentPayments: RecentPayment[];
}

/**
 * Hook to fetch fees data for all wards
 */
export function useParentFees() {
  return useQuery<ParentFeesDTO>({
    queryKey: ["parent", "fees"],
    queryFn: async () => {
      const res = await fetch("/api/parent/fees", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch fees");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch fees");
      return json.data as ParentFeesDTO;
    },
    staleTime: 60_000,
  });
}
