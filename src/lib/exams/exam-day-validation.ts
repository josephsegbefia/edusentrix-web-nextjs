import type { ExamSessionStatus, ExamTimetableEntryStatus } from "@/types/academics/exam-scheduling-engine";

export const EXAM_DAY_OPERATION_SESSION_STATUSES: ExamSessionStatus[] = [
  "published",
  "in_progress",
  "completed",
  "locked",
];

export function canMarkExamEntryStarted(status: ExamTimetableEntryStatus): boolean {
  return status === "published";
}

export function canMarkExamEntryCompleted(status: ExamTimetableEntryStatus): boolean {
  return status === "published" || status === "in_progress";
}

export function resolveNextEntryStatusAfterStart(
  currentStatus: ExamTimetableEntryStatus
): ExamTimetableEntryStatus | null {
  if (currentStatus === "published") return "in_progress";
  return null;
}

export function resolveNextEntryStatusAfterComplete(
  currentStatus: ExamTimetableEntryStatus
): ExamTimetableEntryStatus | null {
  if (currentStatus === "published" || currentStatus === "in_progress") {
    return "completed";
  }
  return null;
}

export function isExamDayOperationSessionStatus(status: ExamSessionStatus): boolean {
  return EXAM_DAY_OPERATION_SESSION_STATUSES.includes(status);
}
