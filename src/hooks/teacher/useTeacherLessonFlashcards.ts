import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TeacherLessonFlashcardsResponse } from "@/types/lesson-flashcards";

export function useTeacherLessonFlashcards(lessonId: string | null, enabled = true) {
  return useQuery<TeacherLessonFlashcardsResponse>({
    queryKey: ["teacher-lesson-flashcards", lessonId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/lessons/${lessonId}/flashcards`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as TeacherLessonFlashcardsResponse | null;
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load flashcards");
      }
      return json as TeacherLessonFlashcardsResponse;
    },
    enabled: Boolean(lessonId) && enabled,
    staleTime: 15_000,
  });
}

export function useTeacherCreateFlashcard(lessonId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { front: string; back: string }) => {
      const res = await fetch(`/api/teacher/lessons/${lessonId}/flashcards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to create card");
      return data as { success: boolean; data: { id: string } };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-flashcards", lessonId] });
    },
  });
}

export function useTeacherUpdateFlashcard(lessonId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { cardId: string; front?: string; back?: string }) => {
      const res = await fetch(`/api/teacher/flashcards/${payload.cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front: payload.front, back: payload.back }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to update card");
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-flashcards", lessonId] });
    },
  });
}

export function useTeacherDeleteFlashcard(lessonId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cardId: string) => {
      const res = await fetch(`/api/teacher/flashcards/${cardId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to delete card");
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-flashcards", lessonId] });
    },
  });
}
