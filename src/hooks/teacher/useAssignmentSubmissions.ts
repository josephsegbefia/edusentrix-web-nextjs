import { useQuery } from "@tanstack/react-query";

export type AssignmentSubmission = {
  id: string;
  status: string;
  submittedAt: string | null;
  isLate: boolean;
  score: number | null;
  feedback: string | null;
  gradedAt: string | null;
  publishedAt: string | null;
  student: {
    id: string;
    name: string;
    admissionNo?: string;
    photoUrl?: string;
  } | null;
};

export type AssignmentSubmissionsResponse = {
  success: boolean;
  data: {
    assignment: {
      id: string;
      title: string;
      status: string;
      dueDate: string | null;
      maxScore: number;
    };
    submissions: AssignmentSubmission[];
    statusCounts: Record<string, number>;
  };
};

export function useAssignmentSubmissions(assignmentId?: string) {
  return useQuery<AssignmentSubmissionsResponse>({
    queryKey: ["teacher-assignment-submissions", assignmentId],
    queryFn: async () => {
      if (!assignmentId) throw new Error("Missing assignment id");
      const res = await fetch(
        `/api/teacher/studio/assignments/${assignmentId}/submissions`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to load submissions");
      return res.json();
    },
    enabled: Boolean(assignmentId),
    staleTime: 30_000,
  });
}
