/**
 * Plan entitlement map — v1.
 *
 * Maps each PlanCode to the access level for every canonical feature key.
 *
 * Access levels:
 *  "YES"      — full access, no usage check.
 *  "LIMITED"  — access is gated by a numeric limit (see limit-keys.ts).
 *  "OPTIONAL" — only enabled when explicitly set by platform admin (Pilot only).
 *  "NO"       — blocked for this plan.
 *
 * Source of truth: spec §4 + §5 plan matrix.
 *
 * Enforcement is controlled by SUBSCRIPTION_ENFORCEMENT_ENABLED env flag.
 * While that flag is false, ALL features return allowed regardless of this map.
 */

import type { FeatureKey } from "./feature-keys";
import { FEATURE_KEYS } from "./feature-keys";
import type { PlanCode } from "./plan-codes";

export type PlanAccessLevel = "YES" | "LIMITED" | "OPTIONAL" | "NO";

export type PlanEntitlementRow = Record<FeatureKey, PlanAccessLevel>;

export const PLAN_ENTITLEMENTS: Record<PlanCode, PlanEntitlementRow> = {
  // ---------------------------------------------------------------------------
  // PILOT — deny by default; platform admin explicitly enables per school.
  // ---------------------------------------------------------------------------
  pilot: {
    // Core (default optional — admin configures per school)
    [FEATURE_KEYS.SCHOOL_PROFILE]: "OPTIONAL",
    [FEATURE_KEYS.ACADEMIC_PERIODS]: "OPTIONAL",
    [FEATURE_KEYS.CLASSES]: "OPTIONAL",
    [FEATURE_KEYS.STUDENTS]: "OPTIONAL",
    [FEATURE_KEYS.TEACHERS]: "OPTIONAL",
    [FEATURE_KEYS.PARENTS]: "OPTIONAL",
    [FEATURE_KEYS.INVITATIONS]: "OPTIONAL",

    // Admissions
    [FEATURE_KEYS.ADMISSIONS]: "OPTIONAL",
    [FEATURE_KEYS.ADMISSION_FEES]: "OPTIONAL",

    // Finance
    [FEATURE_KEYS.FINANCE_FEES]: "OPTIONAL",
    [FEATURE_KEYS.FINANCE_INVOICES]: "OPTIONAL",
    [FEATURE_KEYS.FINANCE_PAYMENTS]: "OPTIONAL",
    [FEATURE_KEYS.FINANCE_PARENT_PAYMENTS]: "OPTIONAL",
    [FEATURE_KEYS.FINANCE_RECONCILIATION]: "OPTIONAL",
    [FEATURE_KEYS.FINANCE_DISBURSEMENTS]: "OPTIONAL",
    [FEATURE_KEYS.FINANCE_REPORTS]: "OPTIONAL",

    // Communications
    [FEATURE_KEYS.COMMUNICATION_NOTICES]: "OPTIONAL",
    [FEATURE_KEYS.COMMUNICATION_MESSAGING]: "OPTIONAL",
    [FEATURE_KEYS.COMMUNICATION_COMMUNITY]: "OPTIONAL",

    // Academics
    [FEATURE_KEYS.ACADEMICS_SUBJECTS]: "OPTIONAL",
    [FEATURE_KEYS.ACADEMICS_CURRICULUM]: "OPTIONAL",
    [FEATURE_KEYS.ACADEMICS_SCHEMES]: "OPTIONAL",
    [FEATURE_KEYS.ACADEMICS_LESSON_NOTES]: "OPTIONAL",
    [FEATURE_KEYS.ACADEMICS_LESSONS]: "OPTIONAL",

    // Assessment
    [FEATURE_KEYS.ASSESSMENT_EXAMINATIONS]: "OPTIONAL",
    [FEATURE_KEYS.ASSESSMENT_QUESTION_BANK]: "OPTIONAL",

    // AI
    [FEATURE_KEYS.AI_LEO]: "OPTIONAL",
    [FEATURE_KEYS.AI_LESSON_GENERATION]: "OPTIONAL",
    [FEATURE_KEYS.AI_ANALYTICS]: "OPTIONAL",
    [FEATURE_KEYS.AI_EXAM_GENERATION]: "OPTIONAL",

    // Learn
    [FEATURE_KEYS.LEARN_MANAGE]: "OPTIONAL",
    [FEATURE_KEYS.LEARN_STUDENT_ACCESS]: "OPTIONAL",

    // Meetings
    [FEATURE_KEYS.MEETINGS_VIDEO]: "OPTIONAL",

    // Analytics
    [FEATURE_KEYS.ANALYTICS_BASIC]: "OPTIONAL",
    [FEATURE_KEYS.ANALYTICS_ADVANCED]: "OPTIONAL",

    // Documents
    [FEATURE_KEYS.DOCUMENTS_STORAGE]: "OPTIONAL",
    [FEATURE_KEYS.DOCUMENTS_EXPORTS]: "OPTIONAL",

    // Support / Developer
    [FEATURE_KEYS.SUPPORT_PRIORITY]: "OPTIONAL",
    [FEATURE_KEYS.DEVELOPER_API_ACCESS]: "NO",
  },

  // ---------------------------------------------------------------------------
  // STARTER — core school records, admissions, fees, basic comms.
  // ---------------------------------------------------------------------------
  starter: {
    // Core
    [FEATURE_KEYS.SCHOOL_PROFILE]: "YES",
    [FEATURE_KEYS.ACADEMIC_PERIODS]: "YES",
    [FEATURE_KEYS.CLASSES]: "YES",
    [FEATURE_KEYS.STUDENTS]: "LIMITED",         // up to maxStudents limit
    [FEATURE_KEYS.TEACHERS]: "LIMITED",         // up to maxTeachers limit
    [FEATURE_KEYS.PARENTS]: "YES",
    [FEATURE_KEYS.INVITATIONS]: "LIMITED",      // up to maxInvitationsPerMonth

    // Admissions
    [FEATURE_KEYS.ADMISSIONS]: "YES",
    [FEATURE_KEYS.ADMISSION_FEES]: "YES",

    // Finance
    [FEATURE_KEYS.FINANCE_FEES]: "YES",
    [FEATURE_KEYS.FINANCE_INVOICES]: "YES",
    [FEATURE_KEYS.FINANCE_PAYMENTS]: "YES",
    [FEATURE_KEYS.FINANCE_PARENT_PAYMENTS]: "YES",
    [FEATURE_KEYS.FINANCE_RECONCILIATION]: "YES",
    [FEATURE_KEYS.FINANCE_DISBURSEMENTS]: "NO",
    [FEATURE_KEYS.FINANCE_REPORTS]: "LIMITED",  // basic reports only

    // Communications
    [FEATURE_KEYS.COMMUNICATION_NOTICES]: "YES",
    [FEATURE_KEYS.COMMUNICATION_MESSAGING]: "NO",
    [FEATURE_KEYS.COMMUNICATION_COMMUNITY]: "NO",

    // Academics — excluded from Starter
    [FEATURE_KEYS.ACADEMICS_SUBJECTS]: "YES",   // basic subject offerings
    [FEATURE_KEYS.ACADEMICS_CURRICULUM]: "NO",
    [FEATURE_KEYS.ACADEMICS_SCHEMES]: "NO",
    [FEATURE_KEYS.ACADEMICS_LESSON_NOTES]: "NO",
    [FEATURE_KEYS.ACADEMICS_LESSONS]: "NO",

    // Assessment
    [FEATURE_KEYS.ASSESSMENT_EXAMINATIONS]: "NO",
    [FEATURE_KEYS.ASSESSMENT_QUESTION_BANK]: "NO",

    // AI — excluded
    [FEATURE_KEYS.AI_LEO]: "NO",
    [FEATURE_KEYS.AI_LESSON_GENERATION]: "NO",
    [FEATURE_KEYS.AI_ANALYTICS]: "NO",
    [FEATURE_KEYS.AI_EXAM_GENERATION]: "NO",

    // Learn — excluded
    [FEATURE_KEYS.LEARN_MANAGE]: "NO",
    [FEATURE_KEYS.LEARN_STUDENT_ACCESS]: "NO",

    // Meetings — not included (add-on only)
    [FEATURE_KEYS.MEETINGS_VIDEO]: "NO",

    // Analytics
    [FEATURE_KEYS.ANALYTICS_BASIC]: "YES",
    [FEATURE_KEYS.ANALYTICS_ADVANCED]: "NO",

    // Documents
    [FEATURE_KEYS.DOCUMENTS_STORAGE]: "LIMITED", // 5GB
    [FEATURE_KEYS.DOCUMENTS_EXPORTS]: "LIMITED",  // 5/month

    // Support
    [FEATURE_KEYS.SUPPORT_PRIORITY]: "NO",
    [FEATURE_KEYS.DEVELOPER_API_ACCESS]: "NO",
  },

  // ---------------------------------------------------------------------------
  // GROWTH — full academic operations, basic AI, Learn eligible.
  // ---------------------------------------------------------------------------
  growth: {
    // Core
    [FEATURE_KEYS.SCHOOL_PROFILE]: "YES",
    [FEATURE_KEYS.ACADEMIC_PERIODS]: "YES",
    [FEATURE_KEYS.CLASSES]: "YES",
    [FEATURE_KEYS.STUDENTS]: "LIMITED",         // up to maxStudents (1500)
    [FEATURE_KEYS.TEACHERS]: "LIMITED",         // up to maxTeachers (120)
    [FEATURE_KEYS.PARENTS]: "YES",
    [FEATURE_KEYS.INVITATIONS]: "LIMITED",

    // Admissions
    [FEATURE_KEYS.ADMISSIONS]: "YES",
    [FEATURE_KEYS.ADMISSION_FEES]: "YES",

    // Finance
    [FEATURE_KEYS.FINANCE_FEES]: "YES",
    [FEATURE_KEYS.FINANCE_INVOICES]: "YES",
    [FEATURE_KEYS.FINANCE_PAYMENTS]: "YES",
    [FEATURE_KEYS.FINANCE_PARENT_PAYMENTS]: "YES",
    [FEATURE_KEYS.FINANCE_RECONCILIATION]: "YES",
    [FEATURE_KEYS.FINANCE_DISBURSEMENTS]: "YES",
    [FEATURE_KEYS.FINANCE_REPORTS]: "YES",

    // Communications
    [FEATURE_KEYS.COMMUNICATION_NOTICES]: "YES",
    [FEATURE_KEYS.COMMUNICATION_MESSAGING]: "YES",
    [FEATURE_KEYS.COMMUNICATION_COMMUNITY]: "NO",

    // Academics — full for Growth
    [FEATURE_KEYS.ACADEMICS_SUBJECTS]: "YES",
    [FEATURE_KEYS.ACADEMICS_CURRICULUM]: "YES",
    [FEATURE_KEYS.ACADEMICS_SCHEMES]: "YES",
    [FEATURE_KEYS.ACADEMICS_LESSON_NOTES]: "YES",
    [FEATURE_KEYS.ACADEMICS_LESSONS]: "YES",

    // Assessment — basic
    [FEATURE_KEYS.ASSESSMENT_EXAMINATIONS]: "LIMITED",  // basic exams
    [FEATURE_KEYS.ASSESSMENT_QUESTION_BANK]: "LIMITED", // basic question bank

    // AI — limited credits
    [FEATURE_KEYS.AI_LEO]: "LIMITED",           // up to leoCreditsPerTerm (500)
    [FEATURE_KEYS.AI_LESSON_GENERATION]: "LIMITED",
    [FEATURE_KEYS.AI_ANALYTICS]: "NO",
    [FEATURE_KEYS.AI_EXAM_GENERATION]: "LIMITED",

    // Learn — activation eligible, seats are add-on
    [FEATURE_KEYS.LEARN_MANAGE]: "YES",
    [FEATURE_KEYS.LEARN_STUDENT_ACCESS]: "LIMITED", // seats via add-on

    // Meetings — add-on only
    [FEATURE_KEYS.MEETINGS_VIDEO]: "NO",

    // Analytics
    [FEATURE_KEYS.ANALYTICS_BASIC]: "YES",
    [FEATURE_KEYS.ANALYTICS_ADVANCED]: "LIMITED", // limited

    // Documents
    [FEATURE_KEYS.DOCUMENTS_STORAGE]: "LIMITED",  // 25GB
    [FEATURE_KEYS.DOCUMENTS_EXPORTS]: "LIMITED",  // 20/month

    // Support
    [FEATURE_KEYS.SUPPORT_PRIORITY]: "YES",
    [FEATURE_KEYS.DEVELOPER_API_ACCESS]: "NO",
  },

  // ---------------------------------------------------------------------------
  // ENTERPRISE — full smart school OS with higher limits and meetings.
  // ---------------------------------------------------------------------------
  enterprise: {
    // Core
    [FEATURE_KEYS.SCHOOL_PROFILE]: "YES",
    [FEATURE_KEYS.ACADEMIC_PERIODS]: "YES",
    [FEATURE_KEYS.CLASSES]: "YES",
    [FEATURE_KEYS.STUDENTS]: "YES",             // null = unlimited (or negotiated)
    [FEATURE_KEYS.TEACHERS]: "YES",
    [FEATURE_KEYS.PARENTS]: "YES",
    [FEATURE_KEYS.INVITATIONS]: "YES",

    // Admissions
    [FEATURE_KEYS.ADMISSIONS]: "YES",
    [FEATURE_KEYS.ADMISSION_FEES]: "YES",

    // Finance
    [FEATURE_KEYS.FINANCE_FEES]: "YES",
    [FEATURE_KEYS.FINANCE_INVOICES]: "YES",
    [FEATURE_KEYS.FINANCE_PAYMENTS]: "YES",
    [FEATURE_KEYS.FINANCE_PARENT_PAYMENTS]: "YES",
    [FEATURE_KEYS.FINANCE_RECONCILIATION]: "YES",
    [FEATURE_KEYS.FINANCE_DISBURSEMENTS]: "YES",
    [FEATURE_KEYS.FINANCE_REPORTS]: "YES",

    // Communications
    [FEATURE_KEYS.COMMUNICATION_NOTICES]: "YES",
    [FEATURE_KEYS.COMMUNICATION_MESSAGING]: "YES",
    [FEATURE_KEYS.COMMUNICATION_COMMUNITY]: "YES",

    // Academics
    [FEATURE_KEYS.ACADEMICS_SUBJECTS]: "YES",
    [FEATURE_KEYS.ACADEMICS_CURRICULUM]: "YES",
    [FEATURE_KEYS.ACADEMICS_SCHEMES]: "YES",
    [FEATURE_KEYS.ACADEMICS_LESSON_NOTES]: "YES",
    [FEATURE_KEYS.ACADEMICS_LESSONS]: "YES",

    // Assessment
    [FEATURE_KEYS.ASSESSMENT_EXAMINATIONS]: "YES",
    [FEATURE_KEYS.ASSESSMENT_QUESTION_BANK]: "YES",

    // AI — higher credits
    [FEATURE_KEYS.AI_LEO]: "LIMITED",           // 2,500 credits per term
    [FEATURE_KEYS.AI_LESSON_GENERATION]: "LIMITED",
    [FEATURE_KEYS.AI_ANALYTICS]: "YES",
    [FEATURE_KEYS.AI_EXAM_GENERATION]: "LIMITED",

    // Learn — eligible + included allowance or add-on seats
    [FEATURE_KEYS.LEARN_MANAGE]: "YES",
    [FEATURE_KEYS.LEARN_STUDENT_ACCESS]: "LIMITED",

    // Meetings — included allowance
    [FEATURE_KEYS.MEETINGS_VIDEO]: "LIMITED",   // 1,000 participant-minutes

    // Analytics
    [FEATURE_KEYS.ANALYTICS_BASIC]: "YES",
    [FEATURE_KEYS.ANALYTICS_ADVANCED]: "YES",

    // Documents
    [FEATURE_KEYS.DOCUMENTS_STORAGE]: "LIMITED", // 100GB
    [FEATURE_KEYS.DOCUMENTS_EXPORTS]: "LIMITED",  // 100/month

    // Support
    [FEATURE_KEYS.SUPPORT_PRIORITY]: "YES",
    [FEATURE_KEYS.DEVELOPER_API_ACCESS]: "YES",
  },
};

/**
 * Returns the access level for a feature key on a given plan.
 * Never throws — returns "NO" for unknown keys/plans.
 */
export function getPlanAccess(
  planCode: PlanCode | null | undefined,
  featureKey: FeatureKey
): PlanAccessLevel {
  if (!planCode) return "NO";
  return PLAN_ENTITLEMENTS[planCode]?.[featureKey] ?? "NO";
}
