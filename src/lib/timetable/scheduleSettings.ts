/**
 * Schedule settings resolution for timetable creation.
 * Resolves per-day and per-grade overrides to effective startTime, endTime, periodsPerDay, periodDuration, periodSlots.
 */

import type { IPeriodSlot, IBreakPeriod } from "@/models/SchoolSettings";

export type ResolvedScheduleSettings = {
  startTime: string;
  endTime: string;
  periodsPerDay: number;
  periodDuration: number;
  periodSlots: IPeriodSlot[];
  assembly: ResolvedAssembly | null;
};

/** Settings input - supports both API DTO (string ids) and model (ObjectId) */
export type ScheduleSettingsInput = {
  schoolStartTime: string;
  schoolEndTime: string;
  periodDuration: number;
  periodsPerDay: number;
  periodSlots?: IPeriodSlot[];
  breaks?: IBreakPeriod[];
  assembly?: { days: number[]; startTime: string; duration: number };
  assemblyDailyOverrides?: Array<{
    dayOfWeek: number;
    startTime?: string;
    duration?: number;
  }>;
  assemblyGradeOverrides?: Array<{
    gradeId: string | { toString(): string };
    startTime?: string;
    duration?: number;
  }>;
  dailyScheduleOverrides?: Array<{
    dayOfWeek: number;
    startTime?: string;
    endTime?: string;
  }>;
  gradeScheduleOverrides?: Array<{
    gradeId: string | { toString(): string };
    periodsPerDay?: number;
    periodDuration?: number;
    periodSlots?: IPeriodSlot[];
  }>;
  breakDailyOverrides?: Array<{
    dayOfWeek: number;
    breakName: string;
    startTime?: string;
    endTime?: string;
  }>;
  breakGradeOverrides?: Array<{
    gradeId: string | { toString(): string };
    breakName: string;
    startTime?: string;
    endTime?: string;
  }>;
};

export type ResolvedAssembly = {
  startTime: string;
  duration: number;
};

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function minutesToTime(minutes: number): string {
  const total = Math.max(0, Math.floor(minutes));
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function generatePeriodSlots(
  startTime: string,
  periodDuration: number,
  periodsPerDay: number,
  breaks: IBreakPeriod[] = []
): IPeriodSlot[] {
  const slots: IPeriodSlot[] = [];
  const startMinutes = timeToMinutes(startTime);
  const sortedBreaks = [...breaks].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  let currentTime = startMinutes;
  let periodNum = 1;

  while (periodNum <= periodsPerDay) {
    const breakPeriod = sortedBreaks.find(
      (b) =>
        timeToMinutes(b.startTime) <= currentTime &&
        currentTime < timeToMinutes(b.endTime)
    );

    if (breakPeriod) {
      currentTime = timeToMinutes(breakPeriod.endTime);
      continue;
    }

    const nextBreak = sortedBreaks.find(
      (b) =>
        currentTime < timeToMinutes(b.startTime) &&
        currentTime + periodDuration > timeToMinutes(b.startTime)
    );

    if (nextBreak) {
      const periodEnd = timeToMinutes(nextBreak.startTime);
      if (periodEnd - currentTime >= 15) {
        slots.push({
          periodNumber: periodNum,
          startTime: minutesToTime(currentTime),
          endTime: minutesToTime(periodEnd),
        });
        periodNum++;
      }
      currentTime = timeToMinutes(nextBreak.endTime);
    } else {
      slots.push({
        periodNumber: periodNum,
        startTime: minutesToTime(currentTime),
        endTime: minutesToTime(currentTime + periodDuration),
      });
      currentTime += periodDuration;
      periodNum++;
    }
  }

  return slots;
}

/**
 * Resolve effective break periods for a given grade and day.
 * Applies per-day and per-grade overrides to base breaks (matched by breakName).
 */
export function getResolvedBreaks(
  settings: ScheduleSettingsInput,
  gradeId?: string | { toString(): string } | null,
  dayOfWeek?: number | null
): IBreakPeriod[] {
  const baseBreaks = settings.breaks || [];
  if (!baseBreaks.length) return [];

  const gradeIdStr =
    gradeId != null
      ? typeof gradeId === "string"
        ? gradeId
        : gradeId.toString()
      : null;

  return baseBreaks.map((b) => {
    let startTime = b.startTime;
    let endTime = b.endTime;

    // Apply per-day override (must match day and break name)
    if (dayOfWeek != null && settings.breakDailyOverrides?.length) {
      const dayOverride = settings.breakDailyOverrides.find(
        (o) => o.dayOfWeek === dayOfWeek && o.breakName === b.name
      );
      if (dayOverride) {
        if (dayOverride.startTime != null) startTime = dayOverride.startTime;
        if (dayOverride.endTime != null) endTime = dayOverride.endTime;
      }
    }

    // Apply per-grade override (must match grade and break name)
    if (gradeIdStr && settings.breakGradeOverrides?.length) {
      const gradeOverride = settings.breakGradeOverrides.find((o) => {
        const oId =
          typeof o.gradeId === "string" ? o.gradeId : o.gradeId.toString();
        return oId === gradeIdStr && o.breakName === b.name;
      });
      if (gradeOverride) {
        if (gradeOverride.startTime != null) startTime = gradeOverride.startTime;
        if (gradeOverride.endTime != null) endTime = gradeOverride.endTime;
      }
    }

    return { ...b, startTime, endTime };
  });
}

/**
 * Resolve effective assembly settings for a given grade and day.
 * Returns null if assembly does not occur on that day.
 *
 * @param settings - School settings (from API or model)
 * @param gradeId - Optional grade ID for per-grade overrides
 * @param dayOfWeek - Day of week (0-6) - must be in assembly.days for assembly to apply
 */
export function getResolvedAssembly(
  settings: ScheduleSettingsInput,
  gradeId?: string | { toString(): string } | null,
  dayOfWeek?: number | null
): ResolvedAssembly | null {
  const base = settings.assembly;
  if (!base || !base.days?.length || dayOfWeek == null || !base.days.includes(dayOfWeek)) {
    return null;
  }

  let startTime = base.startTime || "07:30";
  let duration = base.duration ?? 30;

  // Apply per-day override
  if (settings.assemblyDailyOverrides?.length) {
    const dayOverride = settings.assemblyDailyOverrides.find(
      (o) => o.dayOfWeek === dayOfWeek
    );
    if (dayOverride) {
      if (dayOverride.startTime != null) startTime = dayOverride.startTime;
      if (dayOverride.duration != null) duration = dayOverride.duration;
    }
  }

  // Apply per-grade override
  if (gradeId != null && settings.assemblyGradeOverrides?.length) {
    const gradeIdStr =
      typeof gradeId === "string" ? gradeId : gradeId.toString();
    const gradeOverride = settings.assemblyGradeOverrides.find((o) => {
      const oId =
        typeof o.gradeId === "string" ? o.gradeId : o.gradeId.toString();
      return oId === gradeIdStr;
    });
    if (gradeOverride) {
      if (gradeOverride.startTime != null) startTime = gradeOverride.startTime;
      if (gradeOverride.duration != null) duration = gradeOverride.duration;
    }
  }

  return { startTime, duration };
}

/**
 * Resolve effective schedule settings for a given grade and day.
 * Falls back to school-wide defaults when no overrides apply.
 *
 * @param settings - School settings (from API or model)
 * @param gradeId - Optional grade ID (string or ObjectId) for per-grade overrides
 * @param dayOfWeek - Optional day of week (0-6) for per-day overrides
 */
export function getResolvedScheduleSettings(
  settings: ScheduleSettingsInput,
  gradeId?: string | { toString(): string } | null,
  dayOfWeek?: number | null
): ResolvedScheduleSettings {
  const defaults = {
    startTime: settings.schoolStartTime || "07:30",
    endTime: settings.schoolEndTime || "15:00",
    periodsPerDay: settings.periodsPerDay ?? 8,
    periodDuration: settings.periodDuration ?? 40,
  };

  let startTime = defaults.startTime;
  let endTime = defaults.endTime;
  let periodsPerDay = defaults.periodsPerDay;
  let periodDuration = defaults.periodDuration;
  let periodSlots: IPeriodSlot[] | undefined = settings.periodSlots;

  // Apply per-day overrides
  if (dayOfWeek != null && settings.dailyScheduleOverrides?.length) {
    const dayOverride = settings.dailyScheduleOverrides.find(
      (o) => o.dayOfWeek === dayOfWeek
    );
    if (dayOverride) {
      if (dayOverride.startTime != null) startTime = dayOverride.startTime;
      if (dayOverride.endTime != null) endTime = dayOverride.endTime;
    }
  }

  // Apply per-grade overrides
  if (gradeId != null && settings.gradeScheduleOverrides?.length) {
    const gradeIdStr =
      typeof gradeId === "string" ? gradeId : gradeId.toString();
    const gradeOverride = settings.gradeScheduleOverrides.find((o) => {
      const oId =
        typeof o.gradeId === "string" ? o.gradeId : o.gradeId.toString();
      return oId === gradeIdStr;
    });
    if (gradeOverride) {
      if (gradeOverride.periodsPerDay != null)
        periodsPerDay = gradeOverride.periodsPerDay;
      if (gradeOverride.periodDuration != null)
        periodDuration = gradeOverride.periodDuration;
      if (
        gradeOverride.periodSlots != null &&
        Array.isArray(gradeOverride.periodSlots) &&
        gradeOverride.periodSlots.length > 0
      ) {
        periodSlots = gradeOverride.periodSlots;
      }
    }
  }

  // Resolve assembly for this day/grade (affects period generation when at start)
  const assembly = getResolvedAssembly(
    settings,
    gradeId,
    dayOfWeek ?? undefined
  );

  // When assembly is at day start, first period begins after assembly
  let effectiveStartForPeriods = startTime;
  if (assembly && assembly.startTime === startTime) {
    const startMins = timeToMinutes(startTime);
    const endMins = startMins + assembly.duration;
    effectiveStartForPeriods = minutesToTime(endMins);
  }

  // Resolve breaks for this day/grade (with per-day and per-grade overrides)
  const resolvedBreaks = getResolvedBreaks(
    settings,
    gradeId,
    dayOfWeek ?? undefined
  );

  // Use explicit periodSlots if available, otherwise generate
  const finalSlots =
    periodSlots && periodSlots.length > 0
      ? periodSlots
      : generatePeriodSlots(
          effectiveStartForPeriods,
          periodDuration,
          periodsPerDay,
          resolvedBreaks
        );

  return {
    startTime,
    endTime,
    periodsPerDay,
    periodDuration,
    periodSlots: finalSlots,
    assembly,
  };
}
