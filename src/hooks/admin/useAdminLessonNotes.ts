import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdminLessonNoteFilters,
  AdminLessonNotesResponse,
  LessonNoteDetailResponse,
  LessonNoteReviewCommentResponse,
  LessonNoteReviewCommentStatus,
  LessonNoteReviewCommentType,
} from "@/types/lesson-notes";

export function useAdminLessonNotes(
  filters: AdminLessonNoteFilters = {},
  enabled = true
) {
  return useQuery<AdminLessonNotesResponse>({
    queryKey: ["admin-lesson-notes", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.classGroupId) params.set("classGroupId", filters.classGroupId);
      if (filters.subjectId) params.set("subjectId", filters.subjectId);
      if (filters.teacherId) params.set("teacherId", filters.teacherId);
      if (filters.templateType) params.set("templateType", filters.templateType);
      if (filters.weekOf) params.set("weekOf", filters.weekOf);
      if (filters.status) params.set("status", filters.status);
      if (filters.search) params.set("search", filters.search);
      if (filters.limit) params.set("limit", String(filters.limit));

      const res = await fetch(`/api/admin/lesson-notes?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to fetch lesson notes");
      }
      return json as AdminLessonNotesResponse;
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useAdminLessonNote(noteId: string | null, enabled = true) {
  return useQuery<LessonNoteDetailResponse>({
    queryKey: ["admin-lesson-note", noteId],
    queryFn: async () => {
      if (!noteId) {
        throw new Error("Lesson note ID is required");
      }

      const res = await fetch(`/api/admin/lesson-notes/${noteId}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to fetch lesson note");
      }
      return json as LessonNoteDetailResponse;
    },
    enabled: enabled && !!noteId,
    staleTime: 15_000,
  });
}

export function useCreateAdminLessonNoteComment() {
  const queryClient = useQueryClient();

  return useMutation<
    LessonNoteReviewCommentResponse,
    Error,
    {
      noteId: string;
      sectionKey: string;
      sectionLabel: string;
      commentType: LessonNoteReviewCommentType;
      comment: string;
    }
  >({
    mutationFn: async ({ noteId, ...body }) => {
      const res = await fetch(`/api/admin/lesson-notes/${noteId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to create comment");
      }
      return json as LessonNoteReviewCommentResponse;
    },
    onSuccess: (_, { noteId }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-lesson-note", noteId] });
      queryClient.invalidateQueries({ queryKey: ["admin-lesson-notes"] });
    },
  });
}

export function useUpdateAdminLessonNoteComment() {
  const queryClient = useQueryClient();

  return useMutation<
    LessonNoteReviewCommentResponse,
    Error,
    {
      noteId: string;
      commentId: string;
      status?: LessonNoteReviewCommentStatus;
      commentType?: LessonNoteReviewCommentType;
      comment?: string;
    }
  >({
    mutationFn: async ({ noteId, commentId, ...body }) => {
      const res = await fetch(
        `/api/admin/lesson-notes/${noteId}/comments/${commentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to update comment");
      }
      return json as LessonNoteReviewCommentResponse;
    },
    onSuccess: (_, { noteId }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-lesson-note", noteId] });
      queryClient.invalidateQueries({ queryKey: ["admin-lesson-notes"] });
    },
  });
}
