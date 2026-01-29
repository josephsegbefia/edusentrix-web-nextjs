import { useQuery } from "@tanstack/react-query";

export type SubmissionDetailResponse = {
  success: boolean;
  data: {
    submission: {
      id: string;
      status: string;
      content: string;
      attachments: Array<{ name: string; url: string; type: string; size?: number }>;
      submittedAt: string | null;
      isLate: boolean;
      score: number | null;
      feedback: string | null;
      rubricScores: Record<string, number>;
      gradedAt: string | null;
      publishedAt: string | null;
      returnedAt: string | null;
      returnReason: string | null;
      student: {
        id: string;
        name: string;
        admissionNo?: string;
        photoUrl?: string;
      } | null;
    };
    assignment: {
      id: string;
      title: string;
      instructions: string;
      status: string;
      dueDate: string | null;
      maxScore: number;
      subject: { id: string; name: string } | null;
      rubric: {
        id: string;
        title: string;
        criteria: Array<{
          title: string;
          description?: string;
          maxScore: number;
          weight?: number;
        }>;
      } | null;
    };
  };
};

export function useSubmissionDetail(id?: string) {
  return useQuery<SubmissionDetailResponse>({
    queryKey: ["teacher-submission-detail", id],
    queryFn: async () => {
      if (!id) throw new Error("Missing submission id");
      const res = await fetch(`/api/teacher/studio/submissions/${id}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load submission");
      return res.json();
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}
