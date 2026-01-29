import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useTeacherLessonNoteDelete() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/teacher/lesson-notes/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete lesson note");
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-lesson-notes"] });
    },
  });
}
