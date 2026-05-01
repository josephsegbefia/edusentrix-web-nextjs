import { useQuery } from "@tanstack/react-query";
import type { AdminLessonAuditRow } from "@/types/lesson-audit";

type ApiResponse = {
  success: boolean;
  data: {
    entries: AdminLessonAuditRow[];
    hasMore: boolean;
    page: number;
    limit: number;
  };
  error?: string;
};

export function useAdminLessonAuditLog(
  page: number,
  lessonIdFilter: string,
  limit = 50,
  enabled = true
) {
  const trimmed = lessonIdFilter.trim();
  return useQuery({
    queryKey: ["admin-lesson-audit-log", page, trimmed, limit],
    queryFn: async () => {
      const p = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (trimmed) p.set("lessonId", trimmed);
      const res = await fetch(`/api/admin/lessons/audit-log?${p}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load audit log");
      }
      return json.data;
    },
    enabled,
    staleTime: 30_000,
  });
}
