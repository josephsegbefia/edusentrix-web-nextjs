import type {
  DailyBreakItem,
  DailyBreakItemV2,
  SchoolDailyScheduleConfigV2,
  WeekdayKey,
} from "@/types/school-daily-schedule";
import { ensureConfigV2 } from "./migrate-v2";
import { filterBreaksForGrade, simulateTeachingPeriods } from "./teaching-sim";
import {
  estimatePeriodsPerDay,
  type PeriodEstimate,
  validateBreaksInWindow,
} from "./period-legacy";
import { hhmmToMinutes, minutesToHhmm } from "./time";

export type { PeriodEstimate };
export { estimatePeriodsPerDay, validateBreaksInWindow } from "./period-legacy";

/**
 * Merged “day” for a given weekday and grade (timetable + break scoping + overrides).
 */
export function resolveDayProfileV2(
  config: SchoolDailyScheduleConfigV2,
  weekday: WeekdayKey,
  gradeId: string | null
): {
  dayGateStart: string;
  lessonStart: string;
  dayEnd: string;
  periodLengthMinutes: number;
  periodLengthOverrides: SchoolDailyScheduleConfigV2["periodLengthOverrides"];
  openingBlocks: SchoolDailyScheduleConfigV2["openingBlocks"];
  breaks: DailyBreakItemV2[];
} {
  let dayGate = config.dayGateStart;
  let lessonStart = config.lessonStart;
  let dayEnd = config.dayEnd;
  let period = config.periodLengthMinutes;
  let periodOv = config.periodLengthOverrides ?? [];
  let openings = config.openingBlocks ?? [];
  let brks: DailyBreakItemV2[] = config.breaks;

  if (!config.allWeekdaysSame) {
    const ex = config.weekdayExceptions.find((w) => w.weekday === weekday);
    if (ex) {
      dayGate = ex.dayGateStart ?? ex.lessonStart;
      lessonStart = ex.lessonStart;
      dayEnd = ex.dayEnd;
      period = ex.periodLengthMinutes;
      periodOv = ex.periodLengthOverrides ?? periodOv;
      openings = ex.openingBlocks ?? openings;
      brks = ex.breaks;
    }
  }

  if (config.hasGradeOverrides && gradeId) {
    const g = config.gradeOverrides.find((o) => {
      const lo = o as { gradeIds?: string[]; gradeId?: string };
      if (lo.gradeIds?.length) {
        return lo.gradeIds.includes(gradeId);
      }
      return Boolean(lo.gradeId && lo.gradeId === gradeId);
    });
    if (g) {
      if (g.dayGateStart) dayGate = g.dayGateStart;
      if (g.lessonStart) lessonStart = g.lessonStart;
      if (g.dayEnd) dayEnd = g.dayEnd;
      if (g.periodLengthMinutes != null) period = g.periodLengthMinutes;
      if (g.periodLengthOverrides != null) periodOv = g.periodLengthOverrides;
      if (g.openingBlocks && g.openingBlocks.length) openings = g.openingBlocks;
      if (g.breaks && g.breaks.length) brks = g.breaks;
    }
  }

  return {
    dayGateStart: dayGate,
    lessonStart,
    dayEnd,
    periodLengthMinutes: period,
    periodLengthOverrides: periodOv,
    openingBlocks: openings,
    breaks: brks,
  };
}

/**
 * @deprecated use resolveDayProfileV2 + ensureConfigV2; accepts unknown config shape
 */
export function resolveDayProfile(
  config: unknown,
  weekday: WeekdayKey,
  gradeId: string | null
) {
  const v2 = ensureConfigV2(config);
  return resolveDayProfileV2(v2, weekday, gradeId);
}

/**
 * Accurate when period overrides / staggered breaks exist; otherwise matches legacy.
 */
export function effectivePeriodsFor(
  config: unknown,
  weekday: WeekdayKey,
  gradeId: string | null
): PeriodEstimate {
  const v2 = ensureConfigV2(config);
  const p = resolveDayProfileV2(v2, weekday, gradeId);
  const br = filterBreaksForGrade(p.breaks, gradeId) as DailyBreakItem[];
  const hasAdvanced =
    (p.periodLengthOverrides?.length ?? 0) > 0 ||
    p.breaks.some((b) => b.appliesToGradeIds && b.appliesToGradeIds.length > 0);
  if (!hasAdvanced) {
    return estimatePeriodsPerDay(
      p.lessonStart,
      p.dayEnd,
      p.periodLengthMinutes,
      br
    );
  }
  const sim = simulateTeachingPeriods(
    p.lessonStart,
    p.dayEnd,
    p.periodLengthMinutes,
    p.periodLengthOverrides ?? [],
    br
  );
  const ds = hhmmToMinutes(p.lessonStart) ?? 0;
  const de = hhmmToMinutes(p.dayEnd) ?? 0;
  const schoolLen = de - ds;
  let breakTotal = 0;
  for (const b of br) {
    const s = hhmmToMinutes(b.startTime);
    const e = hhmmToMinutes(b.endTime);
    if (s != null && e != null && e > s) breakTotal += e - s;
  }
  return {
    schoolDayLengthMinutes: schoolLen,
    breakMinutesTotal: breakTotal,
    teachingMinutes: sim.teachingMinutes,
    fullPeriods: sim.periods.length,
    remainderTeachingMinutes: 0,
    hasPartialRemainder: sim.warnings.length > 0,
    warnings: sim.warnings,
  };
}

export { hhmmToMinutes, minutesToHhmm };
