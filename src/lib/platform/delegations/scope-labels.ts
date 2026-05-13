import type { PlatformDelegationScope } from "@/lib/platform/delegations/scopes";

export const PLATFORM_DELEGATION_SCOPE_LABELS: Record<PlatformDelegationScope, string> = {
  school_implementation: "School Implementation",
  payment_setup_review: "Payment Setup Review",
  support_case: "Support Case",
  billing_follow_up: "Billing Follow-up",
  training: "Training",
  data_import: "Data Import",
  academic_setup: "Academic Setup",
  technical_investigation: "Technical Investigation",
};

export const PLATFORM_DELEGATION_SCOPE_DESCRIPTIONS: Record<PlatformDelegationScope, string> = {
  school_implementation: "General setup and onboarding work for a delegated school.",
  payment_setup_review: "Review payout, payment setup, and provider readiness.",
  support_case: "Support handling for a specific school or operational issue.",
  billing_follow_up: "Billing and subscription follow-up for a delegated school.",
  training: "Training coordination and onboarding session follow-up.",
  data_import: "Bulk import, migration, and data validation work.",
  academic_setup: "Academic calendar, subjects, curriculum, and class setup.",
  technical_investigation: "Technical diagnostics and incident investigation.",
};
