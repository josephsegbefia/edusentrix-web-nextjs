import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  FlashcardProgressUpdatePayload,
  StudentLessonFlashcardsResponse,
} from "@/types/lesson-flashcards";

export function useStudentSessionFlashcards(sessionId: string | null, enabled = true) {
  return useQuery<StudentLessonFlashcardsResponse>({
    queryKey: ["student-session-flashcards", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/student/lesson-sessions/${sessionId}/flashcards`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as StudentLessonFlashcardsResponse | null;
      if (!res.ok) {
        throw new Error(
          (json as { error?: string } | null)?.error || "Failed to load flashcards"
        );
      }
      return json as StudentLessonFlashcardsResponse;
    },
    enabled: Boolean(sessionId) && enabled,
    staleTime: 30_000,
  });
}

export function useStudentSessionFlashcardProgress(sessionId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { cardId: string; body: FlashcardProgressUpdatePayload }) => {
      const res = await fetch(`/api/student/flashcards/${payload.cardId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.body),
      });
      const data = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Failed to save");
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["student-session-flashcards", sessionId] });
    },
  });
}
