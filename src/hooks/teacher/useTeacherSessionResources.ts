import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TeacherLessonResourcesResponse } from "@/types/lesson-resources";
import type { CreateLessonResourceBody } from "@/hooks/teacher/useTeacherLessonResources";

export function useTeacherSessionResources(sessionId: string | null, enabled = true) {
  return useQuery<TeacherLessonResourcesResponse>({
    queryKey: ["teacher-session-resources", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/resources`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as TeacherLessonResourcesResponse | null;
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load resources");
      }
      return json as TeacherLessonResourcesResponse;
    },
    enabled: Boolean(sessionId) && enabled,
    staleTime: 15_000,
  });
}

export function useTeacherCreateSessionResource(sessionId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateLessonResourceBody) => {
      const res = await fetch(`/api/teacher/lesson-sessions/${sessionId}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to add resource");
      return data as { success: boolean; data: { id: string } };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-session-resources", sessionId] });
    },
  });
}

export function useTeacherUpdateSessionResource(sessionId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      resourceId: string;
      title?: string;
      description?: string | null;
      url?: string;
      visibility?: "teacher_only" | "students" | "parents_only" | "students_and_parents";
    }) => {
      const res = await fetch(`/api/teacher/lesson-resources/${payload.resourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: payload.title,
          description: payload.description,
          url: payload.url,
          visibility: payload.visibility,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to update resource");
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-session-resources", sessionId] });
    },
  });
}

export function useTeacherDeleteSessionResource(sessionId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (resourceId: string) => {
      const res = await fetch(`/api/teacher/lesson-resources/${resourceId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to delete resource");
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-session-resources", sessionId] });
    },
  });
}
