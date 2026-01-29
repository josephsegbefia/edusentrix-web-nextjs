import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithOfflineFallback } from "@/hooks/useOfflineQueue";

export type TeacherLessonNoteUpdateInput = {
  id: string;
  classGroupId?: string;
  subjectId?: string | null;
  weekOf?: string;
  topic?: string;
  objectives?: string | null;
  content?: string;
  status?: "draft" | "published";
  resources?: Array<{ title: string; url: string; type?: string | null }>;
  tags?: string[];
};

export function useTeacherLessonNoteUpdate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TeacherLessonNoteUpdateInput) => {
      try {
        const res = await fetchWithOfflineFallback(
          `/api/teacher/lesson-notes/${payload.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            queueDescription: "Lesson note update",
          }
        );
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "Failed to update lesson note");
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
