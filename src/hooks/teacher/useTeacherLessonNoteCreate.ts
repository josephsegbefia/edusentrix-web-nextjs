import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithOfflineFallback } from "@/hooks/useOfflineQueue";

export type TeacherLessonNoteCreateInput = {
  classGroupId: string;
  subjectId?: string | null;
  weekOf: string;
  topic: string;
  objectives?: string | null;
  content: string;
  status: "draft" | "published";
  resources?: Array<{ title: string; url: string; type?: string | null }>;
  tags?: string[];
};

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
          throw new Error(data?.error || "Failed to create lesson note");
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
