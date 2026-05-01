import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useStudentLessonComplete(lessonId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!lessonId) throw new Error("Missing lesson");
      const res = await fetch(`/api/student/lessons/${lessonId}/complete`, {
        method: "POST",
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        data?: { completedAt: string; completionStatus: "completed" };
      };
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || "Could not save");
      }
      return json.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["student-lessons"] });
      if (lessonId) {
        void qc.invalidateQueries({ queryKey: ["student-lesson", lessonId] });
      }
    },
  });
}
