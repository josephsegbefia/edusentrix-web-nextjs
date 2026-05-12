import mongoose from "mongoose";
import {
  getSchoolSubscriptionSnapshot,
  type SubscriptionSnapshot,
} from "@/lib/billing/entitlements";
import { checkUsageLimit } from "@/lib/billing/check-usage-limit";
import type {
  SubscriptionFeatureKey,
  SubscriptionLimitKey,
} from "@/lib/billing/feature-access";

const EXPENSIVE_ALLOWED_ACCESS_MODES = new Set([
  "full",
  "trial_limited",
  "pilot_limited",
]);

export class EntitlementError extends Error {
  statusCode = 403;

  constructor(
    message: string,
    public readonly code:
      | "SUBSCRIPTION_NOT_FOUND"
      | "FEATURE_NOT_INCLUDED"
      | "ACCESS_MODE_BLOCKED"
      | "USAGE_LIMIT_EXCEEDED",
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "EntitlementError";
  }
}

export async function requireEntitlement(input: {
  schoolId: string | mongoose.Types.ObjectId;
  featureKey?: SubscriptionFeatureKey;
  limitKey?: SubscriptionLimitKey;
  increment?: number;
  expensive?: boolean;
  snapshot?: SubscriptionSnapshot | null;
}) {
  const snapshot =
    input.snapshot ?? (await getSchoolSubscriptionSnapshot(input.schoolId));

  if (!snapshot) {
    throw new EntitlementError(
      "No subscription was found for this school.",
      "SUBSCRIPTION_NOT_FOUND"
    );
  }

  const accessMode = snapshot.subscription.accessMode;
  if (input.expensive && !EXPENSIVE_ALLOWED_ACCESS_MODES.has(accessMode)) {
    throw new EntitlementError(
      "This action is not available in the current subscription state.",
      "ACCESS_MODE_BLOCKED",
      { accessMode }
    );
  }

  if (input.featureKey && !snapshot.hasFeature(input.featureKey)) {
    throw new EntitlementError(
      "This feature is not included in the current subscription.",
      "FEATURE_NOT_INCLUDED",
      {
        featureKey: input.featureKey,
        accessMode,
        tierCode: snapshot.subscription.tierCode,
      }
    );
  }

  if (input.limitKey) {
    const decision = await checkUsageLimit({
      schoolId: input.schoolId,
      limitKey: input.limitKey,
      increment: input.increment,
      expensive: input.expensive,
      snapshot,
    });

    if (!decision.allowed) {
      throw new EntitlementError(
        decision.reason === "access_mode_blocked"
          ? "This action is not available in the current subscription state."
          : "This action would exceed the current subscription limit.",
        decision.reason === "access_mode_blocked"
          ? "ACCESS_MODE_BLOCKED"
          : "USAGE_LIMIT_EXCEEDED",
        {
          limitKey: input.limitKey,
          current: decision.current,
          limit: decision.limit,
          accessMode: decision.accessMode,
        }
      );
    }
  }

  return snapshot;
}

export function entitlementErrorResponse(error: unknown) {
  if (!(error instanceof EntitlementError)) return null;

  return {
    success: false,
    error: error.message,
    code: error.code,
    details: error.details || null,
  };
}
