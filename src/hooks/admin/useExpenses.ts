// src/hooks/admin/useExpenses.ts
// React Query hooks for expense management

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ========================
// Types
// ========================

export interface ExpenseCategoryDTO {
  _id: string;
  schoolId: string;
  name: string;
  code?: string | null;
  parentId?: string | null;
  description?: string | null;
  isActive: boolean;
  createdBy: { _id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface VendorDTO {
  _id: string;
  schoolId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  taxId?: string | null;
  bankDetails?: {
    bankName?: string | null;
    accountNumber?: string | null;
    accountName?: string | null;
  } | null;
  notes?: string | null;
  isActive: boolean;
  createdBy: { _id: string; name: string; email: string } | null;
  stats?: {
    expenseCount: number;
    totalSpentMinor: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseReceiptDTO {
  url: string;
  type: "image" | "pdf";
  name?: string | null;
  uploadedAt: string;
  uploadedBy: string;
}

export type ExpenseStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "paid"
  | "cancelled";

export type ExpensePaymentMethod =
  | "cash"
  | "mobile_money"
  | "bank_transfer"
  | "cheque"
  | "card"
  | "other";

export type ExpenseCostCenter =
  | "admin"
  | "academics"
  | "maintenance"
  | "transport"
  | "ict"
  | "events"
  | "welfare"
  | "other";

export interface ExpenseDTO {
  _id: string;
  schoolId: string;
  expenseNumber: string;
  status: ExpenseStatus;
  title: string;
  description?: string | null;
  categoryId: { _id: string; name: string; code?: string } | string;
  vendorId?: { _id: string; name: string } | string | null;
  amountMinor: number;
  currency: string;
  expenseDate: string;
  paymentMethod?: ExpensePaymentMethod | null;
  paymentReference?: string | null;
  paidAt?: string | null;
  paidBy?: { _id: string; name: string; email: string } | null;
  receipts: ExpenseReceiptDTO[];
  costCenter?: ExpenseCostCenter | null;
  academicPeriodId?: { _id: string; name: string } | string | null;
  submittedAt?: string | null;
  submittedBy?: { _id: string; name: string; email: string } | null;
  approvedAt?: string | null;
  approvedBy?: { _id: string; name: string; email: string } | null;
  approvalNote?: string | null;
  rejectedAt?: string | null;
  rejectedBy?: { _id: string; name: string; email: string } | null;
  rejectionReason?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: { _id: string; name: string; email: string } | null;
  cancellationReason?: string | null;
  lockedAt?: string | null;
  lockReason?: "approved" | "paid" | null;
  financialTransactionId?: string | null;
  notes?: string | null;
  tags?: string[];
  createdBy: { _id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseFilters {
  status?: string;
  categoryId?: string;
  vendorId?: string;
  method?: string;
  costCenter?: string;
  academicPeriodId?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ========================
// Categories Hooks
// ========================

export function useExpenseCategories(includeInactive = false) {
  return useQuery({
    queryKey: ["expense-categories", { includeInactive }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (includeInactive) params.set("includeInactive", "true");

      const res = await fetch(`/api/admin/expenses/categories?${params}`);
      if (!res.ok) throw new Error("Failed to fetch categories");
      const json = await res.json();
      return json.data as ExpenseCategoryDTO[];
    },
  });
}

export function useCreateExpenseCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      code?: string;
      parentId?: string;
      description?: string;
    }) => {
      const res = await fetch("/api/admin/expenses/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create category");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
    },
  });
}

export function useUpdateExpenseCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      code?: string;
      description?: string;
      isActive?: boolean;
    }) => {
      const res = await fetch(`/api/admin/expenses/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update category");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
    },
  });
}

export function useSeedDefaultCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/expenses/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed_defaults" }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to seed categories");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
    },
  });
}

// ========================
// Vendors Hooks
// ========================

export function useVendors(options?: { includeInactive?: boolean; q?: string }) {
  return useQuery({
    queryKey: ["vendors", options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.includeInactive) params.set("includeInactive", "true");
      if (options?.q) params.set("q", options.q);
      params.set("limit", "100");

      const res = await fetch(`/api/admin/expenses/vendors?${params}`);
      if (!res.ok) throw new Error("Failed to fetch vendors");
      const json = await res.json();
      return json.data as VendorDTO[];
    },
  });
}

export function useVendor(id: string | null) {
  return useQuery({
    queryKey: ["vendor", id],
    queryFn: async () => {
      if (!id) return null;
      const res = await fetch(`/api/admin/expenses/vendors/${id}`);
      if (!res.ok) throw new Error("Failed to fetch vendor");
      const json = await res.json();
      return json.data as VendorDTO;
    },
    enabled: !!id,
  });
}

export function useCreateVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      phone?: string;
      email?: string;
      address?: string;
      contactPerson?: string;
      taxId?: string;
      bankDetails?: {
        bankName?: string;
        accountNumber?: string;
        accountName?: string;
      };
      notes?: string;
    }) => {
      const res = await fetch("/api/admin/expenses/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create vendor");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
  });
}

export function useUpdateVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      phone?: string;
      email?: string;
      address?: string;
      contactPerson?: string;
      taxId?: string;
      bankDetails?: {
        bankName?: string;
        accountNumber?: string;
        accountName?: string;
      };
      notes?: string;
      isActive?: boolean;
    }) => {
      const res = await fetch(`/api/admin/expenses/vendors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update vendor");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["vendor", variables.id] });
    },
  });
}

// ========================
// Expenses Hooks
// ========================

export function useExpenses(filters: ExpenseFilters = {}) {
  return useQuery({
    queryKey: ["expenses", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.categoryId) params.set("categoryId", filters.categoryId);
      if (filters.vendorId) params.set("vendorId", filters.vendorId);
      if (filters.method) params.set("method", filters.method);
      if (filters.costCenter) params.set("costCenter", filters.costCenter);
      if (filters.academicPeriodId)
        params.set("academicPeriodId", filters.academicPeriodId);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      if (filters.q) params.set("q", filters.q);
      params.set("page", String(filters.page || 1));
      params.set("limit", String(filters.limit || 20));
      if (filters.sortBy) params.set("sortBy", filters.sortBy);
      if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);

      const res = await fetch(`/api/admin/expenses?${params}`);
      if (!res.ok) throw new Error("Failed to fetch expenses");
      return res.json() as Promise<{
        data: ExpenseDTO[];
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

export function useExpense(id: string | null) {
  return useQuery({
    queryKey: ["expense", id],
    queryFn: async () => {
      if (!id) return null;
      const res = await fetch(`/api/admin/expenses/${id}`);
      if (!res.ok) throw new Error("Failed to fetch expense");
      const json = await res.json();
      return json.data as ExpenseDTO;
    },
    enabled: !!id,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      categoryId: string;
      vendorId?: string;
      amountMinor: number;
      currency?: string;
      expenseDate?: string;
      costCenter?: ExpenseCostCenter;
      academicPeriodId?: string;
      receipts?: ExpenseReceiptDTO[];
      notes?: string;
      tags?: string[];
    }) => {
      const res = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create expense");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      title?: string;
      description?: string;
      categoryId?: string;
      vendorId?: string | null;
      amountMinor?: number;
      currency?: string;
      expenseDate?: string;
      costCenter?: ExpenseCostCenter | null;
      academicPeriodId?: string | null;
      receipts?: ExpenseReceiptDTO[];
      notes?: string;
      tags?: string[];
    }) => {
      const res = await fetch(`/api/admin/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update expense");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense", variables.id] });
    },
  });
}

// ========================
// Expense Workflow Hooks
// ========================

export function useSubmitExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/expenses/${id}/submit`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit expense");
      }
      return res.json();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense", id] });
    },
  });
}

export function useApproveExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      const res = await fetch(`/api/admin/expenses/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to approve expense");
      }
      return res.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense", id] });
    },
  });
}

export function useRejectExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/admin/expenses/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to reject expense");
      }
      return res.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense", id] });
    },
  });
}

export function useMarkExpensePaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      paymentMethod,
      paymentReference,
      paidAt,
    }: {
      id: string;
      paymentMethod: ExpensePaymentMethod;
      paymentReference?: string;
      paidAt?: string;
    }) => {
      const res = await fetch(`/api/admin/expenses/${id}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod, paymentReference, paidAt }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to mark expense as paid");
      }
      return res.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense", id] });
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
    },
  });
}

export function useCancelExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/admin/expenses/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to cancel expense");
      }
      return res.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense", id] });
    },
  });
}
