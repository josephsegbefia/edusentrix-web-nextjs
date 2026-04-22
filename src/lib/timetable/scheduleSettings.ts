/**
 * Schedule settings resolution for timetable creation.
 * Per-day / per-grade model only (scheduleModelVersion 2).
 */

import type { IBreakPeriod, IPeriodSlot } from "@/models/SchoolSettings";

export type ResolvedAssembly = {
  startTime: string;
  duration: number;
};

export type ResolvedScheduleSettings = {
  startTime: string;
  endTime: string;
  periodsPerDay: number;
  periodDuration: number;
  periodSlots: IPeriodSlot[];
  breaks: IBreakPeriod[];
  assembly: ResolvedAssembly | null;
  isConfigured: boolean;
  source: "day_schedule" | "grade_profile";
  profileName?: string | null;
};

export type ResolvedScheduleDiagnostics = {
  firstPeriodStartTime: string | null;
  lastPeriodEndTime: string | null;
  scheduledPeriods: number;
  periodsShortfall: number;
  teachingMinutes: number;
  breakMinutes: number;
  assemblyMinutes: number;
  daySpanMinutes: number;
  allocatedMinutes: number;
  unallocatedMinutes: number;
  overflowMinutes: number;
};

export type ScheduleDayConfigInput = {
  dayOfWeek: number;
  periodDuration?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  breaks?: IBreakPeriod[];
};

export type GradeDayScheduleProfileInput = {
  _id?: string | { toString(): string };
  name?: string;
  gradeIds?: Array<string | { toString(): string }>;
  daySchedules?: ScheduleDayConfigInput[];
};

/** V2 schedule input (per-day + optional grade profiles). */
export type ScheduleSettingsInput = {
  scheduleModelVersion?: number | null;
  workingDays?: number[];
  daySchedules?: ScheduleDayConfigInput[];
  gradeDayScheduleProfiles?: GradeDayScheduleProfileInput[];
};

type NormalizedDaySchedule = {
  dayOfWeek: number;
  periodDuration: number | null;
  startTime: string | null;
  endTime: string | null;
  breaks?: IBreakPeriod[];
};

function toIdString(value: string | { toString(): string } | null | undefined) {
  if (value == null) return null;
  return typeof value === "string" ? value : value.toString();
}

function normalizeDaySchedule(day: ScheduleDayConfigInput): NormalizedDaySchedule {
  return {
    dayOfWeek: day.dayOfWeek,
    periodDuration:
      typeof day.periodDuration === "number" && Number.isFinite(day.periodDuration)
        ? day.periodDuration
        : null,
    startTime: typeof day.startTime === "string" && day.startTime.trim() ? day.startTime : null,
    endTime: typeof day.endTime === "string" && day.endTime.trim() ? day.endTime : null,
    breaks: Array.isArray(day.breaks) ? day.breaks : undefined,
  };
}

function sortBreaks(breaks: IBreakPeriod[]) {
  return [...breaks].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

function buildEmptyResolvedSchedule(
  source: ResolvedScheduleSettings["source"],
  profileName?: string | null
): ResolvedScheduleSettings {
  return {
    startTime: "",
    endTime: "",
    periodsPerDay: 0,
    periodDuration: 0,
    periodSlots: [],
    breaks: [],
    assembly: null,
    isConfigured: false,
    source,
    profileName: profileName ?? null,
  };
}

export function timeToMinutes(time: string | null | undefined): number {
  if (!time || typeof time !== "string" || !time.includes(":")) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const total = Math.max(0, Math.floor(minutes));
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function generateScheduleLayout(
  startTime: string,
  periodDuration: number,
  periodsPerDay: number,
  breaks: IBreakPeriod[] = [],
  options?: { maxEndTime?: string | null }
): { periodSlots: IPeriodSlot[]; effectiveBreaks: IBreakPeriod[] } {
  const slots: IPeriodSlot[] = [];
  const effectiveBreaks: IBreakPeriod[] = [];
  const startMinutes = timeToMinutes(startTime);
  const maxEnd =
    options?.maxEndTime != null && options.maxEndTime !== ""
      ? timeToMinutes(options.maxEndTime)
      : 24 * 60;
  const pendingBreaks = sortBreaks(breaks)
    .map((breakPeriod) => ({
      ...breakPeriod,
      desiredStartMinutes: timeToMinutes(breakPeriod.startTime),
      durationMinutes: Math.max(
        0,
        timeToMinutes(breakPeriod.endTime) - timeToMinutes(breakPeriod.startTime)
      ),
    }))
    .filter(
      (breakPeriod) =>
        Number.isFinite(breakPeriod.desiredStartMinutes) &&
        breakPeriod.durationMinutes > 0
    );

  let currentTime = startMinutes;
  let periodNum = 1;

  while (periodNum <= periodsPerDay) {
    if (currentTime >= maxEnd) break;

    while (pendingBreaks.length > 0 && currentTime >= pendingBreaks[0].desiredStartMinutes) {
      const nextBreak = pendingBreaks.shift()!;
      const breakEnd = currentTime + nextBreak.durationMinutes;
      if (breakEnd > maxEnd) {
        return { periodSlots: slots, effectiveBreaks };
      }
      effectiveBreaks.push({
        name: nextBreak.name,
        startTime: minutesToTime(currentTime),
        endTime: minutesToTime(breakEnd),
        isLunch: nextBreak.isLunch,
      });
      currentTime = breakEnd;
    }

    const periodEnd = currentTime + periodDuration;
    if (periodEnd > maxEnd) break;

    slots.push({
      periodNumber: periodNum,
      startTime: minutesToTime(currentTime),
      endTime: minutesToTime(periodEnd),
    });
    currentTime = periodEnd;
    periodNum += 1;
  }

  return { periodSlots: slots, effectiveBreaks };
}

function resolvePerDaySchedule(
  settings: ScheduleSettingsInput,
  gradeId?: string | { toString(): string } | null,
  dayOfWeek?: number | null
): ResolvedScheduleSettings {
  if (dayOfWeek == null) {
    return buildEmptyResolvedSchedule("day_schedule");
  }

  const gradeIdStr = toIdString(gradeId);
  const baseDay = settings.daySchedules?.find((entry) => entry.dayOfWeek === dayOfWeek);

  const matchingProfile =
    gradeIdStr == null
      ? null
      : (settings.gradeDayScheduleProfiles || []).find((profile) =>
          (profile.gradeIds || []).some((value) => toIdString(value) === gradeIdStr)
        ) || null;

  const profileDay =
    matchingProfile?.daySchedules?.find((entry) => entry.dayOfWeek === dayOfWeek) || null;

  const normalizedBase = baseDay ? normalizeDaySchedule(baseDay) : null;
  const normalizedProfile = profileDay ? normalizeDaySchedule(profileDay) : null;

  const startTime = normalizedProfile?.startTime ?? normalizedBase?.startTime ?? null;
  const endTime = normalizedProfile?.endTime ?? normalizedBase?.endTime ?? null;
  const periodDuration =
    normalizedProfile?.periodDuration ?? normalizedBase?.periodDuration ?? null;
  const breaks =
    normalizedProfile?.breaks !== undefined
      ? normalizedProfile.breaks
      : normalizedBase?.breaks !== undefined
        ? normalizedBase.breaks
        : [];

  const source: ResolvedScheduleSettings["source"] = profileDay
    ? "grade_profile"
    : "day_schedule";

  if (
    !startTime ||
    !endTime ||
    !periodDuration ||
    periodDuration <= 0 ||
    timeToMinutes(endTime) <= timeToMinutes(startTime)
  ) {
    return buildEmptyResolvedSchedule(source, matchingProfile?.name || null);
  }

  const maxDayMinutes = Math.max(0, timeToMinutes(endTime) - timeToMinutes(startTime));
  const totalBreakMinutes = sortBreaks(breaks).reduce((total, breakPeriod) => {
    return total + Math.max(0, timeToMinutes(breakPeriod.endTime) - timeToMinutes(breakPeriod.startTime));
  }, 0);
  const availableTeachingMinutes = Math.max(0, maxDayMinutes - totalBreakMinutes);
  const periodsPerDay = Math.max(0, Math.floor(availableTeachingMinutes / periodDuration));

  const generated = generateScheduleLayout(startTime, periodDuration, periodsPerDay, breaks, {
    maxEndTime: endTime,
  });

  return {
    startTime,
    endTime,
    periodsPerDay: generated.periodSlots.length,
    periodDuration,
    periodSlots: generated.periodSlots,
    breaks: generated.effectiveBreaks,
    assembly: null,
    isConfigured: true,
    source,
    profileName: matchingProfile?.name || null,
  };
}

/**
 * Resolve effective schedule settings for a given grade and weekday (v2 per-day model only).
 */
export function getResolvedScheduleSettings(
  settings: ScheduleSettingsInput,
  gradeId?: string | { toString(): string } | null,
  dayOfWeek?: number | null
): ResolvedScheduleSettings {
  return resolvePerDaySchedule(settings, gradeId, dayOfWeek);
}

export function getResolvedScheduleDiagnostics(
  resolved: ResolvedScheduleSettings
): ResolvedScheduleDiagnostics {
  const firstPeriod = resolved.periodSlots[0] ?? null;
  const lastPeriod = resolved.periodSlots[resolved.periodSlots.length - 1] ?? null;

  const teachingMinutes = resolved.periodSlots.reduce((total, slot) => {
    return total + Math.max(0, timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime));
  }, 0);
  const breakMinutes = resolved.breaks.reduce((total, breakPeriod) => {
    return total + Math.max(0, timeToMinutes(breakPeriod.endTime) - timeToMinutes(breakPeriod.startTime));
  }, 0);
  const assemblyMinutes = resolved.assembly?.duration ?? 0;
  const daySpanMinutes = Math.max(0, timeToMinutes(resolved.endTime) - timeToMinutes(resolved.startTime));
  const allocatedMinutes = teachingMinutes + breakMinutes + assemblyMinutes;
  const unallocatedMinutes = Math.max(0, daySpanMinutes - allocatedMinutes);
  const configuredTeachingMinutes = resolved.periodsPerDay * resolved.periodDuration;
  const overflowMinutes = Math.max(
    0,
    configuredTeachingMinutes + breakMinutes + assemblyMinutes - daySpanMinutes
  );

  return {
    firstPeriodStartTime: firstPeriod?.startTime ?? null,
    lastPeriodEndTime: lastPeriod?.endTime ?? null,
    scheduledPeriods: resolved.periodSlots.length,
    periodsShortfall: Math.max(0, resolved.periodsPerDay - resolved.periodSlots.length),
    teachingMinutes,
    breakMinutes,
    assemblyMinutes,
    daySpanMinutes,
    allocatedMinutes,
    unallocatedMinutes,
    overflowMinutes,
  };
}
