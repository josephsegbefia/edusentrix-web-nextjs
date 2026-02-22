import { useQuery } from "@tanstack/react-query";
import type { OverdueRiskSnapshot } from "@/lib/fees/overdue-risk";

type OverdueRiskResponse = {
  success: boolean;
  data: OverdueRiskSnapshot;
};

export function useOverdueRisk(params?: { limit?: number; topLimit?: number }) {
  const limit = params?.limit;
  const topLimit = params?.topLimit;

  return useQuery<OverdueRiskResponse>({
    queryKey: ["overdueRisk", limit ?? null, topLimit ?? null],
    queryFn: async () => {
      const search = new URLSearchParams();
      if (typeof limit === "number") search.set("limit", String(limit));
      if (typeof topLimit === "number") search.set("topLimit", String(topLimit));

      const query = search.toString();
      const res = await fetch(
        `/api/admin/fees/overdue-risk${query ? `?${query}` : ""}`,
        {
          cache: "no-store",
        }
      );

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error || "Failed to fetch overdue risk snapshot");
      }

      return (await res.json()) as OverdueRiskResponse;
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: 30_000,
  });
}
