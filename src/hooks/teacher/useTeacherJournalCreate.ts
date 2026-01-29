import { useMutation, useQueryClient } from "@tanstack/react-query";

export type TeacherJournalCreateInput = {
  classGroupId: string;
  subjectId?: string | null;
  date: string;
  title?: string | null;
  content: string;
  status: "draft" | "published";
};

export function useTeacherJournalCreate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TeacherJournalCreateInput) => {
      const res = await fetch("/api/teacher/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to create journal entry");
      }
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["teacher-journal-entries"],
      });
      qc.invalidateQueries({
        queryKey: ["teacher-journal-entries", { classGroupId: variables.classGroupId }],
      });
    },
  });
}
