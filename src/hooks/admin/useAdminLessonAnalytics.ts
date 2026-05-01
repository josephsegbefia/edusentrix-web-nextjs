import { useQuery } from "@tanstack/react-query";
import type { LessonAnalyticsResult } from "@/lib/lessons/admin-analytics.service";

type Response = { success: boolean; data: LessonAnalyticsResult; error?: string };

function toIsoParam(d: Date): string {
  return d.toISOString();
}

export function useAdminLessonAnalytics(from: Date | null, to: Date | null, enabled = true) {
  const ready = Boolean(from && to && from <= to);
  return useQuery<LessonAnalyticsResult>({
    queryKey: ["admin-lesson-analytics", from?.toISOString(), to?.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: toIsoParam(from!),
        to: toIsoParam(to!),
      });
      const res = await fetch(`/api/admin/lessons/analytics?${params}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as Response | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load analytics");
      }
      return json.data;
    },
    enabled: enabled && ready,
    staleTime: 60_000,
  });
}
