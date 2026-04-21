import type { ResolvedScheduleSettings } from "@/lib/timetable/scheduleSettings";

/**
 * Returns true when start/end exactly match one of the school's resolved period bands.
 */
export function slotAlignsWithSchoolPeriods(
  resolved: ResolvedScheduleSettings,
  startTime: string,
  endTime: string
): boolean {
  const trimmedStart = startTime.trim();
  const trimmedEnd = endTime.trim();
  return resolved.periodSlots.some(
    (p) => p.startTime === trimmedStart && p.endTime === trimmedEnd
  );
}

export function findPeriodForTimes(
  resolved: ResolvedScheduleSettings,
  startTime: string,
  endTime: string
): { periodNumber: number; startTime: string; endTime: string } | null {
  const trimmedStart = startTime.trim();
  const trimmedEnd = endTime.trim();
  const hit = resolved.periodSlots.find(
    (p) => p.startTime === trimmedStart && p.endTime === trimmedEnd
  );
  return hit
    ? { periodNumber: hit.periodNumber, startTime: hit.startTime, endTime: hit.endTime }
    : null;
}
