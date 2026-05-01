import { useMutation, useQueryClient } from "@tanstack/react-query";

export type TeacherLessonCreateInput = {
  lessonNoteId: string;
  title?: string;
  scheduledAt?: string | null;
};

export function useTeacherLessonCreate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TeacherLessonCreateInput) => {
      const res = await fetch("/api/teacher/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          data && typeof data.error === "string" ? data.error : "Failed to create lesson";
        throw new Error(msg);
      }
      return data as { success: boolean; data: { id: string } };
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["teacher-lessons"] });
      if (result?.data?.id) {
        void qc.invalidateQueries({ queryKey: ["teacher-lesson-audit", result.data.id] });
      }
    },
  });
}
