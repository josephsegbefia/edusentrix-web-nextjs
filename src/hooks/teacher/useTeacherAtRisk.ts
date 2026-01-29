import { useQuery } from "@tanstack/react-query";

export type TeacherAtRiskStudent = {
  id: string;
  name: string;
  admissionNo?: string;
  photoUrl?: string;
  classGroupId: string;
  className: string;
  attendanceRate: number | null;
  submissionRate: number | null;
  averageScore: number | null;
  flags: {
    attendance: boolean;
    submissions: boolean;
    score: boolean;
  };
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  reasons: string[];
};

export type TeacherAtRiskResponse = {
  success: boolean;
  data: {
    students: TeacherAtRiskStudent[];
    total: number;
    thresholds?: {
      attendance?: number;
      submissions?: number;
      score?: number;
    };
  };
};

export type TeacherAtRiskFilters = {
  classGroupId?: string;
  limit?: number;
  enabled?: boolean;
};

export function useTeacherAtRisk(filters?: TeacherAtRiskFilters) {
  return useQuery<TeacherAtRiskResponse>({
    queryKey: ["teacher-at-risk", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.classGroupId) params.set("classGroupId", filters.classGroupId);
      if (filters?.limit) params.set("limit", String(filters.limit));
      const res = await fetch(`/api/teacher/analytics/at-risk?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to fetch at-risk students");
      }
      return data;
    },
    enabled: filters?.enabled ?? true,
    staleTime: 30_000,
  });
}
