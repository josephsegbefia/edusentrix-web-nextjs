import { useQuery } from "@tanstack/react-query";
import type { LessonNoteDeleteImpact } from "@/types/lesson-notes";

export function useLessonNoteDeleteImpact(noteId: string | null, enabled: boolean) {
  return useQuery<{ success: true; data: LessonNoteDeleteImpact }>({
    queryKey: ["teacher-lesson-note-delete-impact", noteId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/lesson-notes/${noteId}/delete-impact`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load delete details");
      }
      return json;
    },
    enabled: enabled && Boolean(noteId),
    staleTime: 0,
  });
}
