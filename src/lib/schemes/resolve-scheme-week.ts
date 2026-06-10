import {
  addDaysUtc,
  dateOnlyUtc,
  formatDateYmdUtc,
  formatWeekRangeLabel,
  getWeekStartMondayUtc,
} from "@/lib/lessons/week-dates";
import { getGhanaTodayDate, parseGhanaDateLabel } from "@/lib/time/ghana";

export type AcademicPeriodWeekInput = {
  startDate: Date;
  endDate: Date;
};

export type SchemeItemWeekInput = {
  weekNumber?: number | null;
  plannedStartDate?: Date | null;
  plannedEndDate?: Date | null;
  weekEndingLabel?: string | null;
};

export type SchoolSchemeWeekSnapshot = {
  weekNumber: number | null;
  totalWeeks: number | null;
  weekStartDate: string | null;
  weekEndDate: string | null;
  label: string | null;
  rangeLabel: string | null;
  academicPeriodId: string | null;
  academicPeriodLabel: string | null;
  isWithinTerm: boolean;
  status: "active" | "before_term" | "after_term" | "no_period";
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function diffDaysUtc(left: Date, right: Date) {
  const a = dateOnlyUtc(left).getTime();
  const b = dateOnlyUtc(right).getTime();
  return Math.floor((a - b) / MS_PER_DAY);
}

export function countSchemeWeeksInPeriod(period: AcademicPeriodWeekInput): number {
  const periodStart = getWeekStartMondayUtc(period.startDate);
  const periodEnd = dateOnlyUtc(period.endDate);
  const spanDays = diffDaysUtc(periodEnd, periodStart) + 1;
  if (spanDays <= 0) return 0;
  return Math.ceil(spanDays / 7);
}

export function resolveSchemeWeekCalendarRange(
  period: AcademicPeriodWeekInput,
  weekNumber: number
): { weekStart: Date; weekEnd: Date } {
  const periodStart = getWeekStartMondayUtc(period.startDate);
  const periodEnd = dateOnlyUtc(period.endDate);
  const totalWeeks = countSchemeWeeksInPeriod(period);
  const clampedWeek = Math.min(Math.max(1, Math.round(weekNumber)), Math.max(totalWeeks, 1));

  const weekStart = addDaysUtc(periodStart, (clampedWeek - 1) * 7);
  let weekEnd = addDaysUtc(weekStart, 6);
  if (weekEnd > periodEnd) weekEnd = periodEnd;
  if (weekEnd < weekStart) weekEnd = weekStart;

  return { weekStart, weekEnd };
}

export function resolveCurrentSchoolSchemeWeek(input: {
  period: AcademicPeriodWeekInput | null;
  today?: Date;
  academicPeriodId?: string | null;
  academicPeriodLabel?: string | null;
}): SchoolSchemeWeekSnapshot {
  const base = {
    weekNumber: null,
    totalWeeks: null,
    weekStartDate: null,
    weekEndDate: null,
    label: null,
    rangeLabel: null,
    academicPeriodId: input.academicPeriodId ?? null,
    academicPeriodLabel: input.academicPeriodLabel ?? null,
    isWithinTerm: false,
    status: "no_period" as const,
  };

  if (!input.period) return base;

  const today = dateOnlyUtc(input.today ?? getGhanaTodayDate());
  const periodStart = getWeekStartMondayUtc(input.period.startDate);
  const periodEnd = dateOnlyUtc(input.period.endDate);
  const totalWeeks = countSchemeWeeksInPeriod(input.period);

  if (today < periodStart) {
    return {
      ...base,
      totalWeeks,
      status: "before_term",
      label: "Before term starts",
    };
  }

  if (today > periodEnd) {
    return {
      ...base,
      totalWeeks,
      status: "after_term",
      label: "Term ended",
    };
  }

  const weekNumber = Math.min(
    Math.max(1, Math.floor(diffDaysUtc(today, periodStart) / 7) + 1),
    Math.max(totalWeeks, 1)
  );
  const { weekStart, weekEnd } = resolveSchemeWeekCalendarRange(input.period, weekNumber);
  const weekStartDate = formatDateYmdUtc(weekStart);
  const weekEndDate = formatDateYmdUtc(weekEnd);

  return {
    weekNumber,
    totalWeeks,
    weekStartDate,
    weekEndDate,
    label: `Term Week ${weekNumber}`,
    rangeLabel: formatWeekRangeLabel(weekStartDate, weekEndDate),
    academicPeriodId: input.academicPeriodId ?? null,
    academicPeriodLabel: input.academicPeriodLabel ?? null,
    isWithinTerm: true,
    status: "active",
  };
}

export function resolveSchemeItemCalendarRange(
  item: SchemeItemWeekInput,
  period: AcademicPeriodWeekInput | null
): { weekStart: Date; weekEnd: Date; weekNumber: number | null } | null {
  const explicitStart = item.plannedStartDate ? dateOnlyUtc(item.plannedStartDate) : null;
  const explicitEnd =
    (item.plannedEndDate ? dateOnlyUtc(item.plannedEndDate) : null) ||
    (item.weekEndingLabel ? parseGhanaDateLabel(item.weekEndingLabel) : null);

  let weekStart = explicitStart;
  let weekEnd = explicitEnd ? dateOnlyUtc(explicitEnd) : null;

  if (!weekStart && weekEnd) {
    weekStart = getWeekStartMondayUtc(weekEnd);
  }
  if (weekStart && !weekEnd) {
    weekEnd = addDaysUtc(weekStart, 6);
  }

  const weekNumber =
    typeof item.weekNumber === "number" && Number.isFinite(item.weekNumber)
      ? item.weekNumber
      : null;

  if ((!weekStart || !weekEnd) && weekNumber && period) {
    const derived = resolveSchemeWeekCalendarRange(period, weekNumber);
    weekStart = weekStart ?? derived.weekStart;
    weekEnd = weekEnd ?? derived.weekEnd;
  }

  if (!weekStart || !weekEnd || weekEnd < weekStart) return null;

  if (period) {
    const periodEnd = dateOnlyUtc(period.endDate);
    if (weekEnd > periodEnd) weekEnd = periodEnd;
  }

  return { weekStart, weekEnd, weekNumber };
}

export function schemeItemOverlapsCalendarWeek(
  item: SchemeItemWeekInput,
  period: AcademicPeriodWeekInput | null,
  weekStart: Date,
  weekEnd: Date
): boolean {
  const range = resolveSchemeItemCalendarRange(item, period);
  if (!range) {
    if (
      period &&
      typeof item.weekNumber === "number" &&
      Number.isFinite(item.weekNumber)
    ) {
      const current = resolveCurrentSchoolSchemeWeek({ period, today: weekStart });
      return current.weekNumber === item.weekNumber;
    }
    return false;
  }

  const start = dateOnlyUtc(weekStart).getTime();
  const end = dateOnlyUtc(weekEnd).getTime();
  return range.weekStart.getTime() <= end && range.weekEnd.getTime() >= start;
}

export function computePlannedDatesForSchemeWeek(
  period: AcademicPeriodWeekInput,
  weekNumber: number,
  weekEndingLabel?: string | null
): { plannedStartDate: Date; plannedEndDate: Date } {
  const parsedEnding = weekEndingLabel ? parseGhanaDateLabel(weekEndingLabel) : null;
  if (parsedEnding) {
    const plannedEndDate = dateOnlyUtc(parsedEnding);
    const plannedStartDate = getWeekStartMondayUtc(plannedEndDate);
    return { plannedStartDate, plannedEndDate };
  }

  const { weekStart, weekEnd } = resolveSchemeWeekCalendarRange(period, weekNumber);
  return { plannedStartDate: weekStart, plannedEndDate: weekEnd };
}

export function formatSchemeWeekLabel(weekNumber: number | null | undefined): string | null {
  if (typeof weekNumber !== "number" || !Number.isFinite(weekNumber)) return null;
  return `Term Week ${weekNumber}`;
}

export function mergeSchemeItemsWeekContext(
  items: SchemeItemWeekInput[],
  period: AcademicPeriodWeekInput | null
): { weekStart: Date; weekEnd: Date; weekLabel: string } | null {
  if (!items.length) return null;

  const ranges = items
    .map((item) => resolveSchemeItemCalendarRange(item, period))
    .filter((range): range is NonNullable<typeof range> => Boolean(range));

  const weekNumbers = Array.from(
    new Set(
      items
        .map((item) => item.weekNumber)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    )
  ).sort((a, b) => a - b);

  let weekStart = ranges.reduce<Date | null>((min, range) => {
    return !min || range.weekStart < min ? range.weekStart : min;
  }, null);
  let weekEnd = ranges.reduce<Date | null>((max, range) => {
    return !max || range.weekEnd > max ? range.weekEnd : max;
  }, null);

  if ((!weekStart || !weekEnd) && weekNumbers.length && period) {
    const firstWeek = weekNumbers[0]!;
    const lastWeek = weekNumbers[weekNumbers.length - 1]!;
    const firstRange = resolveSchemeWeekCalendarRange(period, firstWeek);
    const lastRange = resolveSchemeWeekCalendarRange(period, lastWeek);
    weekStart = weekStart ?? firstRange.weekStart;
    weekEnd = weekEnd ?? lastRange.weekEnd;
  }

  if (!weekStart && weekEnd) weekStart = getWeekStartMondayUtc(weekEnd);
  if (weekStart && !weekEnd) weekEnd = addDaysUtc(weekStart, 6);
  if (!weekStart || !weekEnd || weekEnd < weekStart) return null;

  const weekLabel =
    weekNumbers.length === 1
      ? `Term Week ${weekNumbers[0]}`
      : weekNumbers.length > 1
        ? `Term Weeks ${weekNumbers[0]}-${weekNumbers[weekNumbers.length - 1]}`
        : "Term Week";

  return { weekStart, weekEnd, weekLabel };
}
