export const PLATFORM_DELEGATION_SCOPES = [
  "school_implementation",
  "school_assisted_admin_access",
  "payment_setup_review",
  "support_case",
  "billing_follow_up",
  "training",
  "data_import",
  "academic_setup",
  "technical_investigation",
] as const;

export type PlatformDelegationScope = (typeof PLATFORM_DELEGATION_SCOPES)[number];
export type PlatformDelegationStatus = "active" | "expired" | "revoked";
