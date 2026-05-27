/**
 * role-entitlement-rules.ts
 *
 * Maps each school role to the features they can ACCESS and the features
 * they can WRITE (create/update/delete). This is layered on top of the
 * plan's feature entitlements.
 *
 * Spec §19.2 — Role entitlement rules.
 *
 * Key design rules:
 *   - A feature must be included in the plan AND permitted for the role to be usable.
 *   - Platform admin roles are excluded (they operate outside school tenancy).
 *   - "read" permissions for a feature include all sub-features.
 *   - "write" permissions gate mutations (create/update/delete) on that feature.
 *
 * Usage:
 *   const rules = getRoleEntitlementRules("teacher");
 *   if (!rules.canRead.has(FEATURE_KEYS.ACADEMICS_SCHEMES)) → show locked
 *   if (!rules.canWrite.has(FEATURE_KEYS.ACADEMICS_LESSON_NOTES)) → disable create button
 */

import { FEATURE_KEYS, type FeatureKey } from "./feature-keys";

export type SchoolRole =
  | "school_admin"
  | "bursar"
  | "teacher"
  | "parent"
  | "student";

export type RoleEntitlementRule = {
  role: SchoolRole;
  /**
   * Features this role can read/access (subject to plan inclusion).
   * Empty set = no feature access from plan by role alone (rare for admin).
   */
  canRead: ReadonlySet<FeatureKey>;
  /**
   * Features this role can mutate (subject to plan inclusion).
   * Must be a subset of canRead.
   */
  canWrite: ReadonlySet<FeatureKey>;
  /** Whether this role can VIEW usage/billing info in their dashboard. */
  canViewBilling: boolean;
};

// ---------------------------------------------------------------------------
// Feature sets per role
// ---------------------------------------------------------------------------

const ALL_FEATURES = new Set<FeatureKey>(Object.values(FEATURE_KEYS));

const SCHOOL_ADMIN_READ = ALL_FEATURES;
const SCHOOL_ADMIN_WRITE = ALL_FEATURES;

const BURSAR_READ = new Set<FeatureKey>([
  FEATURE_KEYS.SCHOOL_PROFILE,
  FEATURE_KEYS.STUDENTS,
  FEATURE_KEYS.FINANCE_FEES,
  FEATURE_KEYS.FINANCE_INVOICES,
  FEATURE_KEYS.FINANCE_PAYMENTS,
  FEATURE_KEYS.FINANCE_PARENT_PAYMENTS,
  FEATURE_KEYS.FINANCE_RECONCILIATION,
  FEATURE_KEYS.FINANCE_DISBURSEMENTS,
  FEATURE_KEYS.FINANCE_REPORTS,
  FEATURE_KEYS.ADMISSION_FEES,
]);

const BURSAR_WRITE = new Set<FeatureKey>([
  FEATURE_KEYS.FINANCE_FEES,
  FEATURE_KEYS.FINANCE_INVOICES,
  FEATURE_KEYS.FINANCE_PAYMENTS,
  FEATURE_KEYS.FINANCE_RECONCILIATION,
  FEATURE_KEYS.FINANCE_DISBURSEMENTS,
  FEATURE_KEYS.ADMISSION_FEES,
]);

const TEACHER_READ = new Set<FeatureKey>([
  FEATURE_KEYS.SCHOOL_PROFILE,
  FEATURE_KEYS.ACADEMIC_PERIODS,
  FEATURE_KEYS.CLASSES,
  FEATURE_KEYS.STUDENTS,
  FEATURE_KEYS.TEACHERS,
  FEATURE_KEYS.ACADEMICS_SUBJECTS,
  FEATURE_KEYS.ACADEMICS_CURRICULUM,
  FEATURE_KEYS.ACADEMICS_SCHEMES,
  FEATURE_KEYS.ACADEMICS_LESSON_NOTES,
  FEATURE_KEYS.ACADEMICS_LESSONS,
  FEATURE_KEYS.ASSESSMENT_EXAMINATIONS,
  FEATURE_KEYS.ASSESSMENT_QUESTION_BANK,
  FEATURE_KEYS.AI_LEO,
  FEATURE_KEYS.AI_LESSON_GENERATION,
  FEATURE_KEYS.AI_ANALYTICS,
  FEATURE_KEYS.AI_EXAM_GENERATION,
  FEATURE_KEYS.COMMUNICATION_NOTICES,
  FEATURE_KEYS.COMMUNICATION_MESSAGING,
  FEATURE_KEYS.LEARN_MANAGE,
  FEATURE_KEYS.MEETINGS_VIDEO,
  FEATURE_KEYS.ANALYTICS_BASIC,
  FEATURE_KEYS.ANALYTICS_ADVANCED,
  FEATURE_KEYS.DOCUMENTS_STORAGE,
  FEATURE_KEYS.DOCUMENTS_EXPORTS,
  FEATURE_KEYS.LIBRARY,
]);

const TEACHER_WRITE = new Set<FeatureKey>([
  FEATURE_KEYS.ACADEMICS_LESSON_NOTES,
  FEATURE_KEYS.ACADEMICS_LESSONS,
  FEATURE_KEYS.ASSESSMENT_EXAMINATIONS,
  FEATURE_KEYS.ASSESSMENT_QUESTION_BANK,
  FEATURE_KEYS.AI_LESSON_GENERATION,
  FEATURE_KEYS.AI_EXAM_GENERATION,
  FEATURE_KEYS.COMMUNICATION_NOTICES,
  FEATURE_KEYS.COMMUNICATION_MESSAGING,
  FEATURE_KEYS.MEETINGS_VIDEO,
  FEATURE_KEYS.DOCUMENTS_STORAGE,
]);

const PARENT_READ = new Set<FeatureKey>([
  FEATURE_KEYS.SCHOOL_PROFILE,
  FEATURE_KEYS.FINANCE_PARENT_PAYMENTS,
  FEATURE_KEYS.COMMUNICATION_NOTICES,
  FEATURE_KEYS.COMMUNICATION_MESSAGING,
  FEATURE_KEYS.COMMUNICATION_COMMUNITY,
  FEATURE_KEYS.DOCUMENTS_STORAGE,
]);

const PARENT_WRITE = new Set<FeatureKey>([
  FEATURE_KEYS.FINANCE_PARENT_PAYMENTS,
  FEATURE_KEYS.COMMUNICATION_MESSAGING,
  FEATURE_KEYS.COMMUNICATION_COMMUNITY,
]);

const STUDENT_READ = new Set<FeatureKey>([
  FEATURE_KEYS.SCHOOL_PROFILE,
  FEATURE_KEYS.ACADEMICS_LESSONS,
  FEATURE_KEYS.ASSESSMENT_EXAMINATIONS,
  FEATURE_KEYS.COMMUNICATION_NOTICES,
  FEATURE_KEYS.LEARN_STUDENT_ACCESS,
  FEATURE_KEYS.DOCUMENTS_STORAGE,
  FEATURE_KEYS.LIBRARY,
]);

const STUDENT_WRITE = new Set<FeatureKey>([
  FEATURE_KEYS.LEARN_STUDENT_ACCESS,
]);

// ---------------------------------------------------------------------------
// Rules map
// ---------------------------------------------------------------------------

export const ROLE_ENTITLEMENT_RULES: Record<SchoolRole, RoleEntitlementRule> = {
  school_admin: {
    role: "school_admin",
    canRead: SCHOOL_ADMIN_READ,
    canWrite: SCHOOL_ADMIN_WRITE,
    canViewBilling: true,
  },
  bursar: {
    role: "bursar",
    canRead: BURSAR_READ,
    canWrite: BURSAR_WRITE,
    canViewBilling: true,
  },
  teacher: {
    role: "teacher",
    canRead: TEACHER_READ,
    canWrite: TEACHER_WRITE,
    canViewBilling: false,
  },
  parent: {
    role: "parent",
    canRead: PARENT_READ,
    canWrite: PARENT_WRITE,
    canViewBilling: false,
  },
  student: {
    role: "student",
    canRead: STUDENT_READ,
    canWrite: STUDENT_WRITE,
    canViewBilling: false,
  },
};

/**
 * Look up entitlement rules for a school role.
 */
export function getRoleEntitlementRules(role: SchoolRole): RoleEntitlementRule {
  return ROLE_ENTITLEMENT_RULES[role];
}

/**
 * Returns true if the given role can read the feature,
 * independent of plan entitlements.
 */
export function roleCanReadFeature(role: SchoolRole, feature: FeatureKey): boolean {
  return ROLE_ENTITLEMENT_RULES[role].canRead.has(feature);
}

/**
 * Returns true if the given role can write/mutate the feature,
 * independent of plan entitlements.
 */
export function roleCanWriteFeature(role: SchoolRole, feature: FeatureKey): boolean {
  return ROLE_ENTITLEMENT_RULES[role].canWrite.has(feature);
}

/**
 * Combined check: role has access AND plan includes the feature.
 * Pass featuresEnabledForPlan from SchoolEntitlementSnapshot.features.
 */
export function roleAndPlanCanRead(
  role: SchoolRole,
  feature: FeatureKey,
  featuresEnabledForPlan: ReadonlySet<FeatureKey> | Set<string>
): boolean {
  return roleCanReadFeature(role, feature) && featuresEnabledForPlan.has(feature);
}

export function roleAndPlanCanWrite(
  role: SchoolRole,
  feature: FeatureKey,
  featuresEnabledForPlan: ReadonlySet<FeatureKey> | Set<string>
): boolean {
  return roleCanWriteFeature(role, feature) && featuresEnabledForPlan.has(feature);
}
