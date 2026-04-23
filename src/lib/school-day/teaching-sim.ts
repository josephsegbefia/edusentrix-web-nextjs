import type {
  DailyBreakItem,
  DailyBreakItemV2,
  PeriodLengthOverride,
} from "@/types/school-daily-schedule";
import { hhmmToMinutes, minutesToHhmm } from "./time";
import { validateBreaksInWindow } from "./period-legacy";

function mergeBreakIntervals(
  breaks: DailyBreakItem[]
): { start: number; end: number }[] {
  const m = breaks
    .map((b) => ({
      s: hhmmToMinutes(b.startTime),
      e: hhmmToMinutes(b.endTime),
    }))
    .filter((x) => x.s != null && x.e != null && x.e > (x.s as number)) as {
    s: number;
    e: number;
  }[];
  m.sort((a, b) => a.s - b.s);
  const out: { start: number; end: number }[] = [];
  for (const x of m) {
    const last = out[out.length - 1];
    if (last && x.s <= last.end) {
      last.end = Math.max(last.end, x.e);
    } else {
      out.push({ start: x.s, end: x.e });
    }
  }
  return out;
}

/** Free [start,end) minute ranges inside the teaching day after removing breaks. */
function teachingMinuteIntervals(
  lessonStart: string,
  dayEnd: string,
  breaks: DailyBreakItem[]
): { start: number; end: number }[] {
  const ls = hhmmToMinutes(lessonStart);
  const de = hhmmToMinutes(dayEnd);
  if (ls == null || de == null || de <= ls) return [];
  const merged = mergeBreakIntervals(breaks);
  const out: { start: number; end: number }[] = [];
  let cursor = ls;
  for (const br of merged) {
    if (br.end <= ls) continue;
    if (br.start >= de) break;
    const bStart = Math.max(br.start, ls);
    const bEnd = Math.min(br.end, de);
    if (bStart < bEnd) {
      if (cursor < bStart) {
        out.push({ start: cursor, end: bStart });
      }
      cursor = Math.max(cursor, bEnd);
    }
    if (cursor >= de) return out;
  }
  if (cursor < de) {
    out.push({ start: cursor, end: de });
  }
  return out;
}

export function periodLengthForIndex(
  index1: number,
  defaultLen: number,
  overrides: PeriodLengthOverride[]
): number {
  const o = overrides.find((x) => x.periodIndex === index1);
  return o?.minutes ?? defaultLen;
}

export function filterBreaksForGrade(
  breaks: DailyBreakItemV2[],
  gradeId: string | null
): DailyBreakItem[] {
  if (!gradeId) {
    return breaks.filter((b) => !b.appliesToGradeIds || b.appliesToGradeIds.length === 0);
  }
  return breaks.filter(
    (b) => !b.appliesToGradeIds?.length || b.appliesToGradeIds.includes(gradeId)
  );
}

export type SimulatedPeriod = {
  index: number;
  startTime: string;
  endTime: string;
};

/**
 * Packs full teaching periods (variable length) into free windows between breaks.
 */
export function simulateTeachingPeriods(
  lessonStart: string,
  dayEnd: string,
  defaultLen: number,
  overrides: PeriodLengthOverride[],
  breaks: DailyBreakItem[]
): { periods: SimulatedPeriod[]; warnings: string[]; teachingMinutes: number } {
  const v = validateBreaksInWindow(lessonStart, dayEnd, breaks);
  const warnings: string[] = [];
  if (!v.ok) {
    return { periods: [], warnings: [v.error], teachingMinutes: 0 };
  }
  const windows = teachingMinuteIntervals(lessonStart, dayEnd, breaks);
  const periods: SimulatedPeriod[] = [];
  let periodIndex = 1;
  for (const w of windows) {
    let t = w.start;
    while (t < w.end) {
      const len = periodLengthForIndex(periodIndex, defaultLen, overrides);
      if (len <= 0) {
        warnings.push(`Period ${periodIndex} has an invalid length.`);
        return { periods, warnings, teachingMinutes: 0 };
      }
      if (t + len > w.end) {
        const rem = w.end - t;
        warnings.push(
          `Not enough time after breaks for a full period ${periodIndex} (${len} min) in this block — only ${rem} min remain.`
        );
        t = w.end;
        continue;
      }
      const startH = minutesToHhmm(t);
      const endH = minutesToHhmm(t + len);
      periods.push({ index: periodIndex, startTime: startH, endTime: endH });
      t += len;
      periodIndex += 1;
    }
  }
  const teachingM = windows.reduce((s, w) => s + (w.end - w.start), 0);
  return { periods, warnings, teachingMinutes: teachingM };
}

export function countFullPeriodsFromSimulation(sim: { periods: SimulatedPeriod[] }): number {
  return sim.periods.length;
}
