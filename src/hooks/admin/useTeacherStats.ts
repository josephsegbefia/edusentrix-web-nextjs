import { useQuery } from "@tanstack/react-query";
import type { TeacherQuickStatsResponse } from "@/types/admin/teacher";

export function useTeacherStats() {
  return useQuery<TeacherQuickStatsResponse>({
    queryKey: ["teachers", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/teachers/stats", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch teacher stats");
      return res.json();
    },
    staleTime: 60_000,
  });
}
