import type { OpeningBlock } from "@/types/school-daily-schedule";
import { hhmmToMinutes } from "./time";

export function validateOpeningBlocks(
  dayGateStart: string,
  lessonStart: string,
  blocks: OpeningBlock[]
): { ok: true } | { ok: false; error: string } {
  const g = hhmmToMinutes(dayGateStart);
  const l = hhmmToMinutes(lessonStart);
  if (g == null || l == null) {
    return { ok: false, error: "First bell and lesson start must be valid times." };
  }
  if (l < g) {
    return { ok: false, error: "First bell time must be on or before lessons start time." };
  }
  for (const b of blocks) {
    const s = hhmmToMinutes(b.startTime);
    const e = hhmmToMinutes(b.endTime);
    if (s == null || e == null || e <= s) {
      return { ok: false, error: `Invalid times for “${b.name}”.` };
    }
    if (s < g || e > l) {
      return {
        ok: false,
        error: `“${b.name}” must fall entirely between first bell and lesson start (non-teaching).`,
      };
    }
  }
  if (blocks.length === 0) {
    return { ok: true };
  }
  const sorted = [...blocks].sort(
    (a, b) =>
      (hhmmToMinutes(a.startTime) ?? 0) - (hhmmToMinutes(b.startTime) ?? 0)
  );
  let prevEnd = g;
  for (const b of sorted) {
    const s = hhmmToMinutes(b.startTime)!;
    const e = hhmmToMinutes(b.endTime)!;
    if (s < prevEnd) {
      return { ok: false, error: "Non-teaching opening blocks cannot overlap each other." };
    }
    prevEnd = e;
  }
  return { ok: true };
}
