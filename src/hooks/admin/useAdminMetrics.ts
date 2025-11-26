import { useQuery, useQueryClient } from "@tanstack/react-query";
export type Trend = { deltaPct: number; direction: "up" | "down" | "flat" };

export type MetricsDTO = {
  students: { total: number; trend: Trend };
  teachers: { total: number; trend: Trend };
  subjects: { total: number; trend: Trend };
  revenue: { current: number; trend: Trend };
  period: {
    yearLabel: string;
    term: string;
    startDate: Date;
    endDate: Date;
  } | null;
  collections: { collected: number; outstanding: number; rate: number };
};
export function useAdminMetrics() {
  return useQuery<MetricsDTO>({
    queryKey: ["admin", "metrics"],
    queryFn: async () => {
      const res = await fetch("/api/admin/metrics", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch metrics");
      return (await res.json()) as MetricsDTO;
    },
    staleTime: 60_000,
  });
}
