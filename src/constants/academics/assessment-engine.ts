/**
 * Shared constants for the Academic Assessment & Report Card Engine.
 * @see ACADEMIC_ASSESSMENT_REPORT_CARD_ENGINE_SPEC.md
 */

/** Score component weights must total this value. */
export const COMPONENT_WEIGHT_TOTAL = 100;

export const GRADE_LABEL_MODES = [
  "letters",
  "numbers",
  "descriptors",
  "custom",
] as const;

export const ROUNDING_RULES = [
  "none",
  "nearest_integer",
  "one_decimal",
  "two_decimals",
] as const;

export const GRADING_POLICY_STATUSES = ["draft", "active", "archived"] as const;

export const CONTRIBUTION_MODES = [
  "teacher_selected",
  "best_n",
  "average_all",
  "fixed_required_item",
  "weighted_items",
  "latest_n",
  "drop_lowest",
] as const;

/** Contribution modes supported in MVP calculation utilities (Slice 3). */
export const CONTRIBUTION_MODES_MVP = [
  "teacher_selected",
  "average_all",
  "best_n",
  "fixed_required_item",
  "weighted_items",
] as const;

/** Contribution modes planned for later slices. */
export const CONTRIBUTION_MODES_LATER = ["latest_n", "drop_lowest"] as const;

export const ASSESSMENT_PLAN_STATUSES = [
  "draft",
  "active",
  "locked",
  "archived",
] as const;

export const ASSESSMENT_SOURCE_TYPES = [
  "manual",
  "app_assignment",
  "app_quiz",
  "imported_csv",
  "exam",
  "system",
] as const;

export const ASSESSMENT_ITEM_VISIBILITIES = [
  "internal",
  "teacher_only",
  "visible_to_parent_after_release",
  "visible_to_student_after_release",
] as const;

export const ASSESSMENT_ITEM_STATUSES = [
  "draft",
  "open",
  "completed",
  "submitted",
  "locked",
  "archived",
] as const;

export const ASSESSMENT_SCORE_STATUSES = [
  "draft",
  "recorded",
  "missing",
  "excused",
  "submitted",
  "locked",
] as const;

export const MISSING_SCORE_POLICIES = [
  "exclude_from_average",
  "count_as_zero",
  "block_submission",
  "excused",
] as const;

export const SUBJECT_RESULT_STATUSES = [
  "draft",
  "ready",
  "submitted",
  "returned",
  "approved",
  "locked",
] as const;

export const REPORT_CARD_RUN_STATUSES = [
  "draft",
  "opened",
  "collecting_marks",
  "ready_to_compile",
  "compiled",
  "submitted_for_approval",
  "returned",
  "approved",
  "released",
  "archived",
] as const;

export const STUDENT_REPORT_CARD_STATUSES = [
  "draft",
  "compiled",
  "approved",
  "released",
  "revoked",
] as const;

export const REPORT_ATTENDANCE_SNAPSHOT_SOURCES = [
  "homeroom_daily_attendance",
] as const;

export const REPORT_APPROVAL_ENTITY_TYPES = [
  "report_run",
  "subject_result",
  "student_report_card",
] as const;

export const REPORT_APPROVAL_ACTIONS = [
  "open",
  "submit",
  "return",
  "approve",
  "release",
  "revoke",
  "unlock",
  "compile",
  "lock",
  "comment",
] as const;

/**
 * Assessment type labels used by the new engine.
 * Aligned with legacy `Assessment` model values for migration compatibility.
 */
export const ASSESSMENT_ENGINE_ASSESSMENT_TYPES = [
  "ca",
  "quiz",
  "assignment",
  "midterm",
  "exam",
  "project",
  "mock",
  "criterion",
  "portfolio",
  "formative",
  "classwork",
  "homework",
  "final",
  "oral",
  "practical",
  "written",
] as const;

export const CONTRIBUTION_MODE_LABELS: Record<
  (typeof CONTRIBUTION_MODES)[number],
  string
> = {
  teacher_selected: "Teacher selected",
  best_n: "Best N",
  average_all: "Average all",
  fixed_required_item: "Fixed required item",
  weighted_items: "Weighted items",
  latest_n: "Latest N",
  drop_lowest: "Drop lowest",
};

export const GRADE_LABEL_MODE_LABELS: Record<
  (typeof GRADE_LABEL_MODES)[number],
  string
> = {
  letters: "Letter grades",
  numbers: "Numeric grades",
  descriptors: "Descriptors",
  custom: "Custom labels",
};

export const ASSESSMENT_SOURCE_TYPE_LABELS: Record<
  (typeof ASSESSMENT_SOURCE_TYPES)[number],
  string
> = {
  manual: "Manual / offline",
  app_assignment: "App assignment",
  app_quiz: "App quiz",
  imported_csv: "Imported CSV",
  exam: "Formal exam",
  system: "System generated",
};

export const SUBJECT_RESULT_STATUS_LABELS: Record<
  (typeof SUBJECT_RESULT_STATUSES)[number],
  string
> = {
  draft: "Draft",
  ready: "Ready",
  submitted: "Submitted",
  returned: "Returned",
  approved: "Approved",
  locked: "Locked",
};

export const REPORT_CARD_RUN_STATUS_LABELS: Record<
  (typeof REPORT_CARD_RUN_STATUSES)[number],
  string
> = {
  draft: "Draft",
  opened: "Opened",
  collecting_marks: "Collecting marks",
  ready_to_compile: "Ready to compile",
  compiled: "Compiled",
  submitted_for_approval: "Submitted for approval",
  returned: "Returned",
  approved: "Approved",
  released: "Released",
  archived: "Archived",
};
