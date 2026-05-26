import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LessonNoteDeleteImpact } from "@/types/lesson-notes";

export function useAdminLessonNoteDeleteImpact(noteId: string | null, enabled: boolean) {
  return useQuery<{ success: true; data: LessonNoteDeleteImpact }>({
    queryKey: ["admin-lesson-note-delete-impact", noteId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/lesson-notes/${noteId}/delete-impact`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load delete details");
      }
      return json;
    },
    enabled: enabled && Boolean(noteId),
    staleTime: 0,
  });
}

export function useAdminLessonNoteDelete() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/lesson-notes/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete lesson note");
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-lesson-notes"] });
      qc.invalidateQueries({ queryKey: ["admin-lesson-note"] });
      qc.invalidateQueries({ queryKey: ["teacher-lesson-notes"] });
    },
  });
}
