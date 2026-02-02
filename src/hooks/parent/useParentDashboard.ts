// src/hooks/parent/useParentDashboard.ts
import { useQuery } from "@tanstack/react-query";

export type TrendDirection = "up" | "down" | "stable";
export type FeeStatus = "clear" | "partial" | "owing";

export interface WardSummary {
  id: string;
  studentId: string;
  name: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  classGroup: string;
  classGroupId: string;
  admissionNo: string | null;
  status: string;
  relationship: string;
  isPrimary: boolean;
  feeStatus: FeeStatus;
  outstandingAmount: number;
}

export interface DashboardSummary {
  totalWards: number;
  totalOutstanding: number;
  upcomingPayments: number;
}

export interface ParentDashboardDTO {
  wards: WardSummary[];
  summary: DashboardSummary;
}

/**
 * Hook to fetch the parent dashboard data including wards and summary
 */
export function useParentDashboard() {
  return useQuery<ParentDashboardDTO>({
    queryKey: ["parent", "dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/parent/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch dashboard");
      return json.data as ParentDashboardDTO;
    },
    staleTime: 60_000,
  });
}

// Types for detailed ward data with academic/attendance/fee info
export interface WardAcademicSummary {
  average: number;
  totalSubjects: number;
  subjectsPassed: number;
  rank: number;
  totalStudentsInClass: number;
  trend: TrendDirection;
  previousAverage?: number;
}

export interface WardAttendanceSummary {
  rate: number;
  daysPresent: number;
  daysAbsent: number;
  totalSchoolDays: number;
  trend: TrendDirection;
}

export interface WardFeeSummary {
  status: FeeStatus;
  totalFees: number;
  amountPaid: number;
  outstandingAmount: number;
  nextPaymentDue?: string;
  paymentProgress: number;
}

export interface LatestGrade {
  id: string;
  subject: string;
  assessmentType: string;
  score: number;
  maxScore: number;
  percentage: number;
  date: string;
  teacherName?: string;
}

export interface WardDashboardData extends WardSummary {
  academic: WardAcademicSummary;
  attendance: WardAttendanceSummary;
  fees: WardFeeSummary;
  latestGrade: LatestGrade | null;
}

export interface ParentWardsResponse {
  periodId: string;
  periodName: string;
  isCurrentPeriod: boolean;
  wards: WardDashboardData[];
}

/**
 * Hook to fetch detailed ward data with academic, attendance, and fee information
 */
export function useParentWards(periodId?: string) {
  return useQuery<ParentWardsResponse>({
    queryKey: ["parent", "wards", periodId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (periodId) params.set("periodId", periodId);
      params.set("include", "grades,fees,attendance,rank");
      
      const res = await fetch(`/api/parent/wards?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch wards");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch wards");
      return json.data as ParentWardsResponse;
    },
    staleTime: 60_000,
  });
}
