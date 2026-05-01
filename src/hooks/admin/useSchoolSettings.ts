// src/hooks/admin/useSchoolSettings.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateSetupReadiness } from "@/lib/query/invalidate-setup-readiness";

export type BreakPeriodDTO = {
  name: string;
  startTime: string;
  endTime: string;
  isLunch?: boolean;
};

export type SchoolDayScheduleDTO = {
  dayOfWeek: number;
  periodDuration?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  breaks: BreakPeriodDTO[];
};

export type GradeDayScheduleProfileDTO = {
  id?: string;
  name: string;
  gradeIds: string[];
  daySchedules: SchoolDayScheduleDTO[];
};

export type BreakDailyOverrideDTO = {
  dayOfWeek: number;
  breakName: string;
  startTime?: string;
  endTime?: string;
};

export type BreakGradeOverrideDTO = {
  gradeId: string;
  breakName: string;
  startTime?: string;
  endTime?: string;
};

export type AssemblyConfigDTO = {
  days: number[];
  startTime: string;
  duration: number;
  location?: string;
};

export type AssemblyDailyOverrideDTO = {
  dayOfWeek: number;
  startTime?: string;
  duration?: number;
};

export type AssemblyGradeOverrideDTO = {
  gradeId: string;
  startTime?: string;
  duration?: number;
};

export type PeriodSlotDTO = {
  periodNumber: number;
  startTime: string;
  endTime: string;
  label?: string;
};

export type DailyScheduleOverrideDTO = {
  dayOfWeek: number;
  startTime?: string;
  endTime?: string;
};

export type GradeScheduleOverrideDTO = {
  gradeId: string;
  periodsPerDay?: number;
  periodDuration?: number;
  periodSlots?: PeriodSlotDTO[];
};

export type SchoolSettingsDTO = {
  id: string;
  schoolStartTime: string | null;
  schoolEndTime: string | null;
  periodDuration: number | null;
  periodsPerDay: number | null;
  periodSlots: PeriodSlotDTO[];
  dailyScheduleOverrides: DailyScheduleOverrideDTO[];
  gradeScheduleOverrides: GradeScheduleOverrideDTO[];
  breaks: BreakPeriodDTO[];
  breakDailyOverrides: BreakDailyOverrideDTO[];
  breakGradeOverrides: BreakGradeOverrideDTO[];
  assembly: AssemblyConfigDTO | null;
  assemblyDailyOverrides: AssemblyDailyOverrideDTO[];
  assemblyGradeOverrides: AssemblyGradeOverrideDTO[];
  lateArrivalCutoff: string | null;
  minimumAttendancePercent: number;
  defaultExamWeekDuration: number;
  defaultRevisionWeekDuration: number;
  teacherStudio: {
    enabled: boolean;
  };
  attendanceNotifications: {
    enabled: boolean;
    channels: {
      whatsapp: boolean;
      sms: boolean;
      email: boolean;
    };
  };
  offlineMode: {
    enabled: boolean;
  };
  promotions: {
    autoPreviewEnabled: boolean;
    autoPreviewLeadDays: number;
  };
  lessonsModule: {
    parentSummaryVisibleToParents: boolean;
  };
  updatedAt: string | null;
};

export type SchoolSettingsResponse = {
  success: boolean;
  data: SchoolSettingsDTO;
  message?: string;
};

export type UpdateSchoolSettingsInput = Partial<
  Omit<SchoolSettingsDTO, "id" | "periodSlots" | "updatedAt">
>;

/**
 * Fetch school settings
 */
export function useSchoolSettings() {
  return useQuery<SchoolSettingsResponse>({
    queryKey: ["school-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch school settings");
      return res.json();
    },
    staleTime: 60_000, // 1 minute
  });
}

/**
 * Update school settings
 */
export function useUpdateSchoolSettings() {
  const queryClient = useQueryClient();

  return useMutation<SchoolSettingsResponse, Error, UpdateSchoolSettingsInput>({
    mutationFn: async (data: UpdateSchoolSettingsInput) => {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update settings");
      }
      return res.json();
    },
    onSuccess: (response) => {
      queryClient.setQueryData(["school-settings"], response);
      queryClient.invalidateQueries({ queryKey: ["school-settings"] });
      invalidateSetupReadiness(queryClient);
    },
  });
}

/**
 * Helper to format time for display
 */
export function formatTime(time: string | null | undefined): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

/**
 * Helper to get day name
 */
export function getDayName(day: number): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[day] || "";
}

/**
 * Helper to get short day name
 */
export function getShortDayName(day: number): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[day] || "";
}
