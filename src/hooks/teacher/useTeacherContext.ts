import { useQuery } from "@tanstack/react-query";
import type { DelegationNavItem } from "@/lib/delegations/types";

export type TeacherContextResponse = {
  success: boolean;
  data: {
    teacher: {
      _id: string;
      firstName?: string;
      lastName?: string;
      email: string;
      photoUrl?: string;
      subroles: string[];
      homeroomClassGroupId?: string;
      homeroomClassName?: string;
      displayName: string;
    };
    school: {
      _id: string;
      name: string;
      logoUrl?: string;
      curriculumCode?: string;
    };
    currentPeriod: {
      _id: string;
      name: string;
      termNumber: number | null;
    } | null;
    stats: {
      totalClasses: number;
      totalStudents: number;
      pendingToMark: number;
      todayAttendanceTaken: boolean;
    };
    features: {
      teacherStudioEnabled: boolean;
      attendanceNotificationsEnabled?: boolean;
      attendanceNotificationChannels?: {
        whatsapp: boolean;
        sms: boolean;
        email: boolean;
      };
      offlineModeEnabled?: boolean;
    };
    permissions: string[];
    delegations?: DelegationNavItem[];
  };
};

export function useTeacherContext() {
  return useQuery<TeacherContextResponse>({
    queryKey: ["teacher-context"],
    queryFn: async () => {
      const res = await fetch("/api/teacher/me", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch teacher context");
      return res.json();
    },
    staleTime: 60_000,
  });
}
