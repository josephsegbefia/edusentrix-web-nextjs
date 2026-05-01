/**
 * Client-safe date range helpers for lesson analytics pages/routes.
 * Keep this file free of model imports.
 */
export function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export function endOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

export function defaultLessonAnalyticsRange(): { from: Date; to: Date } {
  const to = endOfUtcDay(new Date());
  const from = startOfUtcDay(new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000));
  return { from, to };
}
