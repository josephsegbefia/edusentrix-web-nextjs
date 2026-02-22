import { useQuery } from "@tanstack/react-query";

export type PeriodOverviewPeriod = {
  id: string;
  yearLabel: string;
  term: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};

export type PeriodOverviewOccurrence = {
  id: string;
  eventId: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  eventType: string;
  color: string | null;
  isRecurring: boolean;
  status: string;
};

export type AcademicPeriodOverviewData = {
  currentPeriod: PeriodOverviewPeriod | null;
  previousPeriod: PeriodOverviewPeriod | null;
  upcoming: {
    rangeStart: string;
    rangeEnd: string;
    days: number;
    totalCount: number;
    next7DaysCount: number;
    byType: Array<{ eventType: string; count: number }>;
    preview: PeriodOverviewOccurrence[];
  };
  meta: {
    calendarsCount: number;
    eventsConfigured: number;
  };
};

type PeriodOverviewResponse =
  | { success: true; data: AcademicPeriodOverviewData }
  | { success: false; error?: string };

export function useAcademicPeriodOverview() {
  return useQuery<AcademicPeriodOverviewData>({
    queryKey: ["admin", "period-overview"],
    queryFn: async () => {
      const res = await fetch("/api/admin/periods/overview", {
        cache: "no-store",
      });

      const json = (await res.json()) as PeriodOverviewResponse;
      if (!res.ok || !json.success) {
        const message =
          "error" in json && json.error
            ? json.error
            : "Failed to fetch period overview";
        throw new Error(message);
      }
      return json.data;
    },
    staleTime: 60_000,
  });
}
