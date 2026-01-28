// src/hooks/admin/useFinancialCenter.ts
// React Query hooks for Financial Center

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ========================
// Types
// ========================

export type TransactionDirection = "inflow" | "outflow";

export type TransactionStatus =
  | "pending"
  | "processing"
  | "success"
  | "failed"
  | "refunded"
  | "reversed"
  | "voided"
  | "disputed"
  | "held";

export type TransactionCategory =
  | "fees"
  | "store"
  | "fundraising"
  | "expenses"
  | "other_income"
  | "refund"
  | "adjustment"
  | "gateway_fee"
  | "bank_charge"
  | "penalty"
  | "discount";

export type TransactionSourceModule =
  | "fees"
  | "store"
  | "community"
  | "fundraising"
  | "expenses"
  | "manual";

export type TransactionMethod =
  | "cash"
  | "mobile_money"
  | "bank_transfer"
  | "card"
  | "cheque"
  | "other";

export interface TransactionPartyDTO {
  type: "student" | "guardian" | "vendor" | "staff" | "donor" | "other";
  id?: string | null;
  name: string;
  contact?: {
    phone?: string | null;
    email?: string | null;
  };
}

export interface TransactionAttachmentDTO {
  url: string;
  type: "image" | "pdf";
  name?: string | null;
  uploadedAt: string;
  uploadedBy?: string | null;
}

export interface TransactionDTO {
  _id: string;
  schoolId: string;
  direction: TransactionDirection;
  status: TransactionStatus;
  grossAmountMinor: number;
  feeAmountMinor: number;
  netAmountMinor: number;
  currency: string;
  occurredAt: string;
  category: TransactionCategory;
  sourceModule: TransactionSourceModule;
  sourceId?: string | null;
  method: TransactionMethod;
  channel?: string | null;
  reference?: string | null;
  description?: string | null;
  tags?: string[];
  notes?: string | null;
  party?: TransactionPartyDTO | null;
  academicPeriodId?: {
    _id: string;
    name: string;
    term: string;
    yearLabel: string;
  } | null;
  reconciliation?: {
    status: "unmatched" | "matched" | "disputed" | "ignored";
    provider?: string | null;
    providerReference?: string | null;
  } | null;
  attachments?: TransactionAttachmentDTO[];
  createdBy?: { _id: string; name: string; email: string } | null;
  finalizedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialOverviewDTO {
  kpis: {
    totalInflow: number;
    totalOutflow: number;
    netPosition: number;
    inflowCount: number;
    outflowCount: number;
    pendingCount: number;
    pendingAmount: number;
    failedCount: number;
    failedAmount: number;
    inflowChange: number | null;
    outflowChange: number | null;
  };
  breakdowns: {
    inflowByCategory: Record<string, { total: number; count: number }>;
    outflowByCategory: Record<string, { total: number; count: number }>;
  };
  dailyTrend: Array<{
    _id: string;
    inflow: number;
    outflow: number;
  }>;
  recentTransactions: TransactionDTO[];
  range: {
    type: string;
    start: string;
    end: string;
  };
}

export type RangeType = "today" | "this_week" | "this_month" | "last_30_days" | "custom";

export interface TransactionFilters {
  status?: string;
  direction?: string;
  category?: string;
  sourceModule?: string;
  method?: string;
  reconciliationStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  q?: string;
  academicPeriodId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ========================
// Overview Hook
// ========================

export function useFinancialOverview(options?: {
  range?: RangeType;
  dateFrom?: string;
  dateTo?: string;
  compare?: boolean;
}) {
  return useQuery({
    queryKey: ["financial-overview", options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.range) params.set("range", options.range);
      if (options?.dateFrom) params.set("dateFrom", options.dateFrom);
      if (options?.dateTo) params.set("dateTo", options.dateTo);
      if (options?.compare) params.set("compare", "true");

      const res = await fetch(`/api/admin/finance/overview?${params}`);
      if (!res.ok) throw new Error("Failed to fetch financial overview");
      const json = await res.json();
      return json.data as FinancialOverviewDTO;
    },
    refetchOnWindowFocus: false,
  });
}

// ========================
// Transactions Hook
// ========================

export function useFinancialTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ["financial-transactions", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.direction) params.set("direction", filters.direction);
      if (filters.category) params.set("category", filters.category);
      if (filters.sourceModule) params.set("sourceModule", filters.sourceModule);
      if (filters.method) params.set("method", filters.method);
      if (filters.reconciliationStatus)
        params.set("reconciliationStatus", filters.reconciliationStatus);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      if (filters.amountMin) params.set("amountMin", String(filters.amountMin));
      if (filters.amountMax) params.set("amountMax", String(filters.amountMax));
      if (filters.q) params.set("q", filters.q);
      if (filters.academicPeriodId)
        params.set("academicPeriodId", filters.academicPeriodId);
      params.set("page", String(filters.page || 1));
      params.set("limit", String(filters.limit || 20));
      if (filters.sortBy) params.set("sortBy", filters.sortBy);
      if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);

      const res = await fetch(`/api/admin/finance/transactions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json() as Promise<{
        data: TransactionDTO[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          pages: number;
        };
      }>;
    },
  });
}

// ========================
// Transaction Detail Hook
// ========================

export function useFinancialTransaction(id: string | null) {
  return useQuery({
    queryKey: ["financial-transaction", id],
    queryFn: async () => {
      if (!id) return null;
      const res = await fetch(`/api/admin/finance/transactions/${id}`);
      if (!res.ok) throw new Error("Failed to fetch transaction");
      const json = await res.json();
      return json.data as TransactionDTO & {
        _original?: TransactionDTO | null;
        _correction?: TransactionDTO | null;
      };
    },
    enabled: !!id,
  });
}

// ========================
// Manual Transaction Types
// ========================

export type ManualTransactionCategory =
  | "other_income"
  | "refund"
  | "adjustment"
  | "gateway_fee"
  | "bank_charge"
  | "penalty"
  | "discount";

export interface ManualTransactionInput {
  direction: TransactionDirection;
  category: ManualTransactionCategory;
  grossAmountMinor: number;
  feeAmountMinor?: number;
  currency?: string;
  occurredAt?: string;
  method: TransactionMethod;
  reference?: string;
  description: string;
  notes?: string;
  partyName?: string;
  partyType?: "student" | "guardian" | "vendor" | "staff" | "donor" | "other";
  partyEmail?: string;
  partyPhone?: string;
  academicPeriodId?: string;
  tags?: string[];
  requiresApproval?: boolean;
}

// ========================
// Manual Transaction Mutation
// ========================

export function useCreateManualTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ManualTransactionInput) => {
      const res = await fetch("/api/admin/finance/transactions/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create transaction");
      }
      return res.json() as Promise<{
        success: boolean;
        transactionId: string;
        status: string;
        message: string;
      }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-overview"] });
    },
  });
}

// ========================
// Transaction Approval Mutation
// ========================

export interface ApprovalInput {
  transactionId: string;
  action: "approve" | "reject";
  reviewNotes?: string;
}

export function useApproveTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ApprovalInput) => {
      const res = await fetch(
        `/api/admin/finance/transactions/${data.transactionId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: data.action,
            reviewNotes: data.reviewNotes,
          }),
        }
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to process approval");
      }
      return res.json() as Promise<{
        success: boolean;
        action: string;
        message: string;
      }>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-overview"] });
      queryClient.invalidateQueries({
        queryKey: ["financial-transaction", variables.transactionId],
      });
    },
  });
}
