export function formatHoursMinutes(hours: number | null | undefined): string {
  if (typeof hours !== "number" || !Number.isFinite(hours) || hours <= 0) {
    return "0 min";
  }

  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (wholeHours > 0 && minutes > 0) {
    return `${wholeHours}h ${minutes}m`;
  }
  if (wholeHours > 0) {
    return `${wholeHours}h`;
  }
  return `${minutes}m`;
}

export function hoursMinutesToDecimal(hours: number, minutes: number): number {
  const safeHours = Number.isFinite(hours) ? Math.max(0, Math.floor(hours)) : 0;
  const safeMinutes = Number.isFinite(minutes)
    ? Math.min(59, Math.max(0, Math.floor(minutes)))
    : 0;

  return Math.round((safeHours + safeMinutes / 60) * 100) / 100;
}

export function splitDecimalHours(value: number | null | undefined): {
  hours: number;
  minutes: number;
} {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return { hours: 0, minutes: 0 };
  }

  const totalMinutes = Math.round(value * 60);
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}
