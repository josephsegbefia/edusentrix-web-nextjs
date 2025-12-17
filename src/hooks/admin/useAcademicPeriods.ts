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
      const res = await fetch("/api/periods/get-current", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch academic periods");
      return res.json();
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: 30_000,
  });
}
