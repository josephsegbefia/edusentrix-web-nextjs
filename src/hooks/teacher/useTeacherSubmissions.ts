import { useQuery } from "@tanstack/react-query";

export type TeacherSubmission = {
  id: string;
  status: string;
  submittedAt: string | null;
  isLate: boolean;
  score: number | null;
  gradedAt: string | null;
  publishedAt: string | null;
  student: {
    id: string;
    name: string;
    admissionNo?: string;
    photoUrl?: string;
  } | null;
  assignment: {
    id: string;
    title: string;
    type: string;
    status: string;
    dueDate: string | null;
    subject: { id: string; name: string } | null;
  } | null;
};

export type TeacherSubmissionsResponse = {
  success: boolean;
  data: {
    submissions: TeacherSubmission[];
  };
};

export type TeacherSubmissionFilters = {
  status?: string;
  assignmentId?: string;
  subjectId?: string;
  classGroupId?: string;
};

export function useTeacherSubmissions(filters: TeacherSubmissionFilters = {}) {
  return useQuery<TeacherSubmissionsResponse>({
    queryKey: ["teacher-submissions", filters],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (filters.status) searchParams.set("status", filters.status);
      if (filters.assignmentId) searchParams.set("assignmentId", filters.assignmentId);
      if (filters.subjectId) searchParams.set("subjectId", filters.subjectId);
      if (filters.classGroupId) searchParams.set("classGroupId", filters.classGroupId);

      const res = await fetch(
        `/api/teacher/studio/submissions?${searchParams.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to load submissions");
      return res.json();
    },
    staleTime: 30_000,
  });
}
