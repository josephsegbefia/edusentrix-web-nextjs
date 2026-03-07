// src/hooks/admin/useGrades.ts
import { useQuery } from "@tanstack/react-query";

export type GradeDTO = {
  id: string;
  name: string;
  code: string | null;
  stage: string;
  order: number;
  isActive: boolean;
  classCount?: number;
  studentCount?: number;
};

export type GradesResponse = {
  success: boolean;
  data: GradeDTO[];
  error?: string;
};

export type GradeTeacherDTO = {
  id: string;
  fullName: string;
  roles: ("homeroom" | "subject")[];
  classLabels: string[];
};

export type GradeOverviewDTO = {
  grade: {
    id: string;
    name: string;
    code: string | null;
    stage: string;
    order: number;
  };
  stats: {
    totalStudents: number;
    totalClasses: number;
    totalCapacity: number | null;
    avgClassSize: number;
    classesWithoutHomeroom: number;
    subjectsWithoutTeacher: number;
  };
  subjects: Array<{
    id: string;
    name: string;
    classesWithSubject: number;
    classesWithoutSubject: number;
  }>;
  classDistribution: Array<{
    classGroupId: string;
    classGroupName: string;
    gradeId: string | null;
    gradeName: string | null;
    count: number;
  }>;
  currentPeriod: { yearLabel: string; term: string } | null;
  feeDefaultersCount: number;
};

export type GradeFeesDTO = {
  totalBilledMinor: number;
  totalPaidMinor: number;
  totalOutstandingMinor: number;
  collectionRate: number;
  feeDefaultersCount: number;
  invoiceCount: number;
  studentCount: number;
  byClass: Array<{
    classGroupId: string;
    className: string;
    totalBilledMinor: number;
    totalPaidMinor: number;
    totalOutstandingMinor: number;
    studentCount: number;
    collectionRate: number;
  }>;
};

/**
 * Hook to fetch grade fee analytics
 */
export function useGradeFees(gradeId: string | undefined) {
  return useQuery<{ success: boolean; data: GradeFeesDTO }>({
    queryKey: ["grade-fees", gradeId],
    queryFn: async () => {
      if (!gradeId) throw new Error("Grade ID is required");
      const res = await fetch(`/api/admin/grades/${gradeId}/fees`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch grade fees");
      return res.json();
    },
    enabled: !!gradeId,
    staleTime: 30_000,
  });
}

/**
 * Hook to fetch grade overview (stats, subjects, class distribution, etc.)
 */
export function useGradeOverview(gradeId: string | undefined) {
  return useQuery<{ success: boolean; data: GradeOverviewDTO }>({
    queryKey: ["grade-overview", gradeId],
    queryFn: async () => {
      if (!gradeId) throw new Error("Grade ID is required");
      const res = await fetch(`/api/admin/grades/${gradeId}/overview`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch grade overview");
      return res.json();
    },
    enabled: !!gradeId,
    staleTime: 30_000,
  });
}

/**
 * Hook to fetch all teachers (homeroom + subject) for a grade
 */
export function useGradeTeachers(gradeId: string | undefined) {
  return useQuery<{ success: boolean; data: GradeTeacherDTO[] }>({
    queryKey: ["grade-teachers", gradeId],
    queryFn: async () => {
      if (!gradeId) throw new Error("Grade ID is required");
      const res = await fetch(`/api/admin/grades/${gradeId}/teachers`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch grade teachers");
      return res.json();
    },
    enabled: !!gradeId,
    staleTime: 30_000,
  });
}

/**
 * Hook to fetch all grades for the current school
 */
export function useGrades(isActive?: boolean, withMeta = false) {
  return useQuery<GradesResponse>({
    queryKey: ["grades", isActive, withMeta],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (isActive !== undefined) params.set("isActive", String(isActive));
      if (withMeta) params.set("withMeta", "true");

      const res = await fetch(`/api/admin/grades?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch grades");
      return res.json();
    },
    staleTime: 60_000, // Grades don't change often
  });
}
