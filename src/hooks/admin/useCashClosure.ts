import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useCashClosure(date?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["fees-cash-closure", date || "today"],
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (date) params.set("date", date);
      const res = await fetch(`/api/admin/fees/cash-closure?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to fetch cash closure");
      return payload as {
        closureDate: string;
        expectedCashMinor: number;
        paymentCount: number;
        closure: {
          _id: string;
          closureDate: string;
          expectedCashMinor: number;
          recordedCashMinor: number;
          varianceMinor: number;
          varianceResolved: boolean;
          varianceResolutionNote?: string | null;
          closedBy?: string | null;
          status: "closed";
          createdAt: string;
          updatedAt: string;
        } | null;
        recentClosures: Array<{
          _id: string;
          closureDate: string;
          expectedCashMinor: number;
          recordedCashMinor: number;
          varianceMinor: number;
          varianceResolved: boolean;
          varianceResolutionNote?: string | null;
          closedBy?: string | null;
          status: "closed";
          createdAt: string;
          updatedAt: string;
        }>;
      };
    },
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useCloseCashDay() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      closureDate?: string;
      recordedCashMinor: number;
      varianceResolutionNote?: string;
    }) => {
      const res = await fetch("/api/admin/fees/cash-closure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to close cash day");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fees-cash-closure"] });
      qc.invalidateQueries({ queryKey: ["admin", "metrics"] });
      qc.invalidateQueries({ queryKey: ["pending-payments"] });
    },
  });
}
