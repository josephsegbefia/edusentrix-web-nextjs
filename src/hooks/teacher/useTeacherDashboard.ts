import { useQuery } from "@tanstack/react-query";
import type { SchoolSchemeWeekSnapshot } from "@/lib/schemes/resolve-scheme-week";

export type TeacherDashboardScheduleSlot = {
  classGroupId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  startTime: string | null;
  endTime: string | null;
  date: string;
};

export type TeacherDashboardResponse = {
  success: boolean;
  data: {
    stats: {
      totalClasses: number;
      totalStudents: number;
      pendingToMark: number;
      todayAttendanceTaken: boolean;
    };
    today: {
      date: string;
      schedule: TeacherDashboardScheduleSlot[];
    };
    weekSchedule: {
      weekStart: string;
      weekEnd: string;
      days: Array<{
        date: string;
        dayOfWeek: number;
        isToday: boolean;
        slots: TeacherDashboardScheduleSlot[];
      }>;
    } | null;
    thisWeekSchemeRows: Array<{
      id: string;
      schemeId: string;
      schemeTitle: string;
      title: string;
      weekNumber: number | null;
      className: string;
      subjectName: string;
      coverageStatus: string;
    }>;
    queues: Array<{
      id: string;
      label: string;
      count: number;
      href: string;
      tone: "amber" | "indigo" | "rose" | "emerald" | "slate";
    }>;
    currentSchemeWeek: SchoolSchemeWeekSnapshot | null;
  };
};

export function useTeacherDashboard() {
  return useQuery<TeacherDashboardResponse>({
    queryKey: ["teacher-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/teacher/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch teacher dashboard");
      return res.json();
    },
    staleTime: 30_000,
  });
}
