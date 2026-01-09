// src/hooks/admin/usePeriodStatus.ts
import { useQuery } from "@tanstack/react-query";
import type {
  PeriodStatus,
  WarningLevel,
  PeriodStatusResponse,
} from "@/app/api/admin/periods/status/route";

export type { PeriodStatus, WarningLevel };

export type PeriodStatusData = PeriodStatusResponse["data"];

export function usePeriodStatus() {
  return useQuery<PeriodStatusData>({
    queryKey: ["admin", "period-status"],
    queryFn: async () => {
      const res = await fetch("/api/admin/periods/status", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch period status");
      const json = (await res.json()) as PeriodStatusResponse;
      if (!json.success) throw new Error("Failed to fetch period status");
      return json.data;
    },
    staleTime: 60_000, // 1 minute
    refetchInterval: 5 * 60_000, // Refetch every 5 minutes
    refetchOnWindowFocus: true,
  });
}

// Helper hooks for specific checks
export function useCanCreateInvoices() {
  const { data } = usePeriodStatus();
  return data?.canCreateInvoices ?? false;
}

export function useCanRecordAssessments() {
  const { data } = usePeriodStatus();
  return data?.canRecordAssessments ?? false;
}

export function useCanCreateAssignments() {
  const { data } = usePeriodStatus();
  return data?.canCreateAssignments ?? false;
}

export function usePeriodWarningLevel() {
  const { data } = usePeriodStatus();
  return data?.warningLevel ?? "none";
}

export function useIsPeriodExpired() {
  const { data } = usePeriodStatus();
  return data?.status === "expired" || data?.status === "no_period";
}

export function useIsInGracePeriod() {
  const { data } = usePeriodStatus();
  return data?.status === "grace_period";
}

