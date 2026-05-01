import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TeacherLessonResourcesResponse } from "@/types/lesson-resources";

export type CreateLessonResourceBody =
  | {
      kind: "link";
      title: string;
      url: string;
      description?: string | null;
      linkType?: "pdf" | "video" | "link" | "image" | "document" | "audio" | "slide" | "worksheet" | "other";
      visibility?: "teacher_only" | "students" | "students_and_parents";
    }
  | {
      kind: "library_book";
      libraryBookId: string;
      title?: string;
      description?: string | null;
      visibility?: "teacher_only" | "students" | "students_and_parents";
    };

export function useTeacherLessonResources(lessonId: string | null, enabled = true) {
  return useQuery<TeacherLessonResourcesResponse>({
    queryKey: ["teacher-lesson-resources", lessonId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/lessons/${lessonId}/resources`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as TeacherLessonResourcesResponse | null;
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load resources");
      }
      return json as TeacherLessonResourcesResponse;
    },
    enabled: Boolean(lessonId) && enabled,
    staleTime: 15_000,
  });
}

export function useTeacherCreateLessonResource(lessonId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateLessonResourceBody) => {
      const res = await fetch(`/api/teacher/lessons/${lessonId}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to add resource");
      return data as { success: boolean; data: { id: string } };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-resources", lessonId] });
      if (lessonId) void qc.invalidateQueries({ queryKey: ["teacher-lesson-audit", lessonId] });
    },
  });
}

export function useTeacherUpdateLessonResource(lessonId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      resourceId: string;
      title?: string;
      description?: string | null;
      url?: string;
      visibility?: "teacher_only" | "students" | "students_and_parents";
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
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-resources", lessonId] });
    },
  });
}

export function useTeacherDeleteLessonResource(lessonId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (resourceId: string) => {
      const res = await fetch(`/api/teacher/lesson-resources/${resourceId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to delete resource");
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-lesson-resources", lessonId] });
      if (lessonId) void qc.invalidateQueries({ queryKey: ["teacher-lesson-audit", lessonId] });
    },
  });
}
