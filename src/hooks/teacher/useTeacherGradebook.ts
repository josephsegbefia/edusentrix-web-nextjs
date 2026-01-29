import { useQuery } from "@tanstack/react-query";

export type GradebookAssessment = {
  id: string;
  title: string;
  maxScore: number;
  type: string;
  weight: number;
};

export type GradebookCategory = {
  name: string;
  weight: number;
  assessments: GradebookAssessment[];
};

export type GradebookStudentScore = {
  score: number | null;
  status: "draft" | "published";
};

export type GradebookStudent = {
  _id: string;
  name: string;
  admissionNo?: string;
  scores: Record<string, GradebookStudentScore>;
  totals: {
    caTotal: number;
    examTotal: number;
    finalScore: number;
    grade: string;
  };
};

export type TeacherGradebookResponse = {
  success: boolean;
  data: {
    classGroup: { _id: string; name: string };
    subject: { _id: string; name: string };
    assessmentScheme: { categories: GradebookCategory[] };
    students: GradebookStudent[];
  };
};

export function useTeacherGradebook(classGroupId?: string, subjectId?: string) {
  return useQuery<TeacherGradebookResponse>({
    queryKey: ["teacher-gradebook", classGroupId, subjectId],
    queryFn: async () => {
      if (!classGroupId || !subjectId) {
        throw new Error("Missing gradebook identifiers");
      }
      const res = await fetch(`/api/teacher/gradebook/${classGroupId}/${subjectId}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load gradebook");
      }
      return data;
    },
    enabled: Boolean(classGroupId && subjectId),
    staleTime: 30_000,
  });
}
