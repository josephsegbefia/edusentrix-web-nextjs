import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useTeacherJournalDelete() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/teacher/journal/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete journal entry");
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-journal-entries"] });
    },
  });
}
