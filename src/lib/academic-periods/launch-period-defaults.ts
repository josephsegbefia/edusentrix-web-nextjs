import { addDays } from "date-fns/addDays";
import { format } from "date-fns/format";
import { parse as parseDateFns } from "date-fns/parse";

export type LaunchPeriodDraft = {
  yearLabel: string;
  term: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
  isYearEndTerminal?: boolean;
};

function dayAtNoon(iso: string): Date {
  const d = parseDateFns(iso, "yyyy-MM-dd", new Date());
  d.setHours(12, 0, 0, 0);
  return d;
}

function isoAddDays(iso: string, days: number): string {
  return format(addDays(dayAtNoon(iso), days), "yyyy-MM-dd");
}

export function defaultAcademicYear(today = new Date()): string {
  const year = today.getFullYear();
  const startsNewYear = today.getMonth() >= 7;
  const start = startsNewYear ? year : year - 1;
  return `${start}/${start + 1}`;
}

export function advanceAcademicYear(label: string): string {
  const slashMatch = label.match(/(\d{4})\s*\/\s*(\d{4})/);
  if (slashMatch) {
    const start = Number(slashMatch[1]) + 1;
    const end = Number(slashMatch[2]) + 1;
    return `${start}/${end}`;
  }
  const dashMatch = label.match(/(\d{4})\s*-\s*(\d{4})/);
  if (dashMatch) {
    const start = Number(dashMatch[1]) + 1;
    const end = Number(dashMatch[2]) + 1;
    return `${start}-${end}`;
  }
  const singleYear = label.match(/\b(\d{4})\b/);
  if (singleYear) return String(Number(singleYear[1]) + 1);
  return defaultAcademicYear();
}

export function inferTermNumber(term?: string | null): number | null {
  if (!term) return null;
  const lower = term.toLowerCase();
  const digit = lower.match(/\b([1-3])\b/);
  if (digit) return Number(digit[1]);
  if (/\bfirst\b|\b1st\b/.test(lower)) return 1;
  if (/\bsecond\b|\b2nd\b/.test(lower)) return 2;
  if (/\bthird\b|\b3rd\b/.test(lower)) return 3;
  return null;
}

export function isYearEndTermLabel(term: string): boolean {
  const termNo = inferTermNumber(term);
  if (termNo === 3) return true;
  return /term\s*3|third/i.test(term);
}

/** Per row only: end must be strictly after start (ISO yyyy-MM-dd compare). */
export function fixStrictEndAfterStartForAll(out: LaunchPeriodDraft[]): void {
  for (let i = 0; i < out.length; i++) {
    if (!out[i].startDate || !out[i].endDate) continue;
    const { startDate: start, endDate: end } = out[i];
    if (end <= start) {
      out[i].endDate = isoAddDays(start, 1);
    }
  }
}

/**
 * Full timeline reconcile: non-overlapping sequential terms.
 * Each term starts the day after the previous term ends.
 */
export function normalizeAcademicPeriodsInOrder(
  periods: LaunchPeriodDraft[]
): LaunchPeriodDraft[] {
  if (periods.length === 0) return periods;
  const out = periods.map((p) => ({ ...p }));

  for (let i = 0; i < out.length; i++) {
    if (!out[i].startDate || !out[i].endDate) continue;

    if (i > 0 && out[i - 1].endDate) {
      const prevEnd = out[i - 1].endDate;
      if (out[i].startDate <= prevEnd) {
        out[i].startDate = isoAddDays(prevEnd, 1);
      }
    }
  }

  fixStrictEndAfterStartForAll(out);
  return out;
}

/**
 * When a period is marked year-end, later periods belong to the next academic year.
 */
export function reconcileLaunchPeriodYearLabels(
  periods: LaunchPeriodDraft[]
): LaunchPeriodDraft[] {
  if (periods.length === 0) return periods;
  const out = periods.map((p) => ({ ...p }));
  let currentYear =
    out[0].yearLabel?.trim() || defaultAcademicYear(dayAtNoon(out[0].startDate));

  out[0].yearLabel = currentYear;

  for (let i = 1; i < out.length; i++) {
    if (out[i - 1].isYearEndTerminal) {
      currentYear = advanceAcademicYear(currentYear);
    }
    out[i].yearLabel = currentYear;
  }

  return out;
}

/** Default periods with academic year labels and ~3-month sequential dates. */
export function buildLaunchPeriodDefaults(termLabels: string[]): LaunchPeriodDraft[] {
  const labels = termLabels.length > 0 ? termLabels : ["Term 1"];
  const periods: LaunchPeriodDraft[] = [];
  let prevEndIso: string | null = null;
  let currentYearLabel = defaultAcademicYear();

  for (let index = 0; index < labels.length; index++) {
    const term = labels[index];

    if (index > 0 && periods[index - 1]?.isYearEndTerminal) {
      currentYearLabel = advanceAcademicYear(currentYearLabel);
    }

    let start: Date;
    let end: Date;
    if (index === 0) {
      start = new Date();
      end = new Date(start);
      end.setMonth(end.getMonth() + 3);
    } else if (prevEndIso) {
      start = addDays(dayAtNoon(prevEndIso), 1);
      end = new Date(start);
      end.setMonth(end.getMonth() + 3);
    } else {
      start = new Date();
      end = new Date(start);
      end.setMonth(end.getMonth() + 3);
    }

    const period: LaunchPeriodDraft = {
      yearLabel: currentYearLabel,
      term,
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
      isCurrent: index === 0,
      isYearEndTerminal: isYearEndTermLabel(term),
    };
    periods.push(period);
    prevEndIso = period.endDate;
  }

  return normalizeAcademicPeriodsInOrder(periods);
}

export function mergeLaunchPeriodsForTerms(
  termLabels: string[],
  existingPeriods: LaunchPeriodDraft[] = []
): LaunchPeriodDraft[] {
  const labels = termLabels.length > 0 ? termLabels : ["Term 1"];
  const fallbackSequential = buildLaunchPeriodDefaults(labels);
  const existingCurrentIndex = existingPeriods.findIndex((period) => period.isCurrent);
  const safeCurrentIndex = existingCurrentIndex >= 0 ? existingCurrentIndex : 0;

  const merged = labels.map((label, index) => {
    const fallback = fallbackSequential[index];
    const existing =
      existingPeriods[index] ||
      existingPeriods.find((period) => period.term === label);

    return {
      yearLabel: existing?.yearLabel?.trim()
        ? existing.yearLabel
        : fallback.yearLabel,
      term: existing?.term || label,
      startDate: existing?.startDate || fallback.startDate,
      endDate: existing?.endDate || fallback.endDate,
      isCurrent: index === Math.min(safeCurrentIndex, labels.length - 1),
      isYearEndTerminal:
        existing?.isYearEndTerminal ??
        fallback.isYearEndTerminal ??
        isYearEndTermLabel(label),
    };
  });

  return normalizeAcademicPeriodsInOrder(
    reconcileLaunchPeriodYearLabels(merged)
  );
}
