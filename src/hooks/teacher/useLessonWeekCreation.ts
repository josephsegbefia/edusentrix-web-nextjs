import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateWeekPlanSessionInput,
  LessonWeekPlansListResponse,
  WeekCreationContextResponse,
} from "@/types/lessons-v2";

export type WeekPlanCreateConflictDetails = {
  code: "TIMETABLE_SLOT_CONFLICT" | "DUPLICATE_SELECTED_SLOT";
  message: string;
  conflictingSlotIds: string[];
  scheduledDate?: string;
  startTime?: string;
  endTime?: string;
  existingLessonTitle?: string;
};

export class LessonWeekPlanCreateError extends Error {
  details?: WeekPlanCreateConflictDetails | null;

  constructor(message: string, details?: WeekPlanCreateConflictDetails | null) {
    super(message);
    this.name = "LessonWeekPlanCreateError";
    this.details = details;
  }
}

export function useWeekCreationContext(
  noteId: string | null,
  classGroupId: string | null,
  enabled = true,
) {
  return useQuery<WeekCreationContextResponse>({
    queryKey: ["week-creation-context", noteId, classGroupId],
    queryFn: async () => {
      if (!noteId || !classGroupId) throw new Error("Note and class are required");
      const params = new URLSearchParams({ classGroupId });
      const res = await fetch(
        `/api/teacher/lesson-notes/${noteId}/week-creation-context?${params}`,
        { cache: "no-store" },
      );
      const json = (await res.json().catch(() => null)) as WeekCreationContextResponse | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load week context");
      }
      return json;
    },
    enabled: enabled && Boolean(noteId && classGroupId),
    staleTime: 10_000,
  });
}

export function useCreateLessonWeekPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      lessonNoteId: string;
      classGroupId: string;
      weekStartDate: string;
      weekEndDate: string;
      weekLabel?: string;
      title?: string;
      sessions?: CreateWeekPlanSessionInput[];
    }) => {
      const res = await fetch("/api/teacher/lesson-week-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new LessonWeekPlanCreateError(
          json?.error || "Failed to create week plan",
          json?.details ?? null,
        );
      }
      return json as { success: true; data: { weekPlan: LessonWeekPlansListResponse["data"]["weekGroups"][0]["plans"][0] } };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-week-plans"] });
    },
  });
}

export function useCloneLessonWeekPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      sourceWeekPlanId: string;
      targetClassGroupId: string;
      weekStartDate?: string;
      weekEndDate?: string;
    }) => {
      const res = await fetch(
        `/api/teacher/lesson-week-plans/${input.sourceWeekPlanId}/clone`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetClassGroupId: input.targetClassGroupId,
            weekStartDate: input.weekStartDate,
            weekEndDate: input.weekEndDate,
          }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to clone week plan");
      }
      return json;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-week-plans"] });
    },
  });
}
