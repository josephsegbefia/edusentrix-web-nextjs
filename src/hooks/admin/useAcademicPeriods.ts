import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateSetupReadiness } from "@/lib/query/invalidate-setup-readiness";
import type { AcademicPeriodOverviewData } from "@/hooks/admin/useAcademicPeriodOverview";
import type { PeriodStatusData } from "@/hooks/admin/usePeriodStatus";

export type AcademicPeriodDTO = {
  _id: string;
  yearLabel: string;
  term: string; // e.g. "Term 1"
  isCurrent?: boolean;
  isYearEndTerminal?: boolean;
  startDate?: string;
  endDate?: string;
};

function invalidateAcademicPeriodQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["academicPeriods"] });
  void queryClient.invalidateQueries({ queryKey: ["admin", "period-overview"] });
  void queryClient.invalidateQueries({ queryKey: ["admin", "period-status"] });
  void queryClient.invalidateQueries({ queryKey: ["periodSummary"] });
  invalidateSetupReadiness(queryClient);
}

export function useAcademicPeriods() {
  return useQuery<{ periods: AcademicPeriodDTO[] }>({
    queryKey: ["academicPeriods"],
    queryFn: async () => {
      const res = await fetch("/api/admin/periods", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch academic periods");
      const json = await res.json();
      // Normalize response - ensure it always has a periods array
      if (Array.isArray(json.periods)) {
        return { periods: json.periods };
      }
      return { periods: [] };
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: 30_000,
  });
}

export type CreatePeriodInput = {
  yearLabel: string;
  term: string;
  startDate: string;
  endDate: string;
  isYearEndTerminal?: boolean;
};

export type CreatedAcademicPeriod = {
  id: string;
  yearLabel: string;
  term: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isYearEndTerminal?: boolean;
};

type CreatePeriodResponse = {
  success: true;
  period: CreatedAcademicPeriod;
};

export function applyCreatedAcademicPeriodToCaches(
  queryClient: QueryClient,
  createdPeriod: CreatedAcademicPeriod
) {
  queryClient.setQueryData<{ periods: AcademicPeriodDTO[] }>(
    ["academicPeriods"],
    (current) => {
      const nextPeriod: AcademicPeriodDTO = {
        _id: createdPeriod.id,
        yearLabel: createdPeriod.yearLabel,
        term: createdPeriod.term,
        startDate: createdPeriod.startDate,
        endDate: createdPeriod.endDate,
        isCurrent: createdPeriod.isCurrent,
        isYearEndTerminal: createdPeriod.isYearEndTerminal ?? false,
      };

      const existingPeriods = Array.isArray(current?.periods) ? current.periods : [];
      const withoutCreated = existingPeriods.filter((period) => period._id !== nextPeriod._id);
      const normalized = withoutCreated.map((period) => ({
        ...period,
        isCurrent: false,
      }));

      return {
        periods: [nextPeriod, ...normalized],
      };
    }
  );

  queryClient.setQueryData<AcademicPeriodOverviewData>(
    ["admin", "period-overview"],
    (current) => {
      if (!current) return current;

      const nextCurrent = {
        id: createdPeriod.id,
        yearLabel: createdPeriod.yearLabel,
        term: createdPeriod.term,
        startDate: createdPeriod.startDate,
        endDate: createdPeriod.endDate,
        isCurrent: createdPeriod.isCurrent,
      };

      const shouldPromotePrevious =
        current.currentPeriod && current.currentPeriod.id !== createdPeriod.id
          ? current.currentPeriod
          : current.previousPeriod;

      return {
        ...current,
        currentPeriod: nextCurrent,
        previousPeriod: shouldPromotePrevious ?? null,
      };
    }
  );

  queryClient.setQueryData<PeriodStatusData>(["admin", "period-status"], (current) => {
    if (!current) return current;

    const endDate = new Date(createdPeriod.endDate);
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const warningLevel =
      daysUntilExpiry <= 3
        ? "critical"
        : daysUntilExpiry <= 7
          ? "urgent"
          : daysUntilExpiry <= 14
            ? "warning"
            : "none";
    const status =
      daysUntilExpiry <= 3
        ? "expiring_critical"
        : daysUntilExpiry <= 7
          ? "expiring_very_soon"
          : daysUntilExpiry <= 14
            ? "expiring_soon"
            : "active";

    return {
      ...current,
      status,
      warningLevel,
      currentPeriod: {
        id: createdPeriod.id,
        yearLabel: createdPeriod.yearLabel,
        term: createdPeriod.term,
        startDate: createdPeriod.startDate,
        endDate: createdPeriod.endDate,
        isCurrent: createdPeriod.isCurrent,
        isYearEndTerminal: createdPeriod.isYearEndTerminal ?? false,
      },
      daysUntilExpiry,
      daysSinceExpiry: null,
      message:
        status === "active"
          ? "Your academic period is active."
          : `Your academic period (${createdPeriod.term} ${createdPeriod.yearLabel}) ends in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}.`,
      actionRequired: warningLevel !== "none",
      canCreateInvoices: true,
      canRecordAssessments: status === "active" || status === "expiring_soon" || status === "expiring_very_soon",
      canCreateAssignments: true,
    };
  });
}

export function useCreatePeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePeriodInput) => {
      const res = await fetch("/api/admin/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearLabel: input.yearLabel,
          term: input.term,
          startDate: input.startDate,
          endDate: input.endDate,
          isYearEndTerminal: input.isYearEndTerminal ?? false,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to create period");
      }
      return json as CreatePeriodResponse;
    },
    onSuccess: (result) => {
      applyCreatedAcademicPeriodToCaches(queryClient, result.period);
      void invalidateAcademicPeriodQueries(queryClient);
    },
  });
}

export function useSetCurrentPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (periodId: string) => {
      const res = await fetch(`/api/admin/periods/${periodId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCurrent: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to set current period");
      }
      return json;
    },
    onSuccess: () => {
      invalidateAcademicPeriodQueries(queryClient);
    },
  });
}
