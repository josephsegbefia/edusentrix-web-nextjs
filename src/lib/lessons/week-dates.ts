/** Calendar week helpers (Monday start, UTC date keys). */

export function dateOnlyUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function formatDateYmdUtc(d: Date): string {
  const x = dateOnlyUtc(d);
  const y = x.getUTCFullYear();
  const m = String(x.getUTCMonth() + 1).padStart(2, "0");
  const day = String(x.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysUtc(d: Date, days: number): Date {
  const next = dateOnlyUtc(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Monday of the calendar week containing `anchor` (UTC). */
export function getWeekStartMondayUtc(anchor: Date): Date {
  const d = dateOnlyUtc(anchor);
  const dow = d.getUTCDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  return addDaysUtc(d, delta);
}

export function getCalendarWeekRange(anchor: Date): {
  weekStartDate: string;
  weekEndDate: string;
  weekLabel: string;
} {
  const start = getWeekStartMondayUtc(anchor);
  const end = addDaysUtc(start, 6);
  const weekNum = getIsoWeekNumber(start);
  return {
    weekStartDate: formatDateYmdUtc(start),
    weekEndDate: formatDateYmdUtc(end),
    weekLabel: `Week ${weekNum}`,
  };
}

function getIsoWeekNumber(date: Date): number {
  const d = dateOnlyUtc(date);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function formatWeekRangeLabel(weekStart: string, weekEnd: string): string {
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  const end = new Date(`${weekEnd}T00:00:00.000Z`);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}
