import { useMutation, useQueryClient } from "@tanstack/react-query";

export type GradebookRecordInput = {
  classGroupId: string;
  subjectId: string;
  assessment: {
    assessmentType: "ca" | "quiz" | "assignment" | "midterm" | "exam" | "project" | "mock";
    title: string;
    maxScore: number;
    weight?: number | null;
  };
  records: Array<{ studentId: string; score: number | null }>;
};

export function useTeacherGradebookRecord() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: GradebookRecordInput) => {
      const { classGroupId, subjectId, assessment, records } = payload;
      const res = await fetch(`/api/teacher/gradebook/${classGroupId}/${subjectId}/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessment, records }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to record marks");
      }
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["teacher-gradebook", variables.classGroupId, variables.subjectId],
      });
    },
  });
}
