/**
 * School subscription access-mode resolver.
 *
 * Access modes (spec §12.2):
 *   full                 — active subscription, all plan features available.
 *   pilot_limited        — Pilot onboarding mode; only explicitly enabled features available.
 *   grace                — subscription expired, grace period active. Most features still accessible.
 *   restricted_read_only — past grace period; reads allowed, mutations blocked on gated modules.
 *   suspended            — most access blocked; only billing/support pages accessible.
 *
 * Status → access-mode mapping follows spec §12.3 and §13.5.
 *
 * ENFORCEMENT NOTE: While SUBSCRIPTION_ENFORCEMENT_ENABLED=false (env flag),
 * resolveAccessMode() always returns "full" to preserve current app behaviour.
 */

import type { SubscriptionStatus } from "./plan-codes";
import type { PlanCode } from "./plan-codes";

export type SchoolAccessMode =
  | "full"
  | "pilot_limited"
  | "grace"
  | "restricted_read_only"
  | "suspended";

/** Inputs required to resolve an access mode. */
export interface AccessModeInput {
  status: SubscriptionStatus;
  planCode: PlanCode | null | undefined;
  /** ISO string or null */
  gracePeriodEndsAt: string | null | undefined;
  /** ISO string or null */
  pilotEndsAt: string | null | undefined;
  /** ISO string or null */
  endsAt: string | null | undefined;
  now?: Date;
}

/**
 * Maps a raw subscription status + dates to a stable access mode.
 *
 * Call this at the resolver level, not inside component code.
 */
export function resolveAccessMode(input: AccessModeInput): SchoolAccessMode {
  // Enforcement gate — while the env flag is off, always return full.
  if (process.env.SUBSCRIPTION_ENFORCEMENT_ENABLED !== "true") {
    return "full";
  }

  const { status, planCode } = input;
  const now = input.now ?? new Date();

  switch (status) {
    case "active":
      return "full";

    case "pilot": {
      // Pilot is limited unless the school has all modules explicitly enabled.
      // If pilotEndsAt is in the future (or not set), access mode is pilot_limited.
      if (input.pilotEndsAt) {
        const endsAt = new Date(input.pilotEndsAt);
        if (endsAt <= now) {
          // Pilot period ended — drop into grace
          return "grace";
        }
      }
      return planCode === "pilot" ? "pilot_limited" : "full";
    }

    case "past_due":
      // Allow access while billing is being settled; treat like grace.
      return "grace";

    case "grace": {
      if (input.gracePeriodEndsAt) {
        const graceEnd = new Date(input.gracePeriodEndsAt);
        if (graceEnd <= now) {
          return "restricted_read_only";
        }
      }
      return "grace";
    }

    case "restricted_read_only":
      return "restricted_read_only";

    case "suspended":
      return "suspended";

    case "cancelled":
    case "expired": {
      // Check if still inside a grace window even for cancelled/expired
      if (input.gracePeriodEndsAt) {
        const graceEnd = new Date(input.gracePeriodEndsAt);
        if (graceEnd > now) {
          return "grace";
        }
      }
      return "restricted_read_only";
    }

    case "draft":
    default:
      // Draft subscription or unknown status — deny until active.
      return "restricted_read_only";
  }
}

/**
 * Whether a given access mode allows new record creation / mutations.
 */
export function canCreateInAccessMode(mode: SchoolAccessMode): boolean {
  return mode === "full" || mode === "pilot_limited" || mode === "grace";
}

/**
 * Whether a given access mode allows read access.
 */
export function canReadInAccessMode(mode: SchoolAccessMode): boolean {
  return mode !== "suspended";
}

/**
 * Whether a given access mode still allows collecting fee payments (revenue-critical).
 * Spec: allow fee payment in grace and read-only mode so schools can still receive money.
 */
export function canCollectPaymentsInAccessMode(mode: SchoolAccessMode): boolean {
  return mode !== "suspended";
}

/**
 * Whether Leo AI and expensive AI operations are allowed.
 */
export function canUseAiInAccessMode(mode: SchoolAccessMode): boolean {
  return mode === "full" || mode === "pilot_limited";
}

/**
 * Human-readable label for an access mode — used in banners.
 */
export const ACCESS_MODE_LABELS: Record<SchoolAccessMode, string> = {
  full: "Active",
  pilot_limited: "Pilot",
  grace: "Grace Period",
  restricted_read_only: "Read-only",
  suspended: "Suspended",
};

/**
 * Banner message shown to school admins based on access mode.
 * Returns null when no banner is needed (full access).
 */
export function getAccessModeBannerMessage(
  mode: SchoolAccessMode,
  gracePeriodEndsAt?: string | null
): string | null {
  switch (mode) {
    case "grace": {
      const dateStr = gracePeriodEndsAt
        ? ` until ${new Date(gracePeriodEndsAt).toLocaleDateString("en-GH", { dateStyle: "medium" })}`
        : "";
      return `Your subscription has expired. You have grace-period access${dateStr}. Please renew to restore full access.`;
    }
    case "restricted_read_only":
      return "Your subscription has expired and the grace period has ended. You can view existing records and collect fees but cannot make changes to other data. Please renew your subscription.";
    case "suspended":
      return "Your school account has been suspended. Please contact the EduSentrix platform team for assistance.";
    case "pilot_limited":
      return "Your school is on a Pilot plan. Some features may be limited. Contact your EduSentrix representative for more information.";
    default:
      return null;
  }
}
