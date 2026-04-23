import type { IBreakPeriod, IPeriodSlot } from "@/models/SchoolSettings";
import { ensureConfigV2 } from "@/lib/school-day/migrate-v2";
import { resolveDayProfileV2 } from "@/lib/school-day/periods";
import { filterBreaksForGrade, simulateTeachingPeriods } from "@/lib/school-day/teaching-sim";
import { buildDayStripBlocks, type DayStripBlock } from "@/lib/school-day/timeline";
import { timeToMinutes } from "@/lib/timetable/scheduleSettings";
import type { ResolvedScheduleSettings } from "@/lib/timetable/scheduleSettings";
import type {
  DailyBreakItem,
  SchoolDailyScheduleConfigV2,
  WeekdayKey,
} from "@/types/school-daily-schedule";

const DAY_NUM_TO_WEEKDAY: readonly WeekdayKey[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export function dayOfWeekToWeekdayKey(dayOfWeek: number): WeekdayKey {
  if (!Number.isFinite(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return "monday";
  }
  return DAY_NUM_TO_WEEKDAY[dayOfWeek] ?? "monday";
}

function breaksToIBreakPeriods(breaks: DailyBreakItem[]): IBreakPeriod[] {
  return breaks.map((b) => ({
    name: b.name,
    startTime: b.startTime,
    endTime: b.endTime,
    isLunch: /lunch/i.test(b.name),
  }));
}

/**
 * Resolves a {@link ResolvedScheduleSettings} from school daily schedule v2 (per-grade, breaks, overrides).
 * Used by server slot validation and the class timetable when daily config exists.
 */
export function buildResolvedFromSchoolDailyConfig(
  rawConfig: unknown,
  gradeId: string | null | undefined,
  dayOfWeek: number
): ResolvedScheduleSettings | null {
  const config: SchoolDailyScheduleConfigV2 = ensureConfigV2(rawConfig);
  const weekday = dayOfWeekToWeekdayKey(dayOfWeek);
  const gid = gradeId?.trim() ? String(gradeId) : null;

  const p = resolveDayProfileV2(config, weekday, gid);
  const fBreaks = filterBreaksForGrade(p.breaks, gid) as DailyBreakItem[];
  const sim = simulateTeachingPeriods(
    p.lessonStart,
    p.dayEnd,
    p.periodLengthMinutes,
    p.periodLengthOverrides ?? [],
    fBreaks
  );

  if (!sim.periods.length) {
    return null;
  }

  const periodSlots: IPeriodSlot[] = sim.periods.map((x) => ({
    periodNumber: x.index,
    startTime: x.startTime,
    endTime: x.endTime,
    label: `Period ${x.index}`,
  }));

  const first = periodSlots[0]!;
  const startTime = first.startTime;
  const endTime = p.dayEnd;
  const teachingMinutes = sim.periods.reduce(
    (t, s) => t + Math.max(0, timeToMinutes(s.endTime) - timeToMinutes(s.startTime)),
    0
  );
  const n = sim.periods.length;
  const periodDuration = n > 0 ? Math.max(1, Math.round(teachingMinutes / n)) : 0;

  return {
    startTime,
    endTime,
    periodsPerDay: n,
    periodDuration,
    periodSlots,
    breaks: breaksToIBreakPeriods(fBreaks),
    assembly: null,
    isConfigured: true,
    source: "school_daily",
    profileName: null,
  };
}

/**
 * Full-day strip (opening, teaching, breaks, unallocated) for the class grid — chronologically ordered.
 */
export function buildClassTimelineFromDailyConfig(
  rawConfig: unknown,
  gradeId: string | null | undefined,
  dayOfWeek: number
): ClassDailyTimelineRow[] {
  const config = ensureConfigV2(rawConfig);
  const weekday = dayOfWeekToWeekdayKey(dayOfWeek);
  const gid = gradeId?.trim() ? String(gradeId) : null;
  const { blocks } = buildDayStripBlocks(config, { weekday, previewGradeId: gid });
  return dayStripBlocksToRows(blocks);
}

export type ClassDailyTimelineRow =
  | {
      kind: "opening";
      name: string;
      startTime: string;
      endTime: string;
    }
  | {
      kind: "unallocated";
      startTime: string;
      endTime: string;
      label: string;
    }
  | {
      kind: "period";
      periodNumber: number;
      startTime: string;
      endTime: string;
      label: string;
    }
  | { kind: "break"; name: string; startTime: string; endTime: string };

function parsePeriodIndexFromBlock(block: DayStripBlock): number {
  if (block.variant === "teaching") {
    const m = /^p-(\d+)$/.exec(block.id);
    if (m?.[1]) return Number(m[1]);
    const m2 = /Period\s+(\d+)/i.exec(block.label);
    if (m2?.[1]) return Number(m2[1]);
  }
  return 1;
}

function dayStripBlocksToRows(blocks: DayStripBlock[]): ClassDailyTimelineRow[] {
  const rows: ClassDailyTimelineRow[] = [];
  for (const b of blocks) {
    if (b.variant === "opening") {
      rows.push({
        kind: "opening",
        name: b.label.trim() || "Opening",
        startTime: b.start,
        endTime: b.end,
      });
      continue;
    }
    if (b.variant === "gap") {
      rows.push({
        kind: "unallocated",
        label: b.label.trim() || "Unallocated",
        startTime: b.start,
        endTime: b.end,
      });
      continue;
    }
    if (b.variant === "teaching") {
      const periodNumber = parsePeriodIndexFromBlock(b);
      rows.push({
        kind: "period",
        periodNumber,
        startTime: b.start,
        endTime: b.end,
        label: b.label.trim() || `Period ${periodNumber}`,
      });
      continue;
    }
    rows.push({
      kind: "break",
      name: b.label.trim() || "Break",
      startTime: b.start,
      endTime: b.end,
    });
  }
  rows.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  return rows;
}
