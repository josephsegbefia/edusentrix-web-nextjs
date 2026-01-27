// src/hooks/admin/useStudentStats.ts
import { useQuery } from "@tanstack/react-query";
import { StudentQuickStats } from "@/types/admin/student";

export function useStudentStats() {
  return useQuery<StudentQuickStats>({
    queryKey: ["students", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/students/stats", {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch student stats");
      }
      const json = (await res.json()) as StudentQuickStats;
      return json;
    },
    staleTime: 60_000,
  });
}
