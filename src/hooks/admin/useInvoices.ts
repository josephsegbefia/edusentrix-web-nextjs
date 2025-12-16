// src/hooks/admin/useInvoices.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toMinorUnits } from "@/lib/fees/money";

export interface Invoice {
  _id: string;
  schoolId: string;
  studentId: {
    _id: string;
    firstName: string;
    lastName: string;
    admissionNo?: string;
  };
  academicPeriodId: {
    _id: string;
    yearLabel: string;
    term: string;
  };
  invoiceNumber: string;
  status: "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled";
  totalAmountMinor: number;
  totalPaidMinor: number;
  totalOutstandingMinor: number;
  totalCreditAppliedMinor: number;
  version: number;
  issueDate?: string | null;
  dueDate: string;
  paidDate?: string | null;
  notes?: string | null;
  terms?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  _id: string;
  invoiceId: string;
  feeStructureId?: string | null;
  name: string;
  description?: string | null;
  amountMinor: number;
  displayOrder: number;
  allowsInstallments: boolean;
  numberOfInstallments?: number | null;
  amountPaidMinor: number;
  amountOutstandingMinor: number;
  isFullyPaid: boolean;
  status: "pending" | "partially_paid" | "paid" | "overdue";
  isAdjustment: boolean;
  adjustmentType?: "waiver" | "scholarship" | "correction" | "penalty" | "other" | null;
  adjustmentReason?: string | null;
  adjustedBy?: string | null;
  installments?: Array<{
    _id: string;
    installmentNumber: number;
    dueDate: string;
    amountMinor: number;
    amountPaidMinor: number;
    amountOutstandingMinor: number;
    status: "pending" | "partially_paid" | "paid" | "overdue";
  }>;
}

export interface Payment {
  _id: string;
  amountMinor: number;
  paymentDate: string;
  paymentMethod: string;
  receiptNumber?: string;
  status: string;
  allocations: Array<{
    _id: string;
    amountMinor: number;
    invoiceLineItemId: {
      _id: string;
      name: string;
      amountMinor: number;
    };
  }>;
}

export interface InvoiceDetail extends Invoice {
  lineItems: InvoiceLineItem[];
  payments: Payment[];
  events: Array<{
    _id: string;
    eventType: string;
    description: string;
    createdAt: string;
    performedBy?: {
      name: string;
      email: string;
    };
  }>;
}

export interface CreateInvoiceInput {
  studentId: string;
  academicPeriodId: string;
  lineItems: Array<{
    feeStructureId?: string;
    name: string;
    description?: string;
    amount: number;
    allowsInstallments?: boolean;
    numberOfInstallments?: number;
  }>;
  dueDate?: string;
  notes?: string;
  terms?: string;
}

export function useInvoices(filters?: {
  studentId?: string;
  academicPeriodId?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery<{
    invoices: Invoice[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }>({
    queryKey: ["invoices", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.studentId) params.append("studentId", filters.studentId);
      if (filters?.academicPeriodId) params.append("academicPeriodId", filters.academicPeriodId);
      if (filters?.status) params.append("status", filters.status);
      if (filters?.page) params.append("page", String(filters.page));
      if (filters?.limit) params.append("limit", String(filters.limit));

      const res = await fetch(`/api/admin/fees/invoices?${params}`);
      if (!res.ok) throw new Error("Failed to fetch invoices");
      return res.json();
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}

export function useInvoice(id: string) {
  return useQuery<{ invoice: InvoiceDetail }>({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/fees/invoices/${id}`);
      if (!res.ok) throw new Error("Failed to fetch invoice");
      return res.json();
    },
    enabled: !!id,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateInvoiceInput) => {
      const res = await fetch("/api/admin/fees/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create invoice");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["feeSummary"] });
    },
  });
}

export function useBulkIssueInvoices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/admin/fees/invoices/bulk/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceIds: ids }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to bulk issue invoices");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["feeSummary"] });
    },
  });
}

export function useIssueInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/fees/invoices/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "issue" }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to issue invoice");
      }
      return res.json();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["feeSummary"] });
    },
  });
}

export function useBulkCancelInvoices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceIds: string[]) => {
      const res = await fetch(`/api/admin/fees/invoices/bulk/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceIds }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to bulk cancel invoices");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["feeSummary"] });
    },
  });
}

export function useBulkExportInvoices() {
  return useMutation({
    mutationFn: async (invoiceIds: string[]) => {
      const res = await fetch(`/api/admin/fees/invoices/bulk/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceIds }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to export invoices");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoices-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      return { success: true };
    },
  });
}

export function useCancelInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/fees/invoices/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to cancel invoice");
      }
      return res.json();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["feeSummary"] });
    },
  });
}

export interface AddAdjustmentInput {
  invoiceId: string;
  lineItems: Array<{
    name: string;
    description?: string;
    amount: number;
    adjustmentType: "waiver" | "scholarship" | "correction" | "penalty" | "other";
    adjustmentReason: string;
  }>;
}

export function useAddAdjustment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddAdjustmentInput) => {
      const res = await fetch(`/api/admin/fees/invoices/${data.invoiceId}/adjustments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add adjustments");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice", variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["feeSummary"] });
    },
  });
}
