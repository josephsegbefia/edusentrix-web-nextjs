// src/hooks/admin/useSchoolSettings.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type BreakPeriodDTO = {
  name: string;
  startTime: string;
  endTime: string;
  isLunch?: boolean;
};

export type AssemblyConfigDTO = {
  days: number[];
  startTime: string;
  duration: number;
  location?: string;
};

export type PeriodSlotDTO = {
  periodNumber: number;
  startTime: string;
  endTime: string;
  label?: string;
};

export type SchoolSettingsDTO = {
  id: string;
  schoolStartTime: string;
  schoolEndTime: string;
  periodDuration: number;
  periodsPerDay: number;
  periodSlots: PeriodSlotDTO[];
  breaks: BreakPeriodDTO[];
  assembly: AssemblyConfigDTO | null;
  lateArrivalCutoff: string | null;
  minimumAttendancePercent: number;
  defaultExamWeekDuration: number;
  defaultRevisionWeekDuration: number;
  workingDays: number[];
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
  updatedAt: string | null;
};

export type UpdateSchoolSettingsInput = Partial<
  Omit<SchoolSettingsDTO, "id" | "periodSlots" | "updatedAt">
>;

/**
 * Fetch school settings
 */
export function useSchoolSettings() {
  return useQuery<{ success: boolean; data: SchoolSettingsDTO }>({
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

  return useMutation({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-settings"] });
    },
  });
}

/**
 * Helper to format time for display
 */
export function formatTime(time: string): string {
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
