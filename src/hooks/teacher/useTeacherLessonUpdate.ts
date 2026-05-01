import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { LessonDeliveryStatus, LessonTeachingModeDto } from "@/types/lessons";

export type TeacherLessonUpdateInput = {
  id: string;
  title?: string;
  scheduledAt?: string | null;
  status?: LessonDeliveryStatus;
  teachingMode?: LessonTeachingModeDto;
  /** Caregiver-facing HTML; omit to leave unchanged. Pass null to clear. */
  parentSummaryHtml?: string | null;
  /** Owner-only; validated against school scheme settings and class/subject. */
  schemeId?: string | null;
  schemeItemIds?: string[] | null;
};

export function useTeacherLessonUpdate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TeacherLessonUpdateInput) => {
      const { id, ...body } = payload;
      const res = await fetch(`/api/teacher/lessons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          data && typeof data.error === "string" ? data.error : "Failed to update lesson";
        throw new Error(msg);
      }
      return data;
    },
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ["teacher-lessons"] });
      void qc.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === "teacher-lesson" &&
          q.queryKey[1] === variables.id,
      });
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-audit", variables.id] });
    },
  });
}
