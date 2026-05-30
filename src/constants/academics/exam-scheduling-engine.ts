export const EXAM_SESSION_STATUSES = [
  "draft",
  "scheduled",
  "conflict_review",
  "published",
  "in_progress",
  "completed",
  "locked",
  "archived",
  "cancelled",
] as const;

export const EXAM_TYPES = [
  "midterm",
  "end_of_term",
  "mock",
  "entrance",
  "class_test",
  "other",
] as const;

export const EXAM_TIMETABLE_ENTRY_STATUSES = [
  "draft",
  "ready",
  "published",
  "in_progress",
  "completed",
  "cancelled",
  "rescheduled",
] as const;

export const EXAM_INVIGILATOR_ROLES = [
  "lead",
  "assistant",
  "standby",
  "relief",
] as const;

export const EXAM_INVIGILATOR_STATUSES = [
  "assigned",
  "acknowledged",
  "declined",
  "replaced",
  "completed",
  "missed",
] as const;

export const EXAM_VENUE_TYPES = [
  "classroom",
  "hall",
  "lab",
  "library",
  "office",
  "outdoor",
  "other",
] as const;

export const EXAM_TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export const EXAM_CONFLICT_TYPES = [
  "class_overlap",
  "teacher_overlap",
  "room_overlap",
  "outside_session_range",
  "missing_invigilator",
  "missing_venue",
  "invalid_duration",
] as const;

export const EXAM_CONFLICT_SEVERITIES = ["error", "warning", "info"] as const;

export const EXAM_CONFLICT_SNAPSHOT_STATUSES = ["open", "resolved", "overridden"] as const;

export const EXAM_TIMETABLE_VERSION_STATUSES = [
  "published",
  "superseded",
  "rolled_back",
] as const;

export const DEFAULT_EXAM_POLICY_NAME = "Default Exam Policy";

export const EXAM_TIMETABLE_ENTRY_SOURCE_REF_TYPE = "exam_timetable_entry";

export const EXAM_INCIDENT_TYPES = [
  "late_start",
  "student_absence",
  "teacher_absence",
  "material_issue",
  "misconduct",
  "emergency",
  "other",
] as const;

export const EXAM_INCIDENT_SEVERITIES = ["low", "medium", "high"] as const;

export const EXAM_INCIDENT_STATUSES = ["open", "reviewed", "resolved"] as const;

export const EXAM_STUDENT_SITTING_STATUSES = [
  "present",
  "absent",
  "excused",
  "medical",
  "rescheduled",
  "exempted",
] as const;

export const EXAM_CALENDAR_LINK_KINDS = ["exam_entry", "invigilation"] as const;

export const EXAM_EXPORT_MODES = ["published", "draft"] as const;

export const EXAM_EXPORT_PDF_TYPES = ["full", "class", "invigilation", "venue"] as const;
