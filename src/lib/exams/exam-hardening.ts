import type { ExamSessionStatus } from "@/types/academics/exam-scheduling-engine";
import {
  TEACHER_TIMETABLE_ENTRY_STATUSES,
  TEACHER_VISIBLE_EXAM_SESSION_STATUSES,
} from "@/lib/exams/exam-teacher-validation";

const OBJECT_ID_PATTERN = /^[a-fA-F0-9]{24}$/;

export const PUBLISHABLE_EXAM_SESSION_STATUSES: ExamSessionStatus[] = [
  "draft",
  "scheduled",
  "conflict_review",
  "published",
];

export const PUBLISH_BLOCKED_EXAM_SESSION_STATUSES: ExamSessionStatus[] = [
  "locked",
  "archived",
  "cancelled",
];

export function parseExamObjectId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!OBJECT_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function isPublishableExamSessionStatus(status: ExamSessionStatus): boolean {
  return PUBLISHABLE_EXAM_SESSION_STATUSES.includes(status);
}

export function isPublishBlockedExamSessionStatus(status: ExamSessionStatus): boolean {
  return PUBLISH_BLOCKED_EXAM_SESSION_STATUSES.includes(status);
}

export function assertSameSchoolId(recordSchoolId: string, requestSchoolId: string): boolean {
  return recordSchoolId === requestSchoolId;
}

export function isParentStudentExamSessionVisible(input: {
  allowParentStudentVisibility: boolean;
  sessionStatus: ExamSessionStatus;
}): boolean {
  return (
    input.allowParentStudentVisibility &&
    TEACHER_VISIBLE_EXAM_SESSION_STATUSES.includes(input.sessionStatus)
  );
}

export function isPublishedExamEntryVisibleToParentStudent(input: {
  entryStatus: string;
  isUnscheduled: boolean;
}): boolean {
  return (
    !input.isUnscheduled &&
    TEACHER_TIMETABLE_ENTRY_STATUSES.includes(
      input.entryStatus as (typeof TEACHER_TIMETABLE_ENTRY_STATUSES)[number]
    )
  );
}

export function getPublishBlockedReason(status: ExamSessionStatus): string | null {
  if (isPublishableExamSessionStatus(status)) return null;
  if (status === "in_progress") {
    return "Exam session is already in progress. Finish day operations before republishing.";
  }
  if (status === "completed") {
    return "Completed exam sessions cannot be republished through the builder.";
  }
  if (isPublishBlockedExamSessionStatus(status)) {
    return "This exam session is locked, archived, or cancelled.";
  }
  return "This exam session cannot be published in its current status.";
}
