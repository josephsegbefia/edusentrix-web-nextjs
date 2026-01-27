import { useQuery } from "@tanstack/react-query";

export type AcademicPeriodDTO = {
  _id: string;
  yearLabel: string;
  term: string; // e.g. "Term 1"
  isCurrent?: boolean;
  startDate?: string;
  endDate?: string;
};

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
