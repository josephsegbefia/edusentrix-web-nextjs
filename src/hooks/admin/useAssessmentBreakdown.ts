// src/hooks/admin/useAssessmentBreakdown.ts
import { useQuery } from "@tanstack/react-query";

type AssessmentBreakdownResponse = {
  success: boolean;
  data: {
    subjectId: string;
    subjectName: string;
    termId: string;
    termLabel: string;
    assessments: Array<{
      id: string;
      assessmentType: string;
      title: string;
      score: number;
      maxScore: number;
      percentage: number;
      weight: number;
      gradedAt: string | null;
      remarks: string | null;
      createdAt: string;
    }>;
    summary: {
      caTotal: number;
      caMaxTotal: number;
      examScore: number;
      examMaxScore: number;
      totalScore: number;
    } | null;
  };
};

export function useAssessmentBreakdown(
  studentId: string,
  subjectId: string,
  termId: string,
  enabled = true
) {
  return useQuery<AssessmentBreakdownResponse>({
    queryKey: ["assessment-breakdown", studentId, subjectId, termId],
    queryFn: async () => {
      const params = new URLSearchParams({
        subjectId,
        termId,
      });
      const res = await fetch(
        `/api/admin/students/${studentId}/academics/assessments?${params.toString()}`
      );
      if (!res.ok) throw new Error("Failed to fetch assessment breakdown");
      return res.json();
    },
    enabled: enabled && !!studentId && !!subjectId && !!termId,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
