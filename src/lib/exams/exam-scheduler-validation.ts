import { Types } from "mongoose";

export function combineExamDateAndTime(dateInput: Date | string, hhmm: string): Date {
  const base = new Date(dateInput);
  const [hours, minutes] = hhmm.split(":").map((part) => Number(part));
  const result = new Date(base);
  result.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return result;
}

export function buildExamCalendarSourceRefKey(input: {
  linkKind: "exam_entry" | "invigilation";
  sourceRefId: string;
}) {
  return `exam:${input.linkKind}:${input.sourceRefId}`;
}

export function isWeekdayAllowed(date: Date, workingDays: number[]): boolean {
  return workingDays.includes(date.getDay());
}

export function addMinutesToTime(hhmm: string, minutesToAdd: number): string {
  const [hours, minutes] = hhmm.split(":").map((part) => Number(part));
  const total = (hours ?? 0) * 60 + (minutes ?? 0) + minutesToAdd;
  const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const nextHours = Math.floor(normalized / 60);
  const nextMinutes = normalized % 60;
  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
}

export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function computeSchedulerConfidenceScore(input: {
  scheduledCount: number;
  totalCount: number;
  warningCount: number;
}): number {
  if (input.totalCount <= 0) return 0;
  const coverage = input.scheduledCount / input.totalCount;
  const penalty = Math.min(0.35, input.warningCount * 0.05);
  return Math.max(0, Math.min(100, Math.round(coverage * 100 - penalty * 100)));
}
