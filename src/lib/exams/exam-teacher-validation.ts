import type { ExamSessionStatus } from "@/types/academics/exam-scheduling-engine";

export const TEACHER_VISIBLE_EXAM_SESSION_STATUSES: ExamSessionStatus[] = [
  "published",
  "in_progress",
  "completed",
  "locked",
];

export const TEACHER_EXCLUDED_EXAM_SESSION_STATUSES: ExamSessionStatus[] = [
  "cancelled",
  "archived",
];

export const TEACHER_TIMETABLE_ENTRY_STATUSES = [
  "published",
  "in_progress",
  "completed",
] as const;

export const TEACHER_ACTIVE_INVIGILATOR_STATUSES = [
  "assigned",
  "acknowledged",
  "completed",
] as const;

export const TEACHER_MARKS_PENDING_ITEM_STATUSES = ["open", "draft"] as const;

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isTeacherVisibleExamSessionStatus(status: ExamSessionStatus): boolean {
  return TEACHER_VISIBLE_EXAM_SESSION_STATUSES.includes(status);
}

export function isExamMarksPendingEligible(input: {
  examDateIso: string;
  sessionStatus: ExamSessionStatus;
  assessmentItemStatus: string;
  contributesToReport: boolean;
  referenceDate?: Date;
}): boolean {
  if (!input.contributesToReport) return false;
  if (!TEACHER_MARKS_PENDING_ITEM_STATUSES.includes(
    input.assessmentItemStatus as (typeof TEACHER_MARKS_PENDING_ITEM_STATUSES)[number]
  )) {
    return false;
  }
  if (!isTeacherVisibleExamSessionStatus(input.sessionStatus)) return false;

  const reference = startOfLocalDay(input.referenceDate ?? new Date());
  const examDate = startOfLocalDay(new Date(input.examDateIso));
  return examDate.getTime() <= reference.getTime();
}

export function teacherTeachesExamEntry(input: {
  subjectId: string;
  classGroupIds: string[];
  assignmentKeys: Set<string>;
}): boolean {
  return input.classGroupIds.some((classGroupId) =>
    input.assignmentKeys.has(`${classGroupId}|${input.subjectId}`)
  );
}

export function computeMissingScoreCount(input: {
  studentCount: number;
  gradedCount: number;
}): number {
  return Math.max(0, input.studentCount - input.gradedCount);
}
