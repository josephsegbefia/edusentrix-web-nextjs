import {
  CalendarRecurrence,
  CalendarRecurrenceFrequency,
} from "@/lib/academic-calendar/types";

const MAX_OCCURRENCES = 500;

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

function addYears(date: Date, years: number) {
  const next = new Date(date.getTime());
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function startOfDay(date: Date) {
  const next = new Date(date.getTime());
  next.setHours(0, 0, 0, 0);
  return next;
}

function withTime(base: Date, timeSource: Date) {
  const next = new Date(base.getTime());
  next.setHours(
    timeSource.getHours(),
    timeSource.getMinutes(),
    timeSource.getSeconds(),
    timeSource.getMilliseconds()
  );
  return next;
}

function isWithinRange(start: Date, end: Date, rangeStart: Date, rangeEnd: Date) {
  return start <= rangeEnd && end >= rangeStart;
}

function normalizeRecurrence(recurrence?: CalendarRecurrence | null) {
  if (!recurrence) {
    return { frequency: "none" } as CalendarRecurrence;
  }
  return {
    frequency: recurrence.frequency || "none",
    interval: recurrence.interval && recurrence.interval > 0 ? recurrence.interval : 1,
    byWeekday: recurrence.byWeekday || [],
    byMonthDay: recurrence.byMonthDay || [],
    until: recurrence.until,
    count: recurrence.count,
  } as CalendarRecurrence;
}

export type ExpandableEvent = {
  _id: string;
  calendarId: string;
  title: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  status: string;
  eventType: string;
  isNonTeachingDay: boolean;
  location?: string | null;
  color?: string | null;
  coverImageUrl?: string | null;
  recurrence?: CalendarRecurrence | null;
};

export function expandRecurringEvent(
  event: ExpandableEvent,
  rangeStart: Date,
  rangeEnd: Date
) {
  const occurrences: Array<{ start: Date; end: Date; isRecurring: boolean }> = [];

  const recurrence = normalizeRecurrence(event.recurrence);
  const frequency = recurrence.frequency as CalendarRecurrenceFrequency;

  const baseStart = new Date(event.startDate);
  const baseEnd = new Date(event.endDate);
  const durationMs = baseEnd.getTime() - baseStart.getTime();

  const until = recurrence.until ? new Date(recurrence.until) : null;
  const maxCount = recurrence.count && recurrence.count > 0 ? recurrence.count : null;

  if (frequency === "none") {
    if (isWithinRange(baseStart, baseEnd, rangeStart, rangeEnd)) {
      occurrences.push({ start: baseStart, end: baseEnd, isRecurring: false });
    }
    return occurrences;
  }

  let generated = 0;
  const interval = recurrence.interval || 1;

  if (frequency === "daily") {
    let cursor = baseStart;
    while (cursor <= rangeEnd && generated < MAX_OCCURRENCES) {
      const occurrenceStart = cursor;
      const occurrenceEnd = new Date(cursor.getTime() + durationMs);
      if (isWithinRange(occurrenceStart, occurrenceEnd, rangeStart, rangeEnd)) {
        occurrences.push({ start: occurrenceStart, end: occurrenceEnd, isRecurring: true });
        generated += 1;
        if (maxCount && generated >= maxCount) break;
      }
      cursor = addDays(cursor, interval);
      if (until && cursor > until) break;
    }
    return occurrences;
  }

  if (frequency === "weekly") {
    const byWeekday = recurrence.byWeekday && recurrence.byWeekday.length > 0
      ? recurrence.byWeekday
      : [baseStart.getDay()];

    let cursor = startOfDay(rangeStart < baseStart ? baseStart : rangeStart);
    const baseWeekStart = startOfDay(baseStart);

    while (cursor <= rangeEnd && generated < MAX_OCCURRENCES) {
      const day = cursor.getDay();
      if (byWeekday.includes(day) && cursor >= baseStart) {
        const diffWeeks = Math.floor(
          (startOfDay(cursor).getTime() - baseWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
        );
        if (diffWeeks % interval === 0) {
          const occurrenceStart = withTime(cursor, baseStart);
          const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
          if (isWithinRange(occurrenceStart, occurrenceEnd, rangeStart, rangeEnd)) {
            occurrences.push({ start: occurrenceStart, end: occurrenceEnd, isRecurring: true });
            generated += 1;
            if (maxCount && generated >= maxCount) break;
          }
        }
      }
      cursor = addDays(cursor, 1);
      if (until && cursor > until) break;
    }
    return occurrences;
  }

  if (frequency === "monthly") {
    const byMonthDay = recurrence.byMonthDay && recurrence.byMonthDay.length > 0
      ? recurrence.byMonthDay
      : [baseStart.getDate()];

    let cursor = new Date(baseStart.getTime());
    cursor.setDate(1);

    while (cursor <= rangeEnd && generated < MAX_OCCURRENCES) {
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);

      for (const dayOfMonth of byMonthDay) {
        if (generated >= MAX_OCCURRENCES) break;
        const occurrenceDate = new Date(
          monthStart.getFullYear(),
          monthStart.getMonth(),
          dayOfMonth
        );
        if (occurrenceDate < monthStart || occurrenceDate > monthEnd) continue;
        if (occurrenceDate < baseStart) continue;
        const occurrenceStart = withTime(occurrenceDate, baseStart);
        const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
        if (isWithinRange(occurrenceStart, occurrenceEnd, rangeStart, rangeEnd)) {
          occurrences.push({ start: occurrenceStart, end: occurrenceEnd, isRecurring: true });
          generated += 1;
          if (maxCount && generated >= maxCount) break;
        }
      }

      cursor = addMonths(cursor, interval);
      if (until && cursor > until) break;
    }
    return occurrences;
  }

  if (frequency === "yearly") {
    let cursor = new Date(baseStart.getTime());
    while (cursor <= rangeEnd && generated < MAX_OCCURRENCES) {
      const occurrenceStart = new Date(cursor.getTime());
      const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
      if (isWithinRange(occurrenceStart, occurrenceEnd, rangeStart, rangeEnd)) {
        occurrences.push({ start: occurrenceStart, end: occurrenceEnd, isRecurring: true });
        generated += 1;
        if (maxCount && generated >= maxCount) break;
      }
      cursor = addYears(cursor, interval);
      if (until && cursor > until) break;
    }
  }

  return occurrences;
}

export function getRangeDefaults() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export function addMinutesSafe(date: Date, minutes: number) {
  return addMinutes(date, minutes);
}

export function clampRange(start: Date, end: Date) {
  if (start > end) {
    return { start: end, end: start };
  }
  return { start, end };
}
