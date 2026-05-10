export const EXAM_QUESTION_TYPES = [
  "multiple_choice",
  "true_false",
  "short_answer",
  "essay",
  "structured",
  "fill_blank",
  "matching",
  "diagram_labeling",
  "comprehension",
  "practical",
  "oral",
  "image_based",
] as const;

export const EXAM_QUESTION_DIFFICULTIES = [
  "easy",
  "medium",
  "hard",
  "mixed",
] as const;

export const EXAM_PAPER_STATUSES = [
  "draft",
  "submitted",
  "needs_revision",
  "approved",
  "printed",
  "completed",
  "archived",
] as const;

export const EXAM_PAPER_SCOPES = ["class_group", "grade_wide"] as const;

export const EXAM_PAPER_OWNER_ROLES = [
  "teacher",
  "admin",
  "academic_head",
] as const;

export const EXAM_PAPER_SOURCE_MODES = [
  "manual",
  "ai_assisted",
  "question_bank",
  "mixed",
] as const;

export const EXAM_QUESTION_SOURCES = [
  "manual",
  "ai_generated",
  "question_bank",
  "imported",
] as const;

export const EXAM_QUESTION_ATTACHMENT_TYPES = [
  "image",
  "pdf",
  "diagram",
  "audio",
  "file",
] as const;

export const EXAM_QUESTION_ATTACHMENT_DISPLAY_MODES = [
  "above_question",
  "below_question",
  "inline",
] as const;

export const QUESTION_BANK_ITEM_STATUSES = [
  "draft",
  "curated",
  "approved",
  "needs_review",
  "archived",
] as const;

export const QUESTION_BANK_ITEM_SOURCES = [
  "manual",
  "ai_generated",
  "imported",
  "past_exam",
  "copied",
] as const;

export const EXAM_REVIEW_DECISIONS = [
  "approved",
  "needs_revision",
  "rejected",
] as const;

export const DEFAULT_EXAM_TYPE_SEEDS = [
  "Class Test",
  "Quiz",
  "Mid-Term Exam",
  "End of Term Exam",
  "End of Academic Year / Promotion Exam",
  "Mock Exam",
  "Entrance Exam",
  "Placement Test",
  "Remedial Assessment",
  "Practical Exam",
  "Oral Exam",
  "Project-Based Assessment",
] as const;
