import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LessonSessionDetailDto } from "@/types/lessons-v2";
import type { LessonContentBlock } from "@/types/lesson-content-blocks";
import type { LessonDeliveryStatus } from "@/types/lessons-v2";
import type { LessonAssessmentItem } from "@/hooks/teacher/useLessonsLeo";

type SessionResponse = {
  success: boolean;
  data: {
    session: LessonSessionDetailDto;
    lessonsSettings?: {
      enableLeoLessonTools: boolean;
      requireTeacherReviewForAiContent: boolean;
      enableTeachingMode: boolean;
      enableFlashcards?: boolean;
      enableResources?: boolean;
      enableLessonReflection?: boolean;
      parentSummaryVisibleToParents?: boolean;
    };
    access?: {
      canManageContent: boolean;
      isSubstitute: boolean;
    };
    linkedAssignmentsSummary?: import("@/types/lessons-v2").SessionLinkedAssignmentsSummary | null;
  };
  error?: string;
};

export function useTeacherLessonSession(
  sessionId: string | null,
  classGroupId?: string | null,
) {
  return useQuery<SessionResponse>({
    queryKey: ["teacher-lesson-session", sessionId, classGroupId ?? null],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (classGroupId) params.set("classGroupId", classGroupId);
      const qs = params.toString();
      const res = await fetch(
        `/api/teacher/lesson-sessions/${sessionId}${qs ? `?${qs}` : ""}`,
        { cache: "no-store" },
      );
      const json = (await res.json().catch(() => null)) as SessionResponse | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load session");
      }
      return json;
    },
    enabled: Boolean(sessionId),
    staleTime: 10_000,
  });
}

type SessionPatch = {
  title?: string;
  planNotes?: string | null;
  studentVisibility?: "hidden" | "published";
  parentVisibility?: boolean;
  adminVisibility?: boolean;
  contentBlocks?: LessonContentBlock[];
  markAllAiReviewed?: boolean;
  assessmentItems?: LessonAssessmentItem[];
  learnTeacherPriority?: boolean;
};

export function useUpdateTeacherLessonSession(
  sessionId: string | null,
  classGroupId?: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: SessionPatch) => {
      const params = new URLSearchParams();
      if (classGroupId) params.set("classGroupId", classGroupId);
      const qs = params.toString();
      const res = await fetch(
        `/api/teacher/lesson-sessions/${sessionId}${qs ? `?${qs}` : ""}`,
        {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
      const json = (await res.json().catch(() => null)) as SessionResponse | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to update session");
      }
      return json;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-session", sessionId] });
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-week-plans"] });
    },
  });
}

/** Alias for useUpdateTeacherLessonSession — accepts non-null sessionId. */
export function useUpdateLessonSession(sessionId: string, classGroupId?: string | null) {
  return useUpdateTeacherLessonSession(sessionId, classGroupId);
}

export function useUpdateLessonDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      deliveryId: string;
      status?: LessonDeliveryStatus;
    }) => {
      const res = await fetch(`/api/teacher/lesson-deliveries/${input.deliveryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: input.status }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to update delivery");
      }
      return json;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-session"] });
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-week-plans"] });
    },
  });
}
