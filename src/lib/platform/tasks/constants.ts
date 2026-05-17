export const PLATFORM_TASK_CATEGORIES = [
  "school_onboarding",
  "data_import",
  "academic_setup",
  "payment_setup",
  "subscription",
  "support",
  "training",
  "bug_investigation",
  "client_follow_up",
  "custom",
] as const;

export const PLATFORM_TASK_STATUSES = [
  "todo",
  "in_progress",
  "blocked",
  "in_review",
  "done",
  "cancelled",
] as const;

export type PlatformTaskCategory = (typeof PLATFORM_TASK_CATEGORIES)[number];
export type PlatformTaskStatus = (typeof PLATFORM_TASK_STATUSES)[number];
export type PlatformTaskPriority = "low" | "normal" | "high" | "urgent";
