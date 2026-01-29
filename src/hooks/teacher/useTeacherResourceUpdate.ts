import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithOfflineFallback } from "@/hooks/useOfflineQueue";

export type TeacherResourceUpdateInput = {
  id: string;
  title?: string;
  description?: string | null;
  url?: string;
  type?: "link" | "pdf" | "video" | "image" | "doc" | "slides" | "other";
  tags?: string[];
};

export function useTeacherResourceUpdate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TeacherResourceUpdateInput) => {
      try {
        const res = await fetchWithOfflineFallback(
          `/api/teacher/studio/resources/${payload.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            queueDescription: "Resource update",
          }
        );
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "Failed to update resource");
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
      qc.invalidateQueries({ queryKey: ["teacher-resources"] });
    },
  });
}
