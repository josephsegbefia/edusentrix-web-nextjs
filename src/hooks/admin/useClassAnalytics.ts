import { useQuery } from "@tanstack/react-query";

type LeoRiskLevel = "low" | "medium" | "high";

export type LeoAnalyticsBlock = {
  riskLevel: LeoRiskLevel;
  headline: string;
  summary: string;
  insights: string[];
  predictions: string[];
};

export type AttendanceStudentRow = {
  studentId: string;
  fullName: string;
  admissionNo: string | null;
  photoUrl: string | null;
  totalRecords: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  totalLateMinutes: number;
  attendanceRate: number;
  punctualityRate: number;
  averageLateMinutes: number;
  recentStatuses: Array<{ date: string; status: string }>;
  bucket: "habitual_latecomer" | "truant" | "regular" | "watch" | "steady";
};

export type ClassAttendanceAnalytics = {
  classGroup: { id: string; name: string; fullLabel: string };
  filters: {
    academicPeriodId: string | null;
    academicPeriodLabel: string | null;
    from: string;
    to: string;
  };
  summary: {
    studentCount: number;
    recordedDays: number;
    totalRecords: number;
    attendanceRate: number;
    punctualityRate: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    excusedCount: number;
    averageLateMinutes: number;
    studentsWithNoRecordsCount: number;
  };
  dailySummary: Array<{
    date: string;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    excusedCount: number;
    totalRecords: number;
    attendanceRate: number;
  }>;
  students: AttendanceStudentRow[];
  segments: {
    habitualLatecomers: AttendanceStudentRow[];
    truants: AttendanceStudentRow[];
    regularStudents: AttendanceStudentRow[];
    attentionNeeded: AttendanceStudentRow[];
  };
  leo: LeoAnalyticsBlock;
};

export type PerformanceRankingRow = {
  studentId: string;
  fullName: string;
  admissionNo: string | null;
  photoUrl: string | null;
  score: number;
  rank: number | null;
  totalSubjects: number | null;
  performanceTier: string | null;
  gpa: number | null;
  isPromoted: boolean | null;
};

export type ClassPerformanceAnalytics = {
  classGroup: { id: string; name: string; fullLabel: string };
  filters: {
    academicPeriodId: string | null;
    academicPeriodLabel: string | null;
    subjectId: string;
    subjectLabel: string;
  };
  summary: {
    assessedStudentsCount: number;
    classAverage: number;
    medianScore: number;
    passRate: number;
    topPerformerCount: number;
    atRiskCount: number;
    comparisonAverage: number | null;
    comparisonDelta: number | null;
  };
  distribution: {
    top: number;
    aboveAverage: number;
    average: number;
    atRisk: number;
  };
  ranking: PerformanceRankingRow[];
  subjectBreakdown: Array<{
    subjectId: string;
    subjectName: string;
    subjectCode: string | null;
    averageScore: number;
    topScore: number;
    lowScore: number;
    assessedStudentsCount: number;
    passRate: number;
  }>;
  spotlight: {
    topPerformers: PerformanceRankingRow[];
    attentionNeeded: PerformanceRankingRow[];
  };
  leo: LeoAnalyticsBlock;
};

export type ClassFeeStudentRow = {
  studentId: string;
  fullName: string;
  admissionNo: string | null;
  photoUrl: string | null;
  invoiceCount: number;
  totalBilledMinor: number;
  totalPaidMinor: number;
  totalOutstandingMinor: number;
  overdueInvoiceCount: number;
  lastPaymentDate: string | null;
  nextDueDate: string | null;
  status: "clear" | "partial" | "overdue" | "unbilled";
};

export type ClassFeesAnalytics = {
  classGroup: { id: string; name: string; fullLabel: string };
  filters: {
    academicPeriodId: string | null;
    academicPeriodLabel: string | null;
  };
  summary: {
    studentCount: number;
    invoiceCount: number;
    totalBilledMinor: number;
    totalPaidMinor: number;
    totalOutstandingMinor: number;
    collectionRate: number;
    defaultersCount: number;
    overdueInvoiceCount: number;
    recentCollectionsMinor: number;
  };
  byStatus: {
    clear: number;
    partial: number;
    overdue: number;
    unbilled: number;
  };
  students: ClassFeeStudentRow[];
  spotlight: {
    topDefaulters: ClassFeeStudentRow[];
    onTrack: ClassFeeStudentRow[];
    recentPayments: Array<{
      paymentId: string;
      studentId: string;
      fullName: string;
      photoUrl: string | null;
      amountMinor: number;
      paymentDate: string;
      paymentMethod: string;
    }>;
  };
  leo: LeoAnalyticsBlock;
};

export function useClassAttendanceAnalytics(
  classId: string | undefined,
  filters: {
    academicPeriodId?: string | null;
    from?: string | null;
    to?: string | null;
  }
) {
  return useQuery<{ success: boolean; data: ClassAttendanceAnalytics }>({
    queryKey: ["class-attendance-analytics", classId, filters],
    queryFn: async () => {
      if (!classId) throw new Error("Class ID is required");
      const params = new URLSearchParams();
      if (filters.academicPeriodId) params.set("academicPeriodId", filters.academicPeriodId);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);

      const res = await fetch(
        `/api/admin/classes/${classId}/attendance?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch class attendance analytics");
      return res.json();
    },
    enabled: !!classId,
    staleTime: 30_000,
  });
}

export function useClassPerformanceAnalytics(
  classId: string | undefined,
  filters: {
    academicPeriodId?: string | null;
    subjectId?: string | null;
  }
) {
  return useQuery<{ success: boolean; data: ClassPerformanceAnalytics }>({
    queryKey: ["class-performance-analytics", classId, filters],
    queryFn: async () => {
      if (!classId) throw new Error("Class ID is required");
      const params = new URLSearchParams();
      if (filters.academicPeriodId) params.set("academicPeriodId", filters.academicPeriodId);
      if (filters.subjectId) params.set("subjectId", filters.subjectId);

      const res = await fetch(
        `/api/admin/classes/${classId}/performance?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch class performance analytics");
      return res.json();
    },
    enabled: !!classId,
    staleTime: 30_000,
  });
}

export function useClassFeesAnalytics(
  classId: string | undefined,
  filters: {
    academicPeriodId?: string | null;
  }
) {
  return useQuery<{ success: boolean; data: ClassFeesAnalytics }>({
    queryKey: ["class-fees-analytics", classId, filters],
    queryFn: async () => {
      if (!classId) throw new Error("Class ID is required");
      const params = new URLSearchParams();
      if (filters.academicPeriodId) params.set("academicPeriodId", filters.academicPeriodId);

      const res = await fetch(`/api/admin/classes/${classId}/fees?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch class fee analytics");
      return res.json();
    },
    enabled: !!classId,
    staleTime: 30_000,
  });
}
