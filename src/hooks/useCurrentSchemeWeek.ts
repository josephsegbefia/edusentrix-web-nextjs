import { useQuery } from "@tanstack/react-query";
import type { SchoolSchemeWeekSnapshot } from "@/lib/schemes/resolve-scheme-week";
import { useAuth } from "@/providers/auth-provider";

export function useCurrentSchemeWeek() {
  const { me, loading: authLoading } = useAuth();

  return useQuery<{ success: boolean; data: SchoolSchemeWeekSnapshot }>({
    queryKey: ["current-scheme-week", me?.schoolId],
    queryFn: async () => {
      const res = await fetch("/api/school/current-scheme-week", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load current scheme week");
      }
      return json;
    },
    enabled: !authLoading && !!me?.schoolId,
    staleTime: 5 * 60_000,
  });
}
