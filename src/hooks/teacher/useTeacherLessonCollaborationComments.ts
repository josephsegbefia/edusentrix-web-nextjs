import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LessonCollaborationCommentsResponse } from "@/types/lessons";

export function useTeacherLessonCollaborationComments(lessonId: string | null, enabled = true) {
  return useQuery<LessonCollaborationCommentsResponse>({
    queryKey: ["teacher-lesson-collaboration-comments", lessonId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/lessons/${lessonId}/collaboration/comments`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as LessonCollaborationCommentsResponse | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load collaboration comments");
      }
      return json;
    },
    enabled: Boolean(lessonId) && enabled,
    staleTime: 15_000,
  });
}

export function useTeacherLessonCollaborationCommentCreate(lessonId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (comment: string) => {
      if (!lessonId) throw new Error("Missing lesson ID");
      const res = await fetch(`/api/teacher/lessons/${lessonId}/collaboration/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to add comment");
      }
      return true;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["teacher-lesson-collaboration-comments", lessonId],
      });
    },
  });
}

export function useTeacherLessonCollaborationCommentStatusUpdate(lessonId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { commentId: string; status: "open" | "resolved" }) => {
      if (!lessonId) throw new Error("Missing lesson ID");
      const res = await fetch(
        `/api/teacher/lessons/${lessonId}/collaboration/comments/${payload.commentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: payload.status }),
        }
      );
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to update comment");
      }
      return true;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["teacher-lesson-collaboration-comments", lessonId],
      });
    },
  });
}
