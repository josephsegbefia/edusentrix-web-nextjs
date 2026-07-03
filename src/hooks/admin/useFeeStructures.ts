// src/hooks/admin/useFeeStructures.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateSetupReadiness } from "@/lib/query/invalidate-setup-readiness";
import { formatAmount, toMinorUnits } from "@/lib/fees/money";

export interface FeeStructure {
  _id: string;
  schoolId: string;
  name: string;
  code: string;
  description?: string | null;
  category: "tuition" | "library" | "sports" | "uniform" | "other";
  isActive: boolean;
  defaultAmountMinor?: number | null;
  allowsInstallments: boolean;
  maxInstallments?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeeStructureInput {
  name: string;
  code: string;
  description?: string;
  category: "tuition" | "library" | "sports" | "uniform" | "other";
  isActive?: boolean;
  defaultAmount?: number;
  allowsInstallments?: boolean;
  maxInstallments?: number;
}

/** PATCH accepts null to clear optional fields (aligned with API) */
export type UpdateFeeStructureInput = Omit<
  Partial<CreateFeeStructureInput>,
  "description" | "maxInstallments"
> & {
  description?: string | null;
  maxInstallments?: number | null;
};

export function useFeeStructures(filters?: {
  category?: string;
  isActive?: boolean;
}) {
  return useQuery<{ structures: FeeStructure[] }>({
    queryKey: ["feeStructures", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.category) params.append("category", filters.category);
      if (filters?.isActive !== undefined) params.append("isActive", String(filters.isActive));

      const res = await fetch(`/api/admin/fees/structures?${params}`);
      if (!res.ok) throw new Error("Failed to fetch fee structures");
      return res.json();
    },
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
    refetchOnReconnect: false,
  });
}

export function useFeeStructure(id: string) {
  return useQuery<{ structure: FeeStructure }>({
    queryKey: ["feeStructure", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/fees/structures/${id}`);
      if (!res.ok) throw new Error("Failed to fetch fee structure");
      return res.json();
    },
    enabled: !!id,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}

export function useCreateFeeStructure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateFeeStructureInput) => {
      const res = await fetch("/api/admin/fees/structures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create fee structure");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feeStructures"] });
      invalidateSetupReadiness(queryClient);
    },
  });
}

export function useUpdateFeeStructure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateFeeStructureInput;
    }) => {
      const res = await fetch(`/api/admin/fees/structures/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update fee structure");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["feeStructures"] });
      queryClient.invalidateQueries({ queryKey: ["feeStructure", variables.id] });
      invalidateSetupReadiness(queryClient);
    },
  });
}

export function useDeleteFeeStructure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/fees/structures/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete fee structure");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feeStructures"] });
      invalidateSetupReadiness(queryClient);
    },
  });
}
