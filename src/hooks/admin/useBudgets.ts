// src/hooks/admin/useBudgets.ts
// React Query hooks for Budget management

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ========================
// Types
// ========================

export type BudgetPeriodType = "monthly" | "quarterly" | "termly" | "yearly";
export type BudgetStatus = "draft" | "active" | "closed";

export interface BudgetListItem {
  id: string;
  name: string;
  periodType: BudgetPeriodType;
  startDate: string;
  endDate: string;
  academicPeriod: {
    yearLabel?: string;
    term?: string;
  } | null;
  currency: string;
  totalBudgetedMinor: number;
  lineItemCount: number;
  status: BudgetStatus;
  notes: string | null;
  createdBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetLineItemWithActual {
  categoryId: string;
  categoryName: string;
  budgetedAmountMinor: number;
  actualAmountMinor: number;
  varianceMinor: number;
  percentUsed: number;
  notes?: string | null;
}

export interface BudgetDetail {
  id: string;
  name: string;
  periodType: BudgetPeriodType;
  startDate: string;
  endDate: string;
  academicPeriod: {
    yearLabel?: string;
    term?: string;
  } | null;
  currency: string;
  totalBudgetedMinor: number;
  totalActualMinor: number;
  totalVarianceMinor: number;
  percentUsed: number;
  lineItems: BudgetLineItemWithActual[];
  status: BudgetStatus;
  notes: string | null;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetLineItemInput {
  categoryId: string;
  budgetedAmountMinor: number;
  notes?: string;
}

export interface CreateBudgetInput {
  name: string;
  periodType: BudgetPeriodType;
  startDate: string;
  endDate: string;
  academicPeriodId?: string;
  currency?: string;
  lineItems: BudgetLineItemInput[];
  notes?: string;
  status?: "draft" | "active";
}

export interface UpdateBudgetInput {
  budgetId: string;
  name?: string;
  periodType?: BudgetPeriodType;
  startDate?: string;
  endDate?: string;
  academicPeriodId?: string | null;
  currency?: string;
  lineItems?: BudgetLineItemInput[];
  notes?: string | null;
  status?: BudgetStatus;
}

export interface BudgetFilters {
  status?: string;
  academicPeriodId?: string;
  page?: number;
  limit?: number;
}

// ========================
// List Budgets Hook
// ========================

export function useBudgets(filters: BudgetFilters = {}) {
  return useQuery({
    queryKey: ["budgets", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.academicPeriodId)
        params.set("academicPeriodId", filters.academicPeriodId);
      params.set("page", String(filters.page || 1));
      params.set("limit", String(filters.limit || 20));

      const res = await fetch(`/api/admin/finance/budgets?${params}`);
      if (!res.ok) throw new Error("Failed to fetch budgets");
      return res.json() as Promise<{
        data: BudgetListItem[];
        pagination: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
        };
      }>;
    },
    refetchOnWindowFocus: false,
  });
}

// ========================
// Budget Detail Hook
// ========================

export function useBudget(id: string | null) {
  return useQuery({
    queryKey: ["budget", id],
    queryFn: async () => {
      if (!id) return null;
      const res = await fetch(`/api/admin/finance/budgets/${id}`);
      if (!res.ok) throw new Error("Failed to fetch budget");
      const json = await res.json();
      return json.data as BudgetDetail;
    },
    enabled: !!id,
  });
}

// ========================
// Create Budget Mutation
// ========================

export function useCreateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBudgetInput) => {
      const res = await fetch("/api/admin/finance/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create budget");
      }
      return res.json() as Promise<{
        success: boolean;
        budgetId: string;
      }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}

// ========================
// Update Budget Mutation
// ========================

export function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateBudgetInput) => {
      const { budgetId, ...updateData } = data;
      const res = await fetch(`/api/admin/finance/budgets/${budgetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update budget");
      }
      return res.json() as Promise<{
        success: boolean;
        budgetId: string;
      }>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["budget", variables.budgetId] });
    },
  });
}

// ========================
// Delete Budget Mutation
// ========================

export function useDeleteBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (budgetId: string) => {
      const res = await fetch(`/api/admin/finance/budgets/${budgetId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete budget");
      }
      return res.json() as Promise<{ success: boolean }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}
