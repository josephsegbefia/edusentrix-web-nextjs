import type { ExamConflictType } from "@/types/academics/exam-scheduling-engine";

export const EXAM_CONFLICT_TYPE_LABELS: Record<ExamConflictType, string> = {
  class_overlap: "Class conflict",
  teacher_overlap: "Invigilator conflict",
  room_overlap: "Venue conflict",
  outside_session_range: "Outside session dates",
  missing_invigilator: "Missing invigilator",
  missing_venue: "Missing venue",
  invalid_duration: "Invalid duration",
};

export function formatExamConflictType(type: ExamConflictType) {
  return EXAM_CONFLICT_TYPE_LABELS[type] ?? "Scheduling issue";
}

const READINESS_ISSUE_LABELS: Record<string, string> = {
  unscheduled_entry: "Unscheduled paper",
  missing_assessment_link: "Missing assessment link",
  no_entries: "No exam papers",
  teacher_workload_warning: "Teacher workload warning",
};

export function formatPublishReadinessIssueType(type: string) {
  if (type in EXAM_CONFLICT_TYPE_LABELS) {
    return EXAM_CONFLICT_TYPE_LABELS[type as ExamConflictType];
  }
  return READINESS_ISSUE_LABELS[type] ?? type.replace(/_/g, " ");
}
