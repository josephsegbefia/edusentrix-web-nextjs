export const GHANA_TIME_ZONE = "Africa/Accra";

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function getGhanaDateParts(date = new Date()): DateParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: GHANA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const partMap = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(partMap.get("year")),
    month: Number(partMap.get("month")),
    day: Number(partMap.get("day")),
  };
}

function isValidUtcDate(date: Date, parts: DateParts) {
  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === parts.year &&
    date.getUTCMonth() === parts.month - 1 &&
    date.getUTCDate() === parts.day
  );
}

export function getGhanaTodayDate(now = new Date()) {
  const parts = getGhanaDateParts(now);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

export function getGhanaDateString(date = new Date()) {
  const parts = getGhanaDateParts(date);
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

export function parseGhanaDateString(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return isValidUtcDate(date, parts) ? date : null;
}

export function parseGhanaDateLabel(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const numeric = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (numeric) {
    const rawYear = Number(numeric[3]);
    const parts = {
      year: rawYear < 100 ? 2000 + rawYear : rawYear,
      month: Number(numeric[2]),
      day: Number(numeric[1]),
    };
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    return isValidUtcDate(date, parts) ? date : null;
  }

  const namedMonth = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})$/);
  if (namedMonth) {
    const monthIndex = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ].indexOf(namedMonth[2].toLowerCase());
    if (monthIndex >= 0) {
      const rawYear = Number(namedMonth[3]);
      const parts = {
        year: rawYear < 100 ? 2000 + rawYear : rawYear,
        month: monthIndex + 1,
        day: Number(namedMonth[1]),
      };
      const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
      return isValidUtcDate(date, parts) ? date : null;
    }
  }

  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : getGhanaTodayDate(fallback);
}

export function getMondayForGhanaWeek(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const diff = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}
