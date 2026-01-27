// src/hooks/admin/useFeeSummary.ts
import { useQuery } from "@tanstack/react-query";

export interface FeeSummary {
  totalRevenueMinor: number;
  monthlyRevenueMinor: number;
  totalOutstandingMinor: number;
  totalBilledMinor: number;
  collectionRate: number;
  overdueCount: number;
}

export interface StatusCounts {
  draft: number;
  issued: number;
  partially_paid: number;
  paid: number;
  overdue: number;
  cancelled: number;
}

export interface UpcomingDueItem {
  _id: string;
  invoiceNumber: string;
  dueDate: string;
  totalOutstandingMinor: number;
  studentId: {
    firstName: string;
    lastName: string;
    admissionNo?: string;
  };
  academicPeriodId?: {
    yearLabel?: string;
    term?: string;
  };
}

export interface DefaulterItem {
  studentId: string;
  firstName: string;
  lastName: string;
  admissionNo?: string;
  totalOutstandingMinor: number;
  invoiceCount: number;
  latestDueDate?: string;
}

export interface RecentPayment {
  _id: string;
  amountMinor: number;
  paymentDate: string;
  paymentMethod: string;
  receiptNumber?: string;
  studentId: {
    firstName: string;
    lastName: string;
  };
  invoiceId: {
    invoiceNumber: string;
  };
}

export function useFeeSummary() {
  return useQuery<{
    summary: FeeSummary;
    statusCounts: StatusCounts;
    upcomingDue: UpcomingDueItem[];
    defaulters: DefaulterItem[];
    recentPayments: RecentPayment[];
  }>({
    queryKey: ["feeSummary"],
    queryFn: async () => {
      const res = await fetch("/api/admin/fees/summary");
      if (!res.ok) throw new Error("Failed to fetch fee summary");
      return res.json();
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: 1000 * 30, // 30 seconds
  });
}
