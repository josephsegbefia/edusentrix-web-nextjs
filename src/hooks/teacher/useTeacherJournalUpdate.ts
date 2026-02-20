import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithOfflineFallback } from "@/hooks/useOfflineQueue";

export type TeacherJournalUpdateInput = {
  id: string;
  subjectId?: string | null;
  date?: string;
  title?: string | null;
  content?: string;
  status?: "draft" | "published";
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size?: number | null;
  }>;
};

export function useTeacherJournalUpdate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TeacherJournalUpdateInput) => {
      const { id, ...body } = payload;
      try {
        const res = await fetchWithOfflineFallback(`/api/teacher/journal/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          queueDescription: "Class journal update",
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "Failed to update journal entry");
        }
        return data;
      } catch (err: unknown) {
        if ((err as { isOfflineQueued?: boolean })?.isOfflineQueued) {
          return { queued: true } as { queued: true };
        }
        throw err;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-journal-entries"] });
    },
  });
}
