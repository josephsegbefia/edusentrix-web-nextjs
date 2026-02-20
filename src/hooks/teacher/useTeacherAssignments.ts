import { useQuery } from "@tanstack/react-query";

export type StudioAssignment = {
  id: string;
  title: string;
  instructions: string;
  type: "assignment" | "quiz" | "project" | "practice";
  status: "draft" | "published" | "closed" | "archived";
  dueDate: string | null;
  latePolicy: "accept" | "reject" | "penalize";
  latePenaltyPercent: number | null;
  maxScore: number;
  quizTimeLimitMinutes: number | null;
  weight: number | null;
  subject: { id: string; name: string } | null;
  rubric: { id: string; title: string } | null;
  classGroups: Array<{ id: string; name: string; gradeName?: string }>;
  targetStudentIds: string[];
  attachments: Array<{ name: string; url: string; type: string; size?: number }>;
  questions?: Array<{
    id: string;
    prompt: string;
    points: number;
    explanation?: string | null;
    choices: Array<{ id: string; text: string; isCorrect: boolean }>;
  }>;
  questionCount?: number;
  stats: { total: number; graded: number; pending: number; returned: number };
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string | null;
};

export type TeacherAssignmentsResponse = {
  success: boolean;
  data: {
    assignments: StudioAssignment[];
  };
};

export type TeacherAssignmentFilters = {
  status?: string;
  type?: string;
  classGroupId?: string;
  subjectId?: string;
  search?: string;
};

export function useTeacherAssignments(filters: TeacherAssignmentFilters = {}) {
  return useQuery<TeacherAssignmentsResponse>({
    queryKey: ["teacher-assignments", filters],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (filters.status) searchParams.set("status", filters.status);
      if (filters.type) searchParams.set("type", filters.type);
      if (filters.classGroupId) searchParams.set("classGroupId", filters.classGroupId);
      if (filters.subjectId) searchParams.set("subjectId", filters.subjectId);
      if (filters.search) searchParams.set("search", filters.search);

      const res = await fetch(
        `/api/teacher/studio/assignments?${searchParams.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to load assignments");
      return res.json();
    },
    staleTime: 30_000,
  });
}
