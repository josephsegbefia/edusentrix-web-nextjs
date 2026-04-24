import type { EventInput } from "@fullcalendar/core";
import { addDays, setHours, setMinutes } from "date-fns";
import type {
  PublishedClassSlotDTO,
  PublishedGapFillDTO,
} from "@/hooks/admin/useClassPublishedTimetable";
import type { PublishedDayScheduleSegmentDTO } from "@/lib/timetable/publishedTimetableDaySegments";

function atTimeOnDay(baseDay: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h)) return baseDay;
  return setMinutes(setHours(baseDay, h), Number.isFinite(m) ? m : 0);
}

/**
 * FullCalendar events for one week. `weekSunday` is the Sunday (day 0) of the displayed week;
 * `dayOfWeek` 0–6 matches JS (Sun–Sat).
 */
export function buildPublishedTimetableEvents(
  weekSunday: Date,
  slots: PublishedClassSlotDTO[],
  gapFills: PublishedGapFillDTO[],
  dayScheduleSegments: PublishedDayScheduleSegmentDTO[] = [],
  now: Date | null = null
): EventInput[] {
  const out: EventInput[] = [];
  const nowMs = now ? now.getTime() : null;

  dayScheduleSegments.forEach((seg, i) => {
    const day = addDays(weekSunday, seg.dayOfWeek);
    const start = atTimeOnDay(day, seg.startTime.trim());
    const end = atTimeOnDay(day, seg.endTime.trim());
    if (end <= start) return;
    const isCurrent =
      nowMs !== null && start.getTime() <= nowMs && nowMs < end.getTime();
    const uiKind =
      seg.kind === "dayEnd"
        ? ("dayClose" as const)
        : seg.kind === "break"
          ? ("scheduleBreak" as const)
          : seg.kind === "assembly"
            ? ("scheduleAssembly" as const)
            : ("scheduleOpening" as const);
    out.push({
      id: `sched-${seg.kind}-${seg.dayOfWeek}-${seg.startTime}-${seg.endTime}-${i}`,
      title: seg.label,
      start,
      end,
      display: "block",
      backgroundColor: "transparent",
      borderColor: "transparent",
      classNames: ["edus-pub-event", "edus-pub-event--sched", `edus-pub-event--${seg.kind}`],
      extendedProps: {
        kind: uiKind,
        segment: seg,
        isCurrent,
      },
    });
  });

  gapFills.forEach((g, i) => {
    const day = addDays(weekSunday, g.dayOfWeek);
    const start = atTimeOnDay(day, g.startTime.trim());
    const end = atTimeOnDay(day, g.endTime.trim());
    if (end <= start) return;
    const isCurrent =
      nowMs !== null && start.getTime() <= nowMs && nowMs < end.getTime();
    out.push({
      id: `gap-${g.dayOfWeek}-${g.startTime}-${g.endTime}-${g.presetCode}-${i}`,
      title: g.label,
      start,
      end,
      display: "block",
      backgroundColor: "transparent",
      borderColor: "transparent",
      classNames: ["edus-pub-event", "edus-pub-event--gap"],
      extendedProps: {
        kind: "gap" as const,
        fill: g,
        isCurrent,
      },
    });
  });

  for (const s of slots) {
    const day = addDays(weekSunday, s.dayOfWeek);
    const start = atTimeOnDay(day, s.startTime.trim());
    const end = atTimeOnDay(day, s.endTime.trim());
    if (end <= start) continue;
    const isCurrent =
      nowMs !== null && start.getTime() <= nowMs && nowMs < end.getTime();
    out.push({
      id: `lesson-${s.id}`,
      title: s.subjectName,
      start,
      end,
      display: "block",
      backgroundColor: "transparent",
      borderColor: "transparent",
      classNames: ["edus-pub-event", "edus-pub-event--lesson"],
      extendedProps: {
        kind: "lesson" as const,
        slot: s,
        isCurrent,
      },
    });
  }

  return out;
}

/** Sunday 00:00 local for the calendar week that contains `d`. */
export function weekSundayContaining(d: Date): Date {
  const x = new Date(d);
  const dow = x.getDay();
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - dow);
  return x;
}
