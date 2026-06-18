import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TeacherLessonFlashcardsResponse } from "@/types/lesson-flashcards";

export function useTeacherSessionFlashcards(sessionId: string | null, enabled = true) {
  return useQuery<TeacherLessonFlashcardsResponse>({
    queryKey: ["teacher-session-flashcards", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/flashcards`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as TeacherLessonFlashcardsResponse | null;
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load flashcards");
      }
      return json as TeacherLessonFlashcardsResponse;
    },
    enabled: Boolean(sessionId) && enabled,
    staleTime: 15_000,
  });
}

export function useTeacherCreateSessionFlashcard(sessionId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { front: string; back: string }) => {
      const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/flashcards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to create card");
      return data as { success: boolean; data: { id: string } };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-session-flashcards", sessionId] });
    },
  });
}

export function useTeacherBulkCreateSessionFlashcards(sessionId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cards: Array<{ front: string; back: string }>) => {
      const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/flashcards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to create cards");
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-session-flashcards", sessionId] });
    },
  });
}

export function useTeacherUpdateSessionFlashcard(sessionId: string | null) {
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
      void qc.invalidateQueries({ queryKey: ["teacher-session-flashcards", sessionId] });
    },
  });
}

export function useTeacherDeleteSessionFlashcard(sessionId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cardId: string) => {
      const res = await fetch(`/api/teacher/flashcards/${cardId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to delete card");
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-session-flashcards", sessionId] });
    },
  });
}

export function useTeacherBulkDeleteSessionFlashcards(sessionId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cardIds: string[]) => {
      const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/flashcards`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to delete cards");
      return data as {
        success: boolean;
        data: { deleted: number; skipped: number };
      };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-session-flashcards", sessionId] });
    },
  });
}
