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
  /** Effective breaks for this grade/day (from school settings + overrides). */
  breaks: IBreakPeriod[];
  assembly: ResolvedAssembly | null;
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

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
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
  const pendingBreaks = [...breaks]
    .map((b) => ({
      ...b,
      desiredStartMinutes: timeToMinutes(b.startTime),
      durationMinutes: Math.max(0, timeToMinutes(b.endTime) - timeToMinutes(b.startTime)),
    }))
    .filter((b) => Number.isFinite(b.desiredStartMinutes) && b.durationMinutes > 0)
    .sort((a, b) => a.desiredStartMinutes - b.desiredStartMinutes);

  let currentTime = startMinutes;
  let periodNum = 1;

  while (periodNum <= periodsPerDay) {
    if (currentTime >= maxEnd) break;

    while (
      pendingBreaks.length > 0 &&
      currentTime >= pendingBreaks[0].desiredStartMinutes
    ) {
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
    if (periodEnd > maxEnd) {
      break;
    }

    slots.push({
      periodNumber: periodNum,
      startTime: minutesToTime(currentTime),
      endTime: minutesToTime(periodEnd),
    });
    currentTime = periodEnd;
    periodNum++;
  }

  return { periodSlots: slots, effectiveBreaks };
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
  let periodSlots: IPeriodSlot[] | undefined =
    settings.periodSlots && settings.periodSlots.length > 0
      ? settings.periodSlots
      : undefined;

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

  let gradeHasExplicitSlots = false;

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
        gradeHasExplicitSlots = true;
      }
    }
  }

  const hasDailyScheduleOverride =
    dayOfWeek != null &&
    Boolean(
      settings.dailyScheduleOverrides?.some(
        (o) =>
          o.dayOfWeek === dayOfWeek &&
          (o.startTime != null || o.endTime != null)
      )
    );

  const usingSchoolWideSlotsOnly =
    Boolean(periodSlots?.length) &&
    !gradeHasExplicitSlots &&
    Boolean(settings.periodSlots?.length);

  /**
   * School-wide `periodSlots` is a single template; it ignores per-day start/end (e.g. Friday
   * early dismissal). For any resolved weekday, prefer regenerating from bell settings + breaks
   * unless this grade has explicit custom slots. Daily overrides always force regeneration.
   */
  if (dayOfWeek != null && periodSlots?.length) {
    if (hasDailyScheduleOverride || usingSchoolWideSlotsOnly) {
      periodSlots = undefined;
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

  // Use explicit periodSlots if available, otherwise generate (clamped to resolved endTime).
  // Auto-generated schedules keep every lesson at the configured duration and shift breaks to
  // the next period boundary instead of silently shortening periods.
  const generatedLayout =
    periodSlots && periodSlots.length > 0
      ? null
      : generateScheduleLayout(
          effectiveStartForPeriods,
          periodDuration,
          periodsPerDay,
          resolvedBreaks,
          { maxEndTime: endTime }
        );
  const finalSlots =
    periodSlots && periodSlots.length > 0
      ? periodSlots
      : generatedLayout?.periodSlots ?? [];
  const finalBreaks =
    periodSlots && periodSlots.length > 0
      ? resolvedBreaks
      : generatedLayout?.effectiveBreaks ?? [];

  return {
    startTime,
    endTime,
    periodsPerDay,
    periodDuration,
    periodSlots: finalSlots,
    breaks: finalBreaks,
    assembly,
  };
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
    return (
      total +
      Math.max(
        0,
        timeToMinutes(breakPeriod.endTime) - timeToMinutes(breakPeriod.startTime)
      )
    );
  }, 0);
  const assemblyMinutes = resolved.assembly?.duration ?? 0;
  const daySpanMinutes = Math.max(
    0,
    timeToMinutes(resolved.endTime) - timeToMinutes(resolved.startTime)
  );
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
