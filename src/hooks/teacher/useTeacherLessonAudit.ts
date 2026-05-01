import { useQuery } from "@tanstack/react-query";
import type { AdminLessonAuditRow } from "@/types/lesson-audit";

type Response = {
  success: boolean;
  data: { entries: AdminLessonAuditRow[] };
  error?: string;
};

export function useTeacherLessonAudit(lessonId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["teacher-lesson-audit", lessonId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/lessons/${lessonId}/audit?limit=30`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as Response | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load audit log");
      }
      return json.data.entries;
    },
    enabled: Boolean(lessonId) && enabled,
    staleTime: 20_000,
  });
}
