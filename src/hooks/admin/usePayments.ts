// src/hooks/admin/usePayments.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toMinorUnits } from "@/lib/fees/money";

export interface Payment {
  _id: string;
  schoolId: string;
  studentId: {
    _id: string;
    firstName: string;
    lastName: string;
    admissionNo?: string;
  };
  invoiceId: {
    _id: string;
    invoiceNumber: string;
  };
  amountMinor: number;
  paymentDate: string;
  paymentMethod: "cash" | "bank_transfer" | "mobile_money" | "paystack" | "cheque" | "other";
  receiptNumber?: string;
  status: string;
  reconciliationStatus: string;
  receivedBy?: {
    name: string;
    email: string;
  };
  allocations: Array<{
    _id: string;
    amountMinor: number;
    invoiceLineItemId: {
      _id: string;
      name: string;
      amountMinor: number;
    };
    installmentScheduleId?: string;
    installmentNumber?: number;
  }>;
}

export interface CreatePaymentInput {
  invoiceId: string;
  amount: number;
  paymentMethod: "cash" | "bank_transfer" | "mobile_money" | "paystack" | "cheque" | "other";
  allocations: Array<{
    invoiceLineItemId: string;
    amount: number;
    installmentScheduleId?: string;
    installmentNumber?: number;
    notes?: string;
  }>;
  paymentDate?: string;
  notes?: string;
  receiptNumber?: string;
}

export function usePayments(filters?: {
  studentId?: string;
  invoiceId?: string;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery<{
    payments: Payment[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }>({
    queryKey: ["payments", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.studentId) params.append("studentId", filters.studentId);
      if (filters?.invoiceId) params.append("invoiceId", filters.invoiceId);
      if (filters?.paymentMethod) params.append("paymentMethod", filters.paymentMethod);
      if (filters?.dateFrom) params.append("dateFrom", filters.dateFrom);
      if (filters?.dateTo) params.append("dateTo", filters.dateTo);
      if (filters?.page) params.append("page", String(filters.page));
      if (filters?.limit) params.append("limit", String(filters.limit));

      const res = await fetch(`/api/admin/fees/payments?${params}`);
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePaymentInput) => {
      const res = await fetch("/api/admin/fees/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to record payment");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["invoice", variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["feeSummary"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
