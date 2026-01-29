import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithOfflineFallback } from "@/hooks/useOfflineQueue";

export type TeacherResourceCreateInput = {
  title: string;
  description?: string | null;
  url: string;
  type: "link" | "pdf" | "video" | "image" | "doc" | "slides" | "other";
  tags?: string[];
};

export function useTeacherResourceCreate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TeacherResourceCreateInput) => {
      try {
        const res = await fetchWithOfflineFallback("/api/teacher/studio/resources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          queueDescription: "Resource",
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "Failed to create resource");
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
