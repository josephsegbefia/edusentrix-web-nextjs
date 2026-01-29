import { useQuery } from "@tanstack/react-query";

export type RubricCriterion = {
  title: string;
  description?: string | null;
  maxScore: number;
  weight?: number | null;
};

export type RubricSummary = {
  id: string;
  title: string;
  description: string | null;
  criteria: RubricCriterion[];
  createdAt: string | null;
};

export type TeacherRubricsResponse = {
  success: boolean;
  data: {
    rubrics: RubricSummary[];
  };
};

export function useTeacherRubrics() {
  return useQuery<TeacherRubricsResponse>({
    queryKey: ["teacher-rubrics"],
    queryFn: async () => {
      const res = await fetch("/api/teacher/studio/rubrics", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load rubrics");
      return res.json();
    },
    staleTime: 60_000,
  });
}
