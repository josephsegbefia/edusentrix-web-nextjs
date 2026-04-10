import { useQuery } from "@tanstack/react-query";
import type { LessonNoteDetailResponse } from "@/types/lesson-notes";

export function useTeacherLessonNote(noteId: string | null, enabled = true) {
  return useQuery<LessonNoteDetailResponse>({
    queryKey: ["teacher-lesson-note", noteId],
    queryFn: async () => {
      if (!noteId) {
        throw new Error("Lesson note ID is required");
      }

      const res = await fetch(`/api/teacher/lesson-notes/${noteId}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to fetch lesson note");
      }
      return json as LessonNoteDetailResponse;
    },
    enabled: enabled && !!noteId,
    staleTime: 15_000,
  });
}
