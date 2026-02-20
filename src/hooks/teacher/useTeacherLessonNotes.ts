import { useQuery } from "@tanstack/react-query";
import type {
  LessonNote,
  LessonNoteFilters,
  LessonNotesResponse,
} from "@/types/lesson-notes";

// Re-export types for backwards compatibility
export type TeacherLessonNoteResource = LessonNote["resources"][number];
export type TeacherLessonNote = LessonNote;
export type TeacherLessonNotesResponse = LessonNotesResponse;
export type TeacherLessonNotesFilters = LessonNoteFilters;

export function useTeacherLessonNotes(
  filters: TeacherLessonNotesFilters = {},
  enabled = true
) {
  return useQuery<TeacherLessonNotesResponse>({
    queryKey: ["teacher-lesson-notes", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.classGroupId) params.set("classGroupId", filters.classGroupId);
      if (filters.subjectId) params.set("subjectId", filters.subjectId);
      if (filters.academicPeriodId)
        params.set("academicPeriodId", filters.academicPeriodId);
      if (filters.templateType) params.set("templateType", filters.templateType);
      if (filters.weekOf) params.set("weekOf", filters.weekOf);
      if (filters.status) params.set("status", filters.status);
      if (filters.search) params.set("search", filters.search);
      if (filters.limit) params.set("limit", String(filters.limit));
      if (filters.offset) params.set("offset", String(filters.offset));

      const res = await fetch(`/api/teacher/lesson-notes?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch lesson notes");
      return res.json();
    },
    enabled,
    staleTime: 60_000,
  });
}
