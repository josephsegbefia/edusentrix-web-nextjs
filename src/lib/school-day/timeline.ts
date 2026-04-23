import type {
  SchoolDailyScheduleConfigV2,
  WeekdayKey,
} from "@/types/school-daily-schedule";
import type { DailyBreakItem } from "@/types/school-daily-schedule";
import { hhmmToMinutes, minutesToHhmm } from "./time";
import { filterBreaksForGrade, simulateTeachingPeriods } from "./teaching-sim";
import { resolveDayProfileV2 } from "./periods";

export type TimelineSegment = {
  id: string;
  kind: "pre" | "teaching" | "break";
  label: string;
  start: string;
  end: string;
  tone: "amber" | "violet" | "emerald";
};

/**
 * Chronological segments from first bell to end of day for preview (one grade context).
 */
export function buildDayTimeline(
  config: SchoolDailyScheduleConfigV2,
  opts: { weekday: WeekdayKey; previewGradeId: string | null }
): { segments: TimelineSegment[]; rangeStart: string; rangeEnd: string; periodsCount: number } {
  const p = resolveDayProfileV2(config, opts.weekday, opts.previewGradeId);
  const br = filterBreaksForGrade(p.breaks, opts.previewGradeId) as DailyBreakItem[];
  const sim = simulateTeachingPeriods(
    p.lessonStart,
    p.dayEnd,
    p.periodLengthMinutes,
    p.periodLengthOverrides ?? [],
    br
  );

  const parts: TimelineSegment[] = [];
  for (const ob of p.openingBlocks ?? []) {
    parts.push({
      id: `pre-${ob.id}`,
      kind: "pre",
      label: ob.name,
      start: ob.startTime,
      end: ob.endTime,
      tone: "amber",
    });
  }
  for (const pr of sim.periods) {
    parts.push({
      id: `p-${pr.index}`,
      kind: "teaching",
      label: `Period ${pr.index}`,
      start: pr.startTime,
      end: pr.endTime,
      tone: "violet",
    });
  }
  for (const b of br) {
    parts.push({
      id: `brk-${b.id}`,
      kind: "break",
      label: b.name,
      start: b.startTime,
      end: b.endTime,
      tone: "emerald",
    });
  }

  parts.sort(
    (a, b) => (hhmmToMinutes(a.start) ?? 0) - (hhmmToMinutes(b.start) ?? 0)
  );

  return {
    segments: parts,
    rangeStart: p.dayGateStart,
    rangeEnd: p.dayEnd,
    periodsCount: sim.periods.length,
  };
}

/** Strip preview: same clock window as the bar (first bell → end of day). */
export type DayStripBlock = {
  id: string;
  /** opening = non-teaching before P1; gap = unallocated time in the window */
  variant: "opening" | "teaching" | "break" | "gap";
  label: string;
  start: string;
  end: string;
};

function clipToDayRange(
  start: string,
  end: string,
  rangeStart: string,
  rangeEnd: string
): { start: string; end: string; startM: number; endM: number } | null {
  const s = hhmmToMinutes(start);
  const e = hhmmToMinutes(end);
  const rs = hhmmToMinutes(rangeStart);
  const re = hhmmToMinutes(rangeEnd);
  if (s == null || e == null || rs == null || re == null) return null;
  if (e <= rs || s >= re) return null;
  const s0 = Math.max(s, rs);
  const e0 = Math.min(e, re);
  if (e0 <= s0) return null;
  return {
    start: minutesToHhmm(s0),
    end: minutesToHhmm(e0),
    startM: s0,
    endM: e0,
  };
}

/**
 * Fills gaps between first bell and end of day with explicit “Unallocated” blocks so the bar is fully
 * covered (teaching, breaks, opening, and slack all visible).
 */
export function buildDayStripBlocks(
  config: SchoolDailyScheduleConfigV2,
  opts: { weekday: WeekdayKey; previewGradeId: string | null }
): { blocks: DayStripBlock[]; rangeStart: string; rangeEnd: string; periodsCount: number } {
  const { segments, rangeStart, rangeEnd, periodsCount } = buildDayTimeline(config, opts);
  const rs = hhmmToMinutes(rangeStart);
  const re = hhmmToMinutes(rangeEnd);
  if (rs == null || re == null || re <= rs) {
    return { blocks: [], rangeStart, rangeEnd, periodsCount };
  }

  const clipped: Array<{
    id: string;
    kind: TimelineSegment["kind"];
    label: string;
    startM: number;
    endM: number;
    start: string;
    end: string;
  }> = [];

  for (const seg of segments) {
    const c = clipToDayRange(seg.start, seg.end, rangeStart, rangeEnd);
    if (!c) continue;
    clipped.push({
      id: seg.id,
      kind: seg.kind,
      label: seg.label.trim() || (seg.kind === "pre" ? "Opening" : "Block"),
      startM: c.startM,
      endM: c.endM,
      start: c.start,
      end: c.end,
    });
  }

  clipped.sort((a, b) => a.startM - b.startM);

  const blocks: DayStripBlock[] = [];
  let cursor = rs;
  let gapN = 0;
  for (const item of clipped) {
    if (item.startM > cursor) {
      const gapStart = minutesToHhmm(cursor);
      const gapEnd = minutesToHhmm(item.startM);
      blocks.push({
        id: `gap-mid-${gapN++}-${gapStart}-${gapEnd}`,
        variant: "gap",
        label: "Unallocated",
        start: gapStart,
        end: gapEnd,
      });
    }
    const variant: DayStripBlock["variant"] =
      item.kind === "pre" ? "opening" : item.kind === "teaching" ? "teaching" : "break";
    blocks.push({
      id: item.id,
      variant,
      label: item.label,
      start: item.start,
      end: item.end,
    });
    cursor = Math.max(cursor, item.endM);
  }
  if (cursor < re) {
    blocks.push({
      id: `gap-tail-${minutesToHhmm(cursor)}-${minutesToHhmm(re)}`,
      variant: "gap",
      label: "Unallocated",
      start: minutesToHhmm(cursor),
      end: minutesToHhmm(re),
    });
  }
  return { blocks, rangeStart, rangeEnd, periodsCount };
}
