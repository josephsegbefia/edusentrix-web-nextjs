/**
 * Subscription enforcement guard helpers for API routes.
 *
 * While SUBSCRIPTION_ENFORCEMENT_ENABLED=false, all guards are no-ops.
 *
 * Usage (in an API route handler):
 *
 *   const guard = await requireSchoolFeature(schoolId, FEATURE_KEYS.ACADEMICS_SCHEMES);
 *   if (!guard.allowed) return NextResponse.json({ success: false, error: guard.reason }, { status: 403 });
 *
 * Spec §13.1.
 */

import type { FeatureKey } from "./feature-keys";
import type { LimitKey } from "./limit-keys";
import { resolveSchoolEntitlements } from "./resolve-school-entitlements";
import type { SchoolAccessMode } from "./access-mode";
import { canCreateInAccessMode } from "./access-mode";
import mongoose from "mongoose";

const DENIED_ACCESS_AUDIT_ENABLED =
  process.env.SUBSCRIPTION_AUDIT_LOGS_ENABLED === "true";

const ENFORCEMENT_ENABLED =
  process.env.SUBSCRIPTION_ENFORCEMENT_ENABLED === "true";

const API_GATES_ENABLED =
  process.env.SUBSCRIPTION_API_GATES_ENABLED === "true";

export type GuardResult =
  | { allowed: true; snapshot?: import("./resolve-school-entitlements").SchoolEntitlementSnapshot }
  | { allowed: false; reason: string; statusCode: 402 | 403 | 429 };

// ---------------------------------------------------------------------------
// Feature guard
// ---------------------------------------------------------------------------

/**
 * Checks whether a school has entitlement for a feature.
 * Use in API routes and server actions that perform gated operations.
 */
export async function requireSchoolFeature(
  schoolId: string | mongoose.Types.ObjectId,
  featureKey: FeatureKey
): Promise<GuardResult> {
  if (!ENFORCEMENT_ENABLED || !API_GATES_ENABLED) {
    // Gates are off — always pass
    return { allowed: true };
  }

  const snapshot = await resolveSchoolEntitlements(schoolId);

  if (!snapshot) {
    return {
      allowed: false,
      reason: "School not found.",
      statusCode: 403,
    };
  }

  if (!snapshot.hasFeature(featureKey)) {
    if (DENIED_ACCESS_AUDIT_ENABLED) {
      // Fire-and-forget audit log — do not await
      import("./record-event").then(({ recordSubscriptionEvent }) => {
        recordSubscriptionEvent({
          schoolId,
          subscriptionId: snapshot.subscription.subscriptionId ?? null,
          eventType: "entitlement_audit",
          summary: `Access denied: feature "${featureKey}" not in plan "${snapshot.subscription.planCode ?? "unknown"}".`,
          metadata: { featureKey, planCode: snapshot.subscription.planCode ?? null, denyReason: "FEATURE_NOT_INCLUDED" },
        }).catch(() => {});
      }).catch(() => {});
    }
    return {
      allowed: false,
      reason: `Your current plan does not include this feature. Upgrade your subscription to access it.`,
      statusCode: 403,
    };
  }

  return { allowed: true, snapshot };
}

// ---------------------------------------------------------------------------
// Limit guard
// ---------------------------------------------------------------------------

export type LimitGuardResult =
  | { allowed: true; current: number; limit: number | null }
  | { allowed: false; reason: string; current: number; limit: number | null; statusCode: 403 | 429 };

/**
 * Checks whether a school is under a numeric limit.
 * increment = how many units are being added (usually 1).
 */
export async function enforceSchoolLimit(opts: {
  schoolId: string | mongoose.Types.ObjectId;
  limitKey: LimitKey;
  /** Current count — if not provided, fetched from the snapshot. */
  current?: number;
  increment?: number;
}): Promise<LimitGuardResult> {
  const { schoolId, limitKey, increment = 1 } = opts;

  if (!ENFORCEMENT_ENABLED || !API_GATES_ENABLED) {
    return { allowed: true, current: opts.current ?? 0, limit: null };
  }

  const snapshot = await resolveSchoolEntitlements(schoolId);

  if (!snapshot) {
    return {
      allowed: false,
      reason: "School not found.",
      current: opts.current ?? 0,
      limit: null,
      statusCode: 403,
    };
  }

  const limit = snapshot.getLimit(limitKey);
  const current = opts.current ?? 0;

  if (limit !== null && current + increment > limit) {
    if (DENIED_ACCESS_AUDIT_ENABLED) {
      import("./record-event").then(({ recordSubscriptionEvent }) => {
        recordSubscriptionEvent({
          schoolId,
          eventType: "entitlement_audit",
          summary: `Limit exceeded: "${limitKey}" at ${current + increment}/${limit}.`,
          metadata: { limitKey, current, limit, increment, denyReason: "LIMIT_EXCEEDED" },
        }).catch(() => {});
      }).catch(() => {});
    }
    return {
      allowed: false,
      reason: `You have reached the ${limitKey} limit for your current plan (${limit}). Upgrade your subscription to increase this limit.`,
      current,
      limit,
      statusCode: 429,
    };
  }

  return { allowed: true, current, limit };
}

// ---------------------------------------------------------------------------
// Access mode guard
// ---------------------------------------------------------------------------

/**
 * Checks whether the school's access mode allows mutations (create/edit).
 */
export async function requireSchoolWriteAccess(
  schoolId: string | mongoose.Types.ObjectId
): Promise<GuardResult & { accessMode?: SchoolAccessMode }> {
  if (!ENFORCEMENT_ENABLED || !API_GATES_ENABLED) {
    return { allowed: true };
  }

  const snapshot = await resolveSchoolEntitlements(schoolId);

  if (!snapshot) {
    return { allowed: false, reason: "School not found.", statusCode: 403 };
  }

  const { accessMode } = snapshot.subscription;

  if (!canCreateInAccessMode(accessMode)) {
    const messages: Record<SchoolAccessMode, string> = {
      full: "",
      pilot_limited: "",
      grace: "",
      restricted_read_only:
        "Your subscription has expired. You can view existing records but cannot make changes. Please renew to restore full access.",
      suspended:
        "Your school account is suspended. Please contact the EduSentrix platform team.",
    };

    if (DENIED_ACCESS_AUDIT_ENABLED) {
      import("./record-event").then(({ recordSubscriptionEvent }) => {
        recordSubscriptionEvent({
          schoolId,
          eventType: "entitlement_audit",
          summary: `Write access denied: school in "${accessMode}" mode.`,
          metadata: { accessMode, denyReason: "ACCESS_MODE_RESTRICTED" },
        }).catch(() => {});
      }).catch(() => {});
    }

    return {
      allowed: false,
      reason: messages[accessMode] ?? "Access denied.",
      statusCode: 403,
      accessMode,
    };
  }

  return { allowed: true, snapshot, accessMode };
}

// ---------------------------------------------------------------------------
// Usage credits guard (Leo AI, meetings, etc.)
// ---------------------------------------------------------------------------

/**
 * Checks whether the school has sufficient usage credits for an action.
 * Requires SUBSCRIPTION_USAGE_GATES_ENABLED=true to enforce.
 */
export async function requireUsageCredits(opts: {
  schoolId: string | mongoose.Types.ObjectId;
  balanceType: "leo_credits" | "meeting_participant_minutes";
  quantity: number;
}): Promise<LimitGuardResult> {
  const USAGE_GATES_ENABLED =
    process.env.SUBSCRIPTION_USAGE_GATES_ENABLED === "true";

  if (!ENFORCEMENT_ENABLED || !API_GATES_ENABLED || !USAGE_GATES_ENABLED) {
    return { allowed: true, current: 0, limit: null };
  }

  const snapshot = await resolveSchoolEntitlements(opts.schoolId);

  if (!snapshot) {
    return {
      allowed: false,
      reason: "School not found.",
      current: 0,
      limit: null,
      statusCode: 403,
    };
  }

  const remaining =
    opts.balanceType === "leo_credits"
      ? snapshot.usage.leoCreditsRemaining
      : snapshot.usage.meetingParticipantMinutesRemaining;

  // null remaining = unlimited (balance record not yet created for this period)
  if (remaining === null) {
    return { allowed: true, current: 0, limit: null };
  }

  if (remaining < opts.quantity) {
    const label = opts.balanceType === "leo_credits" ? "Leo AI credits" : "meeting participant-minutes";
    return {
      allowed: false,
      reason: `You don't have enough ${label} for this action. You have ${remaining} remaining. Purchase additional credits to continue.`,
      current: remaining,
      limit: null,
      statusCode: 429,
    };
  }

  return { allowed: true, current: remaining, limit: null };
}
