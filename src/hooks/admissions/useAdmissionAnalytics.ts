// src/hooks/admissions/useAdmissionAnalytics.ts
// Fetches the analytics snapshot for a single cycle.

import { useQuery } from "@tanstack/react-query";
import type { CycleAnalyticsSnapshot } from "@/lib/admissions/analytics";

async function jsonOrThrow(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    let message = res.statusText;
    try {
      const parsed = JSON.parse(text);
      message = parsed?.error || parsed?.message || message;
    } catch {
      message = text || message;
    }
    throw new Error(message || "Request failed");
  }
  return res.json();
}

export type AdmissionAnalyticsDTO = CycleAnalyticsSnapshot;

export function useAdmissionAnalytics(cycleId: string | null | undefined) {
  return useQuery<{ data: AdmissionAnalyticsDTO }>({
    queryKey: ["admissions", "analytics", cycleId ?? ""],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/admissions/cycles/${cycleId}/analytics`,
        { cache: "no-store" }
      );
      return jsonOrThrow(res);
    },
    enabled: Boolean(cycleId),
    staleTime: 30_000,
  });
}
