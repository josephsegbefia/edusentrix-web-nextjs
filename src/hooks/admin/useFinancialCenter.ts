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

export type ReconciliationStatus =
  | "unmatched"
  | "matched"
  | "disputed"
  | "ignored";

export type ReconciliationProvider =
  | "paystack"
  | "hubtel"
  | "mtn_momo"
  | "bank"
  | "manual";

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
    status: ReconciliationStatus;
    provider?: ReconciliationProvider | null;
    providerReference?: string | null;
    settlementBatchId?: string | null;
    matchedAt?: string | null;
    matchedBy?: string | null;
  } | null;
  policy?: {
    dualControl?: {
      required: boolean;
      triggers: string[];
      thresholdMinor: number;
      actorConflict: boolean;
    };
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

export type FinanceWorkQueueSeverity = "info" | "warning" | "critical";

export interface FinanceCommandCenterDTO {
  context: {
    schoolId: string;
    academicPeriodId: string | null;
    academicPeriodLabel: string | null;
    range: { start: string; end: string; label: string };
    currency: string;
    lastRefreshedAt: string;
  };
  kpis: {
    collectedMinor: number;
    collectedCount: number;
    outstandingFeesMinor: number;
    overdueFeesMinor: number;
    overdueStudentCount: number;
    pendingApprovalCount: number;
    pendingApprovalMinor: number;
    unreconciledCount: number;
    unreconciledMinor: number;
    netCashMovementMinor: number;
    failedTransactionCount: number;
    failedTransactionMinor: number;
  };
  workQueue: Array<{
    id: string;
    type: string;
    severity: FinanceWorkQueueSeverity;
    title: string;
    description: string;
    href: string;
    count?: number;
    amountMinor?: number;
    leoEnabled: boolean;
    evidence?: Array<{ label: string; value: string }>;
  }>;
  trust: {
    status: "healthy" | "needs_review" | "critical";
    lastReconciliationAt: string | null;
    matchedCount: number;
    unmatchedCount: number;
    ambiguousCount: number;
    activeAlertCount: number;
    criticalAlertCount: number;
    failedTransactionCount: number;
    makerCheckerPendingCount: number;
    paymentSetupStatus: string | null;
  };
  fees: {
    totalBilledMinor: number;
    totalCollectedMinor: number;
    totalOutstandingMinor: number;
    collectionRate: number;
    topOverdue: Array<{
      studentId: string;
      studentName: string;
      guardianName: string | null;
      className: string | null;
      amountMinor: number;
      latestDueDate: string | null;
      invoiceCount: number;
    }>;
  };
  reconciliation: {
    latestRunId: string | null;
    matchedCount: number;
    unmatchedCount: number;
    ambiguousCount: number;
    ignoredCount: number;
    activeAlerts: Array<{
      id: string;
      title: string;
      severity: FinanceWorkQueueSeverity;
      count: number;
      description: string;
    }>;
  };
  expenses: {
    pendingApprovalCount: number;
    pendingApprovalMinor: number;
    recent: Array<{
      id: string;
      title: string;
      expenseNumber: string;
      status: string;
      amountMinor: number;
      currency: string;
      expenseDate: string | null;
    }>;
  };
}

export interface FinanceLeoBriefDTO {
  summary: string;
  riskLevel: "healthy" | "needs_review" | "critical";
  risks: string[];
  recommendedActions: Array<{
    title: string;
    href: string;
    reason: string;
  }>;
  evidence: Array<{ label: string; value: string }>;
  guardrail: string;
}

export type FinanceReportType =
  | "collections"
  | "debtors"
  | "invoices"
  | "cashbook"
  | "reconciliation"
  | "disbursements";

export interface FinanceReportCommentaryDTO {
  reportType: FinanceReportType;
  title: string;
  commentary: string;
  highlights: string[];
  risks: string[];
  evidence: Array<{ label: string; value: string }>;
  guardrail: string;
}

export interface FinanceLeoExplanationDTO {
  title: string;
  explanation: string;
  evidence: string[];
  nextAction: string;
  href: string;
  guardrail: string;
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

export function useFinanceCommandCenter(options?: {
  range?: RangeType;
  dateFrom?: string;
  dateTo?: string;
  academicPeriodId?: string;
  gradeId?: string;
  classGroupId?: string;
}) {
  return useQuery({
    queryKey: ["finance-command-center", options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.range) params.set("range", options.range);
      if (options?.dateFrom) params.set("dateFrom", options.dateFrom);
      if (options?.dateTo) params.set("dateTo", options.dateTo);
      if (options?.academicPeriodId) params.set("academicPeriodId", options.academicPeriodId);
      if (options?.gradeId) params.set("gradeId", options.gradeId);
      if (options?.classGroupId) params.set("classGroupId", options.classGroupId);

      const res = await fetch(`/api/admin/finance/command-center?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null) as
        | { success?: boolean; data?: FinanceCommandCenterDTO; error?: string }
        | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || "Failed to fetch finance command center");
      }
      return json.data;
    },
    refetchOnWindowFocus: false,
    staleTime: 15_000,
  });
}

export function useFinanceLeoBrief(commandCenter: FinanceCommandCenterDTO | undefined) {
  return useQuery({
    queryKey: ["finance-leo-brief", commandCenter?.context.lastRefreshedAt, commandCenter?.trust.status],
    enabled: Boolean(commandCenter),
    queryFn: async () => {
      const res = await fetch("/api/admin/finance/leo-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commandCenter }),
      });
      const json = await res.json().catch(() => null) as
        | { success?: boolean; data?: FinanceLeoBriefDTO; error?: string }
        | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || "Failed to build Leo finance brief");
      }
      return json.data;
    },
    refetchOnWindowFocus: false,
    staleTime: 15_000,
  });
}

export function useFinanceReportCommentary() {
  return useMutation({
    mutationFn: async (payload: {
      reportType: FinanceReportType;
      commandCenter: FinanceCommandCenterDTO;
    }) => {
      const res = await fetch("/api/admin/finance/report-commentary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null) as
        | { success?: boolean; data?: FinanceReportCommentaryDTO; error?: string }
        | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || "Failed to generate finance report commentary");
      }
      return json.data;
    },
  });
}

export function useFinanceLeoExplainQueueItem() {
  return useMutation({
    mutationFn: async (payload: {
      item: {
        title: string;
        description: string;
        severity: FinanceWorkQueueSeverity;
        count?: number;
        amountMinor?: number;
        href: string;
      };
      trustStatus?: "healthy" | "needs_review" | "critical";
    }) => {
      const res = await fetch("/api/admin/finance/leo-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null) as
        | { success?: boolean; data?: FinanceLeoExplanationDTO; error?: string }
        | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || "Failed to explain finance queue item");
      }
      return json.data;
    },
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

// ========================
// Reconciliation Mutation
// ========================

export interface ReconcileTransactionInput {
  transactionId: string;
  action: "match" | "unmatch" | "dispute" | "ignore";
  provider?: ReconciliationProvider;
  providerReference?: string;
  settlementBatchId?: string;
  reason?: string;
}

export function useReconcileTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ReconcileTransactionInput) => {
      const res = await fetch(
        `/api/admin/finance/transactions/${data.transactionId}/reconcile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: data.action,
            provider: data.provider,
            providerReference: data.providerReference,
            settlementBatchId: data.settlementBatchId,
            reason: data.reason,
          }),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to reconcile transaction");
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
