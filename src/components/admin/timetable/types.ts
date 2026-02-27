import type { TimetableSlotDTO } from "@/hooks/admin/useTimetablePlanner";

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const WORKING_DAYS_DEFAULT = [1, 2, 3, 4, 5] as const;

export type TimetableFilterState = {
  gradeId: string;
  classGroupId: string;
  teacherId: string;
  subjectId: string;
};

export type TimetableClassOption = {
  id: string;
  name: string;
  fullLabel: string;
  gradeId: string;
};

export type TimetableGradeOption = {
  id: string;
  name: string;
};

export type TimetableSubjectOption = {
  id: string;
  name: string;
  code: string | null;
};

export type TimetableTeacherOption = {
  id: string;
  fullName: string;
};

export type TimetableEnrichedSlot = TimetableSlotDTO & {
  className: string;
  classLabel: string;
  gradeName: string;
  subjectName: string;
  subjectCode: string | null;
  teacherName: string;
};

export function formatTimeLabel(time: string): string {
  const [hoursRaw, minutesRaw] = time.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;

  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

export function durationHours(startTime: string, endTime: string): number {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;

  if (!Number.isFinite(startTotal) || !Number.isFinite(endTotal) || endTotal <= startTotal) {
    return 0;
  }

  const raw = (endTotal - startTotal) / 60;
  return Math.round(raw * 100) / 100;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getWeekStartMonday(date: Date): Date {
  const normalized = startOfDay(date);
  const day = normalized.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(
    normalized.getFullYear(),
    normalized.getMonth(),
    normalized.getDate() + diff
  );
}

export function shiftDate(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function shiftMonth(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function ymd(date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function humanDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function dateForDayOfWeek(referenceDate: Date, dayOfWeek: number): Date {
  const monday = getWeekStartMonday(referenceDate);
  const normalizedDay = dayOfWeek === 0 ? 6 : Math.max(0, Math.min(6, dayOfWeek - 1));
  return shiftDate(monday, normalizedDay);
}

export function filterSlots(
  slots: TimetableSlotDTO[],
  filters: TimetableFilterState
): TimetableSlotDTO[] {
  return slots.filter((slot) => {
    if (filters.gradeId !== "all" && slot.gradeId !== filters.gradeId) return false;
    if (filters.classGroupId !== "all" && slot.classGroupId !== filters.classGroupId) return false;
    if (filters.teacherId !== "all" && slot.teacherId !== filters.teacherId) return false;
    if (filters.subjectId !== "all" && slot.subjectId !== filters.subjectId) return false;
    return true;
  });
}
