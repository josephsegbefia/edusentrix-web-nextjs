import { useQuery } from "@tanstack/react-query";

export type GradebookAssessmentType = {
  value: string;
  label: string;
};

export type GradebookGradingScale = {
  name: string;
  caWeight: number;
  examWeight: number;
  gradeMappings: Array<{
    minPercentage: number;
    maxPercentage: number;
    letter: string;
    point: number;
    description?: string | null;
  }>;
};

export type TeacherGradebookAssessmentsResponse = {
  success: boolean;
  data: {
    assessmentTypes: GradebookAssessmentType[];
    gradingScale: GradebookGradingScale;
  };
};

export function useTeacherGradebookAssessments() {
  return useQuery<TeacherGradebookAssessmentsResponse>({
    queryKey: ["teacher-gradebook-assessments"],
    queryFn: async () => {
      const res = await fetch("/api/teacher/gradebook/assessments", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load gradebook settings");
      }
      return data;
    },
    staleTime: 60_000,
  });
}
