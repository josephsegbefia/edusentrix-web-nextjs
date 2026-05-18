export const ACADEMIC_PERIOD_MAX_BACKDATE_DAYS = 90;

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function academicPeriodPastDateError(input: {
  startDate: Date;
  endDate: Date;
  today?: Date;
}): string | null {
  const today = startOfDay(input.today ?? new Date());
  const earliestAllowed = addDays(today, -ACADEMIC_PERIOD_MAX_BACKDATE_DAYS);
  const startDate = startOfDay(input.startDate);
  const endDate = startOfDay(input.endDate);

  if (startDate < earliestAllowed) {
    return `Start date cannot be more than ${ACADEMIC_PERIOD_MAX_BACKDATE_DAYS} days in the past. Use this form for current onboarding-period dates; historical cleanup should be handled separately.`;
  }

  if (endDate < earliestAllowed) {
    return `End date cannot be more than ${ACADEMIC_PERIOD_MAX_BACKDATE_DAYS} days in the past. Use this form for current onboarding-period dates; historical cleanup should be handled separately.`;
  }

  return null;
}
