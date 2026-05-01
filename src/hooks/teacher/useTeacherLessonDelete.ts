import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useTeacherLessonDelete() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/teacher/lessons/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete lesson");
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-lessons"] });
    },
  });
}
