/**
 * Canonical plan code definitions for EduSentrix subscriptions.
 */

export const PLAN_CODES = {
  PILOT: "pilot",
  STARTER: "starter",
  GROWTH: "growth",
  ENTERPRISE: "enterprise",
} as const;

export type PlanCode = (typeof PLAN_CODES)[keyof typeof PLAN_CODES];

const KNOWN_PLAN_CODES = new Set<string>(Object.values(PLAN_CODES));

export function isKnownPlanCode(code: string): code is PlanCode {
  return KNOWN_PLAN_CODES.has(code);
}

export const PLAN_META: Record<
  PlanCode,
  { label: string; description: string; sortOrder: number; publicVisible: boolean }
> = {
  pilot: {
    label: "Pilot",
    description:
      "Non-public testing and onboarding plan. Platform admins choose the enabled modules, limits, expiry date, and payment mode per school.",
    sortOrder: 0,
    publicVisible: false,
  },
  starter: {
    label: "Starter",
    description:
      "Core digitization for records, admissions, student/parent/staff management, fees, invoices, payment collection, notices, basic documents, and basic reports.",
    sortOrder: 1,
    publicVisible: true,
  },
  growth: {
    label: "Growth",
    description:
      "Operational academic plan with everything in Starter plus schemes of learning, lesson notes, lessons, basic examinations, question bank, Learn activation eligibility, and limited Leo AI credits.",
    sortOrder: 2,
    publicVisible: true,
  },
  enterprise: {
    label: "Enterprise",
    description:
      "Full school operating system for advanced academics, analytics, automation, priority support, higher AI/storage allowances, meeting access, audit/compliance, and custom configuration.",
    sortOrder: 3,
    publicVisible: true,
  },
};

/**
 * Subscription statuses normalised per spec §12.3.
 */
export const SUBSCRIPTION_STATUSES = [
  "draft",
  "pilot",
  "active",
  "past_due",
  "grace",
  "restricted_read_only",
  "suspended",
  "cancelled",
  "expired",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

const KNOWN_STATUSES = new Set<string>(SUBSCRIPTION_STATUSES);

export function isKnownSubscriptionStatus(s: string): s is SubscriptionStatus {
  return KNOWN_STATUSES.has(s);
}

/**
 * Legacy status migration map (read-time normalisation only — do not write old values).
 */
export const LEGACY_STATUS_MAP: Record<string, SubscriptionStatus> = {
  trial: "pilot",
  trialing: "pilot",
  archived: "expired",
  // active, grace, suspended etc. map to themselves
};

export function normaliseSubscriptionStatus(raw?: string | null): SubscriptionStatus {
  if (!raw) return "draft";
  if (isKnownSubscriptionStatus(raw)) return raw;
  const mapped = LEGACY_STATUS_MAP[raw];
  if (mapped) return mapped;
  return "draft";
}
