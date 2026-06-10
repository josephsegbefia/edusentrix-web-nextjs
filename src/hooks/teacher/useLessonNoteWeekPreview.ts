import { useQuery } from "@tanstack/react-query";
import type { LessonWeekPreviewResponse } from "@/types/lesson-preview";

export function useLessonNoteWeekPreview(
  noteId: string | null,
  classGroupId?: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: ["teacher", "lesson-note-week-preview", noteId, classGroupId ?? null],
    enabled: Boolean(noteId) && enabled,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (classGroupId) params.set("classGroupId", classGroupId);
      const qs = params.toString();
      const res = await fetch(
        `/api/teacher/lesson-notes/${noteId}/week-preview${qs ? `?${qs}` : ""}`,
      );
      const json = (await res.json().catch(() => null)) as LessonWeekPreviewResponse | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || "Failed to load week preview");
      }
      return json.data;
    },
  });
}
