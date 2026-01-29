import { useQuery } from "@tanstack/react-query";

export type TeacherLessonNoteResource = {
  title: string;
  url: string;
  type?: string | null;
};

export type TeacherLessonNote = {
  id: string;
  classGroupId: string;
  className: string;
  subjectId: string | null;
  subjectName: string | null;
  academicPeriodId: string | null;
  weekOf: string | null;
  topic: string;
  objectives: string | null;
  content: string;
  status: "draft" | "published";
  resources: TeacherLessonNoteResource[];
  tags: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type TeacherLessonNotesResponse = {
  success: boolean;
  data: {
    entries: TeacherLessonNote[];
  };
};

export type TeacherLessonNotesFilters = {
  classGroupId?: string;
  subjectId?: string;
  academicPeriodId?: string;
  weekOf?: string;
  status?: string;
  search?: string;
  limit?: number;
};

export function useTeacherLessonNotes(filters: TeacherLessonNotesFilters = {}, enabled = true) {
  return useQuery<TeacherLessonNotesResponse>({
    queryKey: ["teacher-lesson-notes", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.classGroupId) params.set("classGroupId", filters.classGroupId);
      if (filters.subjectId) params.set("subjectId", filters.subjectId);
      if (filters.academicPeriodId) params.set("academicPeriodId", filters.academicPeriodId);
      if (filters.weekOf) params.set("weekOf", filters.weekOf);
      if (filters.status) params.set("status", filters.status);
      if (filters.search) params.set("search", filters.search);
      if (filters.limit) params.set("limit", String(filters.limit));

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
