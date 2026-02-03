// src/hooks/parent/useParentAcademics.ts
import { useQuery } from "@tanstack/react-query";

export type TrendDirection = "up" | "down" | "stable";
export type PerformanceTier = "top" | "above_average" | "average" | "at_risk";

export interface WardAcademicSummary {
  wardId: string;
  wardName: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  classGroup: string;
  grade: string | null;
  average: number | null;
  previousAverage: number | null;
  trend: TrendDirection;
  classPosition: number | null;
  totalStudents: number | null;
  performanceTier: PerformanceTier | null;
  subjectCount: number;
  passedCount: number;
  failedCount: number;
}

export interface SubjectPerformance {
  subjectId: string;
  subjectName: string;
  shortCode: string | null;
  wardId: string;
  wardName: string;
  totalScore: number | null;
  gradeLetter: string | null;
  isPassed: boolean | null;
}

export interface AcademicComparisonData {
  wardId: string;
  wardName: string;
  photoUrl: string | null;
  average: number | null;
  color: string;
}

export interface AcademicPeriodInfo {
  id: string;
  name: string;
  label: string;
}

export interface OverallSummary {
  averageAcrossWards: number | null;
  highestPerformer: { wardId: string; wardName: string; average: number | null } | null;
  mostImproved: { wardId: string; wardName: string; improvement: number } | null;
  totalSubjects: number;
}

export interface ParentAcademicsDTO {
  currentPeriod: AcademicPeriodInfo | null;
  selectedPeriodId: string | null;
  availablePeriods: AcademicPeriodInfo[];
  wards: WardAcademicSummary[];
  comparison: AcademicComparisonData[];
  topPerformingSubjects: SubjectPerformance[];
  needsImprovementSubjects: SubjectPerformance[];
  overallSummary: OverallSummary;
}

/**
 * Hook to fetch aggregate academic data for all wards
 */
export function useParentAcademics(periodId?: string) {
  return useQuery<ParentAcademicsDTO>({
    queryKey: ["parent", "academics", periodId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (periodId) params.set("periodId", periodId);

      const res = await fetch(`/api/parent/academics?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch academics");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch academics");
      return json.data as ParentAcademicsDTO;
    },
    staleTime: 60_000,
  });
}
