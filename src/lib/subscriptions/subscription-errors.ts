/**
 * subscription-errors.ts
 *
 * Structured error types for subscription enforcement.
 *
 * Spec §19.1 — Structured Errors.
 *
 * Usage:
 *   throw new FeatureGatedError(FEATURE_KEYS.AI_LEO, "enterprise");
 *   throw new LimitExceededError(LIMIT_KEYS.maxStudents, 300, 500);
 *   throw new AccessModeError("restricted_read_only");
 *   throw new UsageExhaustedError("leo_credits", 0, 100);
 *
 * API handlers can use toApiResponse() to produce consistent JSON.
 */

import type { FeatureKey } from "./feature-keys";
import type { LimitKey } from "./limit-keys";
import type { SchoolAccessMode } from "./access-mode";

// ---------------------------------------------------------------------------
// Base class
// ---------------------------------------------------------------------------

export class SubscriptionError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(message: string, code: string, httpStatus = 403) {
    super(message);
    this.name = "SubscriptionError";
    this.code = code;
    this.httpStatus = httpStatus;
  }

  toApiResponse(): { success: false; error: string; code: string; httpStatus: number } {
    return {
      success: false,
      error: this.message,
      code: this.code,
      httpStatus: this.httpStatus,
    };
  }
}

// ---------------------------------------------------------------------------
// Feature gate error
// ---------------------------------------------------------------------------

/**
 * Thrown when a school's plan doesn't include the required feature.
 *
 * code: "FEATURE_NOT_INCLUDED"
 */
export class FeatureGatedError extends SubscriptionError {
  readonly featureKey: FeatureKey;
  readonly requiredPlan?: string;

  constructor(featureKey: FeatureKey, requiredPlan?: string) {
    const message = requiredPlan
      ? `Feature "${featureKey}" requires the "${requiredPlan}" plan or higher.`
      : `Feature "${featureKey}" is not included in your current plan.`;
    super(message, "FEATURE_NOT_INCLUDED", 403);
    this.name = "FeatureGatedError";
    this.featureKey = featureKey;
    this.requiredPlan = requiredPlan;
  }

  override toApiResponse() {
    return {
      ...super.toApiResponse(),
      featureKey: this.featureKey,
      requiredPlan: this.requiredPlan ?? null,
    };
  }
}

// ---------------------------------------------------------------------------
// Limit exceeded error
// ---------------------------------------------------------------------------

/**
 * Thrown when a school's usage has hit a plan limit.
 *
 * code: "LIMIT_EXCEEDED"
 */
export class LimitExceededError extends SubscriptionError {
  readonly limitKey: LimitKey;
  readonly current: number;
  readonly limit: number;

  constructor(limitKey: LimitKey, current: number, limit: number) {
    super(
      `Limit exceeded for "${limitKey}": current ${current} / limit ${limit}.`,
      "LIMIT_EXCEEDED",
      403
    );
    this.name = "LimitExceededError";
    this.limitKey = limitKey;
    this.current = current;
    this.limit = limit;
  }

  override toApiResponse() {
    return {
      ...super.toApiResponse(),
      limitKey: this.limitKey,
      current: this.current,
      limit: this.limit,
    };
  }
}

// ---------------------------------------------------------------------------
// Access mode error
// ---------------------------------------------------------------------------

/**
 * Thrown when the school's current access mode prevents the action.
 *
 * code: "ACCESS_MODE_RESTRICTED"
 */
export class AccessModeError extends SubscriptionError {
  readonly accessMode: SchoolAccessMode;

  constructor(accessMode: SchoolAccessMode) {
    const modeMessages: Partial<Record<SchoolAccessMode, string>> = {
      restricted_read_only: "Your school's subscription is in read-only mode. Upgrade or renew to continue.",
      suspended: "Your school's subscription has been suspended. Contact EduSentrix.",
      grace: "Your school's subscription has expired and is in its grace period. Please renew promptly.",
    };
    super(
      modeMessages[accessMode] ?? `Access restricted (mode: ${accessMode}).`,
      "ACCESS_MODE_RESTRICTED",
      403
    );
    this.name = "AccessModeError";
    this.accessMode = accessMode;
  }

  override toApiResponse() {
    return {
      ...super.toApiResponse(),
      accessMode: this.accessMode,
    };
  }
}

// ---------------------------------------------------------------------------
// Usage exhausted error
// ---------------------------------------------------------------------------

/**
 * Thrown when a metered usage type is fully consumed.
 *
 * code: "USAGE_EXHAUSTED"
 */
export class UsageExhaustedError extends SubscriptionError {
  readonly usageType: string;
  readonly remaining: number;
  readonly limit: number;

  constructor(usageType: string, remaining: number, limit: number) {
    super(
      `Usage for "${usageType}" exhausted. ${remaining} remaining / ${limit} total.`,
      "USAGE_EXHAUSTED",
      429
    );
    this.name = "UsageExhaustedError";
    this.usageType = usageType;
    this.remaining = remaining;
    this.limit = limit;
  }

  override toApiResponse() {
    return {
      ...super.toApiResponse(),
      usageType: this.usageType,
      remaining: this.remaining,
      limit: this.limit,
    };
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Type guard for SubscriptionError subclasses.
 */
export function isSubscriptionError(err: unknown): err is SubscriptionError {
  return err instanceof SubscriptionError;
}
