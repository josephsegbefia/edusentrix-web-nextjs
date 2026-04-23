import type { DailyBreakItem } from "@/types/school-daily-schedule";
import { hhmmToMinutes } from "./time";

export type PeriodEstimate = {
  schoolDayLengthMinutes: number;
  breakMinutesTotal: number;
  teachingMinutes: number;
  fullPeriods: number;
  remainderTeachingMinutes: number;
  hasPartialRemainder: boolean;
  warnings: string[];
};

function breakDurationMinutes(b: DailyBreakItem): number | null {
  const s = hhmmToMinutes(b.startTime);
  const e = hhmmToMinutes(b.endTime);
  if (s == null || e == null || e <= s) return null;
  return e - s;
}

export function validateBreaksInWindow(
  dayStart: string,
  dayEnd: string,
  breaks: DailyBreakItem[]
): { ok: true } | { ok: false; error: string } {
  const ds = hhmmToMinutes(dayStart);
  const de = hhmmToMinutes(dayEnd);
  if (ds == null || de == null || de <= ds) {
    return { ok: false, error: "School day start must be before end time." };
  }
  const sorted = [...breaks].sort(
    (a, b) => (hhmmToMinutes(a.startTime) ?? 0) - (hhmmToMinutes(b.startTime) ?? 0)
  );
  let prevEnd = -1;
  for (const br of sorted) {
    const bs = hhmmToMinutes(br.startTime);
    const be = hhmmToMinutes(br.endTime);
    if (bs == null || be == null || be <= bs) {
      return { ok: false, error: `Invalid times for break "${br.name}".` };
    }
    if (bs < (ds as number) || be > (de as number)) {
      return {
        ok: false,
        error: `Break "${br.name}" must fall entirely between school start and end.`,
      };
    }
    if (bs < prevEnd) {
      return { ok: false, error: "Breaks cannot overlap each other." };
    }
    prevEnd = be;
  }
  return { ok: true };
}

export function estimatePeriodsPerDay(
  dayStart: string,
  dayEnd: string,
  periodLengthMinutes: number,
  breaks: DailyBreakItem[]
): PeriodEstimate {
  const warnings: string[] = [];
  const ds = hhmmToMinutes(dayStart);
  const de = hhmmToMinutes(dayEnd);
  if (ds == null || de == null || de <= ds) {
    return {
      schoolDayLengthMinutes: 0,
      breakMinutesTotal: 0,
      teachingMinutes: 0,
      fullPeriods: 0,
      remainderTeachingMinutes: 0,
      hasPartialRemainder: false,
      warnings: ["Invalid school day start or end."],
    };
  }
  if (periodLengthMinutes < 15 || periodLengthMinutes > 120) {
    warnings.push("Period length is unusual; most schools use 30–60 minutes.");
  }

  const schoolLen = de - ds;
  let breakTotal = 0;
  for (const b of breaks) {
    const d = breakDurationMinutes(b);
    if (d == null) {
      warnings.push(`Break "${b.name}" has invalid start/end.`);
      continue;
    }
    breakTotal += d;
  }
  const teaching = Math.max(0, schoolLen - breakTotal);
  if (periodLengthMinutes <= 0) {
    return {
      schoolDayLengthMinutes: schoolLen,
      breakMinutesTotal: breakTotal,
      teachingMinutes: teaching,
      fullPeriods: 0,
      remainderTeachingMinutes: teaching,
      hasPartialRemainder: false,
      warnings: ["Period length must be positive."],
    };
  }
  const full = Math.floor(teaching / periodLengthMinutes);
  const rem = teaching % periodLengthMinutes;
  if (rem > 0) {
    warnings.push(
      `After breaks, ${rem} teaching minute(s) do not make another full period of ${periodLengthMinutes} minutes.`
    );
  }
  return {
    schoolDayLengthMinutes: schoolLen,
    breakMinutesTotal: breakTotal,
    teachingMinutes: teaching,
    fullPeriods: full,
    remainderTeachingMinutes: rem,
    hasPartialRemainder: rem > 0,
    warnings,
  };
}
