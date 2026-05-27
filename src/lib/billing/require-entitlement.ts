import mongoose from "mongoose";
import {
  getSchoolSubscriptionSnapshot,
  type SubscriptionSnapshot,
} from "@/lib/billing/entitlements";
import type {
  SubscriptionFeatureKey,
  SubscriptionLimitKey,
} from "@/lib/billing/feature-access";

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

/** No subscription entitlement checks — returns snapshot when school exists. */
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
      "School not found.",
      "SUBSCRIPTION_NOT_FOUND"
    );
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
