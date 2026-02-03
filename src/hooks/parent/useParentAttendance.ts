// src/hooks/parent/useParentAttendance.ts
import { useQuery } from "@tanstack/react-query";

export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type TrendDirection = "up" | "down" | "stable";

export interface WardAttendanceSummary {
  wardId: string;
  wardName: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  classGroup: string;
  rate: number;
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  daysExcused: number;
  totalDays: number;
  trend: TrendDirection;
  previousRate: number | null;
}

export interface DailyAttendanceRecord {
  date: string;
  wardId: string;
  wardName: string;
  status: AttendanceStatus;
  notes?: string;
}

export interface MonthlyBreakdown {
  month: string;
  label: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  rate: number;
}

export interface OverallAttendanceSummary {
  averageRate: number | null;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  totalExcused: number;
  totalDays: number;
}

export interface AcademicPeriodInfo {
  id: string;
  name: string;
  label: string;
}

export interface ParentAttendanceDTO {
  currentPeriod: AcademicPeriodInfo | null;
  selectedPeriodId: string | null;
  availablePeriods: AcademicPeriodInfo[];
  wards: WardAttendanceSummary[];
  overallSummary: OverallAttendanceSummary;
  recentRecords: DailyAttendanceRecord[];
  monthlyBreakdown: MonthlyBreakdown[];
}

/**
 * Hook to fetch aggregate attendance data for all wards
 */
export function useParentAttendance(periodId?: string, month?: string) {
  return useQuery<ParentAttendanceDTO>({
    queryKey: ["parent", "attendance", periodId, month],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (periodId) params.set("periodId", periodId);
      if (month) params.set("month", month);

      const res = await fetch(`/api/parent/attendance?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch attendance");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch attendance");
      return json.data as ParentAttendanceDTO;
    },
    staleTime: 60_000,
  });
}
