/**
 * EduSentrix Subscription System — public surface.
 *
 * Import from here rather than from individual files to keep the public API stable.
 *
 * Environment flags (add to .env.local):
 *   SUBSCRIPTION_ENFORCEMENT_ENABLED=false    — master switch. All gates are no-ops while false.
 *   SUBSCRIPTION_FRONTEND_GATES_ENABLED=false — locked UI cards / nav hiding.
 *   SUBSCRIPTION_API_GATES_ENABLED=false      — API route / server action enforcement.
 *   SUBSCRIPTION_USAGE_GATES_ENABLED=false    — Leo / meeting credit checks.
 *   SUBSCRIPTION_PAYMENT_CHARGES_ENABLED=false — transaction fee resolver.
 *   SUBSCRIPTION_AUDIT_LOGS_ENABLED=true      — audit events (can be on early).
 */

// Feature keys
export { FEATURE_KEYS, FEATURE_DEFINITIONS, assertKnownFeatureKey, isKnownFeatureKey } from "./feature-keys";
export type { FeatureKey, FeatureDefinition } from "./feature-keys";

// Limit keys
export { LIMIT_KEYS, DEFAULT_PLAN_LIMITS, isKnownLimitKey } from "./limit-keys";
export type { LimitKey, PlanLimits } from "./limit-keys";

// Plan codes + status
export {
  PLAN_CODES,
  PLAN_META,
  SUBSCRIPTION_STATUSES,
  normaliseSubscriptionStatus,
  isKnownPlanCode,
  isKnownSubscriptionStatus,
} from "./plan-codes";
export type { PlanCode, SubscriptionStatus } from "./plan-codes";

// Plan entitlements
export { PLAN_ENTITLEMENTS, getPlanAccess } from "./plan-entitlements";
export type { PlanAccessLevel, PlanEntitlementRow } from "./plan-entitlements";

// Access mode
export {
  resolveAccessMode,
  canCreateInAccessMode,
  canReadInAccessMode,
  canCollectPaymentsInAccessMode,
  canUseAiInAccessMode,
  ACCESS_MODE_LABELS,
  getAccessModeBannerMessage,
} from "./access-mode";
export type { SchoolAccessMode, AccessModeInput } from "./access-mode";

// Entitlement resolver
export {
  resolveSchoolEntitlements,
  schoolHasFeature,
  getSchoolLimit,
} from "./resolve-school-entitlements";
export type { SchoolEntitlementSnapshot, TransactionChargeSummary } from "./resolve-school-entitlements";

// Guards (API routes / server actions)
export {
  requireSchoolFeature,
  enforceSchoolLimit,
  requireSchoolWriteAccess,
  requireUsageCredits,
} from "./guards";
export type { GuardResult, LimitGuardResult } from "./guards";

// Transaction fee resolver
export {
  resolveTransactionChargeConfig,
  computeTransactionFeeFromConfig,
} from "./transaction-fees";
export type { TransactionChargeConfig, TransactionChargeResolution, TransactionPayerMode } from "./transaction-fees";

// Usage tracker (Leo credits, storage, meetings) — includes reserve/finalize/refund
export {
  checkUsageBalance,
  trackSubscriptionUsage,
  requireUsageBalance,
  reserveUsageCredits,
  finalizeUsageCredits,
  refundUsageCredits,
} from "./usage-tracker";
export type { TrackUsageParams, UsageCheckResult, UsageReservation } from "./usage-tracker";

// Central audit event writer (respects SUBSCRIPTION_AUDIT_LOGS_ENABLED flag)
export { recordSubscriptionEvent } from "./record-event";

// Pilot subscription assignment (school onboarding)
export { assignPilotSubscription } from "./assign-pilot-subscription";

// Subscription health scan (notifications)
export { runSubscriptionHealthScan } from "./health-scan";
export type { SubscriptionHealthAlert, HealthScanResult, HealthAlertSeverity } from "./health-scan";

// Payment charge policy resolver
export { resolvePaymentChargePolicy } from "./resolve-payment-charge-policy";
export type { ResolvedChargePolicy } from "./resolve-payment-charge-policy";

// Structured subscription errors
export {
  SubscriptionError,
  FeatureGatedError,
  LimitExceededError,
  AccessModeError,
  UsageExhaustedError,
  isSubscriptionError,
} from "./subscription-errors";

// Role entitlement rules
export {
  ROLE_ENTITLEMENT_RULES,
  getRoleEntitlementRules,
  roleCanReadFeature,
  roleCanWriteFeature,
  roleAndPlanCanRead,
  roleAndPlanCanWrite,
} from "./role-entitlement-rules";
export type { SchoolRole, RoleEntitlementRule } from "./role-entitlement-rules";

// Entitlement consistency scanner
export { runEntitlementConsistencyScan } from "./consistency-scanner";
export type { ConsistencyIssue, ConsistencyScanReport, ConsistencyIssueCode } from "./consistency-scanner";
