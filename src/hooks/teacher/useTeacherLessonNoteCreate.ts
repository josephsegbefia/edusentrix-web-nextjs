import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithOfflineFallback } from "@/hooks/useOfflineQueue";
import type { CreateLessonNotePayload } from "@/types/lesson-notes";

export type TeacherLessonNoteCreateInput = CreateLessonNotePayload;

export function useTeacherLessonNoteCreate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TeacherLessonNoteCreateInput) => {
      try {
        const res = await fetchWithOfflineFallback("/api/teacher/lesson-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          queueDescription: "Lesson note",
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          // Safely extract error message
          const errorMessage = 
            (data && typeof data.error === "string" ? data.error : null) || 
            "Failed to create lesson note";
          throw new Error(errorMessage);
        }
        return data;
      } catch (err: unknown) {
        if ((err as { isOfflineQueued?: boolean })?.isOfflineQueued) {
          return { queued: true } as { queued: true };
        }
        throw err;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-lesson-notes"] });
    },
  });
}
