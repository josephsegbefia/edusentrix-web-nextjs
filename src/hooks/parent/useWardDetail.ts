// src/hooks/parent/useWardDetail.ts
import { useQuery } from "@tanstack/react-query";
import type { PaystackKeyMode } from "@/types/paystack-key-mode";
import type { FeeStatus, TrendDirection } from "./useParentDashboard";
import type {
  RiskLevel,
  SchoolLevelForAcademics,
  StudentTermPerformanceTier,
} from "@/types/admin/student-academics";

export interface WardDetail {
  id: string;
  studentId: string;
  name: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  classGroup: {
    id: string;
    name: string;
  } | null;
  grade: string | null;
  admissionNo: string | null;
  status: string;
  relationship: string;
  isPrimary: boolean;
}

// Types matching the buildStudentAcademicsDTO output
export interface StudentSubjectPerformance {
  subjectId: string;
  subjectName: string;
  shortCode: string | null;
  teacherName: string | null;
  caPercentage: number | null;
  examPercentage: number | null;
  totalScore: number | null;
  gradeLetter: string | null;
  gradePoint: number | null;
  isPassed: boolean | null;
}

export interface StudentTermOverview {
  termId: string;
  label: string;
  averageScore: number | null;
  classPosition: number | null;
  totalSubjects: number | null;
  performanceTier: StudentTermPerformanceTier | null;
}

export interface WardAcademicsData {
  studentId: string;
  schoolLevel: SchoolLevelForAcademics | null;
  selectedTermId: string | null;
  selectedTermLabel: string | null;
  summary: {
    overallAverage: number | null;
    classPosition: number | null;
    totalStudents: number | null;
    performanceTier: StudentTermPerformanceTier | null;
    trend: TrendDirection;
    trendDelta: number | null;
  };
  term: StudentTermOverview[];
  subjects: StudentSubjectPerformance[];
  comments: Array<{
    id: string;
    commentType: string;
    subjectId: string | null;
    subjectName: string | null;
    teacherName: string | null;
    comment: string;
    isPublic: boolean;
    createdAt: string;
  }>;
  multiTermHistory?: Array<{
    termId: string;
    label: string;
    averageScore: number | null;
    classAverage: number | null;
  }>;
  subjectHistory?: Record<
    string,
    Array<{
      termId: string;
      termLabel: string;
      totalScore: number | null;
    }>
  >;
  riskLevel?: RiskLevel;
  strongestSubject?: { subjectId: string; subjectName: string; score: number } | null;
  weakestSubject?: { subjectId: string; subjectName: string; score: number } | null;
}

export interface WardFeesData {
  status: FeeStatus;
  billCount: number;
  totalFees: number;
  amountPaid: number;
  balanceDue: number;
  paymentProgress: number;
  nextDueDate: string | null;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    title: string;
    amount: number;
    amountMinor: number;
    balanceDue: number;
    balanceDueMinor: number;
    dueDate: string;
    status: "pending" | "partial" | "paid" | "overdue";
    canPayOnline: boolean;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    date: string;
    method: string;
    reference: string;
  }>;
  paystackKeyMode: PaystackKeyMode;
  onlinePaymentsReady: boolean;
}

export interface WardAttendanceData {
  rate: number;
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  totalDays: number;
  trend: TrendDirection;
  recentRecords: Array<{
    date: string;
    status: "present" | "absent" | "late" | "excused";
    notes?: string;
  }>;
  monthlyBreakdown: Array<{
    month: string;
    present: number;
    absent: number;
    late: number;
    total: number;
  }>;
}

/**
 * Hook to fetch single ward detail
 */
export function useWardDetail(wardId: string) {
  return useQuery<WardDetail>({
    queryKey: ["parent", "ward", wardId],
    queryFn: async () => {
      const res = await fetch(`/api/parent/wards/${wardId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch ward");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch ward");
      return json.data as WardDetail;
    },
    enabled: !!wardId,
    staleTime: 60_000,
  });
}

/**
 * Hook to fetch ward academic data
 * Returns data from buildStudentAcademicsDTO
 */
export function useWardAcademics(wardId: string, periodId?: string) {
  return useQuery<WardAcademicsData>({
    queryKey: ["parent", "ward", wardId, "academics", periodId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (periodId) params.set("periodId", periodId);
      
      const res = await fetch(`/api/parent/wards/${wardId}/academics?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch academics");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch academics");
      return json.data as WardAcademicsData;
    },
    enabled: !!wardId,
    staleTime: 60_000,
  });
}

/**
 * Hook to fetch ward fees summary
 */
export function useWardFees(wardId: string) {
  return useQuery<WardFeesData>({
    queryKey: ["parent", "ward", wardId, "fees"],
    queryFn: async () => {
      const res = await fetch(`/api/parent/wards/${wardId}/fees/summary`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch fees");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch fees");
      return json.data as WardFeesData;
    },
    enabled: !!wardId,
    staleTime: 60_000,
  });
}

/**
 * Hook to fetch ward attendance data
 */
export function useWardAttendance(wardId: string, periodId?: string) {
  return useQuery<WardAttendanceData>({
    queryKey: ["parent", "ward", wardId, "attendance", periodId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (periodId) params.set("periodId", periodId);
      
      const res = await fetch(`/api/parent/wards/${wardId}/attendance?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch attendance");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch attendance");
      return json.data as WardAttendanceData;
    },
    enabled: !!wardId,
    staleTime: 60_000,
  });
}
