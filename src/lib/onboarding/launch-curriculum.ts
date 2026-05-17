import mongoose, { type ClientSession } from "mongoose";
import { AcademicPeriod } from "@/models/AcademicPeriod";

export type LaunchPeriodInput = {
  yearLabel: string;
  term: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
};

function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Seeds academic periods for the launch wizard final step.
 * Skips period inserts when the school already has at least one period (avoid clobbering live data).
 */
export async function applyLaunchCurriculum(
  schoolId: mongoose.Types.ObjectId,
  input: {
    periods: LaunchPeriodInput[];
  },
  options?: { session?: ClientSession }
): Promise<{ periodsSkipped: boolean }> {
  const session = options?.session;

  const existingPeriodCount = await AcademicPeriod.countDocuments({ schoolId })
    .session(session ?? null);

  if (existingPeriodCount > 0) {
    return { periodsSkipped: true };
  }

  const periods = [...input.periods];
  if (periods.length === 0) {
    return { periodsSkipped: false };
  }

  const sorted = [...periods].sort(
    (a, b) =>
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  const ranges: Array<{ start: Date; end: Date }> = [];
  for (const p of sorted) {
    const startDate = new Date(p.startDate);
    const endDate = new Date(p.endDate);
    if (endDate < startDate) {
      throw new Error(
        `Invalid period range: ${p.yearLabel} ${p.term} (end before start)`
      );
    }
    for (const r of ranges) {
      if (rangesOverlap(startDate, endDate, r.start, r.end)) {
        throw new Error(
          `Academic periods must not overlap (${p.yearLabel} ${p.term}).`
        );
      }
    }
    ranges.push({ start: startDate, end: endDate });
  }

  const currentIdx = sorted.findIndex((p) => p.isCurrent);
  const winnerIdx = currentIdx >= 0 ? currentIdx : sorted.length - 1;

  const docs = sorted.map((p, i) => ({
    schoolId,
    yearLabel: p.yearLabel.trim(),
    term: p.term.trim(),
    startDate: new Date(p.startDate),
    endDate: new Date(p.endDate),
    isCurrent: i === winnerIdx,
  }));

  await AcademicPeriod.insertMany(docs, { session });

  return { periodsSkipped: false };
}
