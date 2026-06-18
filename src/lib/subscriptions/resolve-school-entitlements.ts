/**
 * resolve-school-entitlements.ts
 *
 * Single source of truth for school subscription access.
 *
 * Returns a SchoolEntitlementSnapshot that captures:
 *   - Current subscription status and access mode
 *   - Features enabled for this school (plan + school-specific overrides)
 *   - Limits for this school (plan defaults + school-specific overrides)
 *   - Live usage counts (students, teachers, Leo credits remaining)
 *   - Transaction charge summary
 *
 * ENFORCEMENT FLAG
 * While SUBSCRIPTION_ENFORCEMENT_ENABLED !== "true", this resolver:
 *   - Still fetches subscription data (for UI display)
 *   - Returns accessMode "full" unconditionally
 *   - hasFeature() returns true for any known key
 *   - getLimit() returns null (unlimited) for all limits
 *
 * This means the app works exactly as before (fully open) but the subscription
 * data is populated and visible to school admins and platform admins.
 *
 * Spec §12.
 */

import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { UsageBalance } from "@/models/UsageBalance";
import { isSchoolPaymentReady } from "@/lib/school-payments/payment-setup";
import type { FeatureKey } from "./feature-keys";
import { FEATURE_KEYS, assertKnownFeatureKey, isKnownFeatureKey } from "./feature-keys";
import type { LimitKey } from "./limit-keys";
import { LIMIT_KEYS, DEFAULT_PLAN_LIMITS } from "./limit-keys";
import type { PlanCode } from "./plan-codes";
import { normaliseSubscriptionStatus, isKnownPlanCode } from "./plan-codes";
import { PLAN_ENTITLEMENTS } from "./plan-entitlements";
import { resolveAccessMode } from "./access-mode";
import type { SchoolAccessMode } from "./access-mode";
import { resolveTransactionChargeConfig } from "./transaction-fees";

const ENFORCEMENT_ENABLED =
  process.env.SUBSCRIPTION_ENFORCEMENT_ENABLED === "true";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TransactionChargeSummary = {
  defaultPayerMode: "payer_pays" | "school_absorbs" | "waived";
  schoolFeesRateLabel: string;
  admissionFeesRateLabel: string;
};

export type SchoolEntitlementSnapshot = {
  schoolId: string;
  schoolName: string;
  schoolStatus: string;
  paymentReady: boolean;

  subscription: {
    id: string | null;
    status: string;
    accessMode: SchoolAccessMode;
    planId: string | null;
    planCode: PlanCode | null;
    planName: string | null;
    planVersion: number | null;
    startsAt: string | null;
    endsAt: string | null;
    pilotEndsAt: string | null;
    gracePeriodEndsAt: string | null;
    effectivePriceMinor: number;
    billingCadence: string | null;
    lifecycleMode: string | null;
    billingCoverage?: Record<string, unknown> | null;
  };

  features: string[];
  limits: Record<string, number | null>;

  usage: {
    students: number;
    teachers: number;
    leoCreditsRemaining: number | null;
    meetingParticipantMinutesRemaining: number | null;
    storageBytesUsed: number;
    storageBytesLimit: number | null;
  };

  transactionChargeSummary: TransactionChargeSummary;

  /**
   * Returns true if the school has access to the given feature key.
   *
   * While SUBSCRIPTION_ENFORCEMENT_ENABLED=false → always true for known keys.
   */
  hasFeature(featureKey: string): boolean;

  /**
   * Returns the numeric limit for a limit key, or null if unlimited.
   *
   * While SUBSCRIPTION_ENFORCEMENT_ENABLED=false → always null (unlimited).
   */
  getLimit(limitKey: string): number | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeId(id: string | mongoose.Types.ObjectId): mongoose.Types.ObjectId {
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (mongoose.Types.ObjectId.isValid(id)) return new mongoose.Types.ObjectId(id);
  throw new Error(`Invalid schoolId: ${String(id)}`);
}

function buildTransactionChargeSummary(
  planCode: PlanCode | null,
  sub: Record<string, any> | null
): TransactionChargeSummary {
  const override = sub?.transactionChargeOverride ?? null;
  const resolution = resolveTransactionChargeConfig(planCode, override);
  return {
    defaultPayerMode: resolution.defaultPayerMode,
    schoolFeesRateLabel: resolution.rateLabel,
    admissionFeesRateLabel: resolution.admissionRateLabel,
  };
}

function deriveEnabledFeatures(
  planCode: PlanCode | null,
  featuresSnapshot: string[] | null | undefined,
  schoolOverrideAdd: string[] | null | undefined,
  schoolOverrideRemove: string[] | null | undefined
): string[] {
  if (!ENFORCEMENT_ENABLED) {
    // Return full feature list while enforcement is off — for UI display only.
    return Object.values(FEATURE_KEYS);
  }

  if (!planCode) return [];

  const planEntitlements = PLAN_ENTITLEMENTS[planCode] ?? {};
  const planFeatures = (Object.entries(planEntitlements) as [FeatureKey, string][])
    .filter(([, level]) => level === "YES" || level === "LIMITED")
    .map(([key]) => key);

  // Use stored snapshot if present, otherwise compute from plan
  const base: Set<string> = new Set(featuresSnapshot?.length ? featuresSnapshot : planFeatures);

  for (const key of (schoolOverrideAdd ?? [])) {
    if (isKnownFeatureKey(key)) base.add(key);
  }
  for (const key of (schoolOverrideRemove ?? [])) {
    base.delete(key);
  }

  return Array.from(base);
}

function deriveLimits(
  planCode: PlanCode | null,
  limitsSnapshot: Record<string, number | null> | null | undefined,
  schoolLimitOverrides: Record<string, number | null> | null | undefined
): Record<string, number | null> {
  if (!ENFORCEMENT_ENABLED) {
    // All limits are null (unlimited) while enforcement is off
    return Object.fromEntries(Object.values(LIMIT_KEYS).map((k) => [k, null]));
  }

  const planDefaults = planCode ? DEFAULT_PLAN_LIMITS[planCode] : {};
  const base: Record<string, number | null> = { ...planDefaults };

  // Overlay stored snapshot
  if (limitsSnapshot) {
    for (const [k, v] of Object.entries(limitsSnapshot)) {
      base[k] = v;
    }
  }

  // Overlay school-specific overrides
  if (schoolLimitOverrides) {
    for (const [k, v] of Object.entries(schoolLimitOverrides)) {
      base[k] = v;
    }
  }

  return base;
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

/**
 * Resolves the full entitlement snapshot for a school.
 *
 * Fetches from: School, SchoolSubscription, Student count, Teacher count, UsageBalance.
 * Safe to call server-side from API routes, server components, and server actions.
 *
 * Returns null only if the school does not exist.
 */
export async function resolveSchoolEntitlements(
  schoolId: string | mongoose.Types.ObjectId
): Promise<SchoolEntitlementSnapshot | null> {
  await connectToDatabase();

  const schoolIdObj = normalizeId(String(schoolId));

  const [school, sub, students, teachers] = await Promise.all([
    School.findById(schoolIdObj)
      .select("name status createdBy bank billing")
      .lean<any>(),
    SchoolSubscription.findOne({ schoolId: schoolIdObj }).lean<any>(),
    Student.countDocuments({ schoolId: schoolIdObj }),
    Teacher.countDocuments({ schoolId: schoolIdObj, status: "active" }),
  ]);

  if (!school) return null;

  // ---------- Normalise subscription ----------
  const rawStatus = sub?.status ?? "draft";
  const status = normaliseSubscriptionStatus(rawStatus);

  // planCode — handle legacy tierCode field
  const rawPlanCode: string | null = sub?.tierCode ?? null;
  const planCode: PlanCode | null =
    rawPlanCode && isKnownPlanCode(rawPlanCode) ? rawPlanCode : null;

  const accessMode = resolveAccessMode({
    status,
    planCode,
    gracePeriodEndsAt: sub?.gracePeriodEndsAt?.toISOString() ?? null,
    pilotEndsAt: sub?.pilotEndsAt?.toISOString() ?? null,
    endsAt: sub?.endsAt?.toISOString() ?? null,
  });

  // Manual override from platform admin
  const resolvedAccessMode: SchoolAccessMode =
    (sub?.manualAccessModeOverride as SchoolAccessMode | null) ?? accessMode;

  // ---------- Features ----------
  const features = deriveEnabledFeatures(
    planCode,
    sub?.featuresSnapshot ?? null,
    null,
    null
  );

  // ---------- Limits ----------
  const limits = deriveLimits(
    planCode,
    sub?.includedLimitsSnapshot ?? null,
    sub?.schoolOverrides?.limits ?? null,
  );

  // ---------- Usage balances ----------
  let leoCreditsRemaining: number | null = null;
  let meetingParticipantMinutesRemaining: number | null = null;
  let storageBytesUsed = 0;

  try {
    const balances = await UsageBalance.find({ schoolId: schoolIdObj }).lean<any[]>();
    for (const b of balances) {
      const remaining =
        (b.includedQuantity ?? 0) +
        (b.purchasedQuantity ?? 0) +
        (b.adjustedQuantity ?? 0) -
        (b.usedQuantity ?? 0);

      if (b.balanceType === "leo_credits") {
        leoCreditsRemaining = (leoCreditsRemaining ?? 0) + remaining;
      } else if (b.balanceType === "meeting_participant_minutes") {
        meetingParticipantMinutesRemaining =
          (meetingParticipantMinutesRemaining ?? 0) + remaining;
      } else if (b.balanceType === "storage_bytes") {
        storageBytesUsed += b.usedQuantity ?? 0;
      }
    }
  } catch {
    // Non-blocking: usage balance errors should not prevent entitlement resolution.
  }

  const storageBytesLimit = limits[LIMIT_KEYS.maxStorageBytes] ?? null;

  // ---------- Snapshot ----------
  const snapshot: SchoolEntitlementSnapshot = {
    schoolId: String(school._id),
    schoolName: school.name ?? "Unnamed School",
    schoolStatus: school.status ?? "pending",
    paymentReady: isSchoolPaymentReady(school),

    subscription: {
      id: sub ? String(sub._id) : null,
      status,
      accessMode: resolvedAccessMode,
      planId: sub?.tierId ? String(sub.tierId) : null,
      planCode,
      planName: sub?.tierName ?? null,
      planVersion: sub?.tierVersion ?? null,
      startsAt: sub?.startsAt ? (sub.startsAt as Date).toISOString() : null,
      endsAt: sub?.endsAt ? (sub.endsAt as Date).toISOString() : null,
      pilotEndsAt: sub?.pilotEndsAt ? (sub.pilotEndsAt as Date).toISOString() : null,
      gracePeriodEndsAt: sub?.gracePeriodEndsAt
        ? (sub.gracePeriodEndsAt as Date).toISOString()
        : null,
      effectivePriceMinor: sub?.effectivePriceMinor ?? 0,
      billingCadence: sub?.billingCadence ?? null,
      lifecycleMode: sub?.lifecycleMode ?? null,
      billingCoverage: sub?.billingCoverage ?? null,
    },

    features,
    limits,

    usage: {
      students: Math.max(0, students),
      teachers: Math.max(0, teachers),
      leoCreditsRemaining,
      meetingParticipantMinutesRemaining,
      storageBytesUsed,
      storageBytesLimit,
    },

    transactionChargeSummary: buildTransactionChargeSummary(planCode, sub),

    hasFeature(featureKey: string): boolean {
      // Validate key
      if (!assertKnownFeatureKey(featureKey)) return false;

      if (!ENFORCEMENT_ENABLED) return true;

      // Access mode check
      if (resolvedAccessMode === "suspended") return false;

      return features.includes(featureKey);
    },

    getLimit(limitKey: string): number | null {
      if (!ENFORCEMENT_ENABLED) return null; // unlimited while enforcement is off

      return limits[limitKey] ?? null;
    },
  };

  return snapshot;
}

// ---------------------------------------------------------------------------
// Convenience wrappers for API route guards
// ---------------------------------------------------------------------------

/**
 * Resolves entitlements and checks a single feature key.
 * Returns null if the school doesn't exist, throws on unknown feature key.
 *
 * While SUBSCRIPTION_ENFORCEMENT_ENABLED=false, always returns true if school exists.
 */
export async function schoolHasFeature(
  schoolId: string | mongoose.Types.ObjectId,
  featureKey: FeatureKey
): Promise<boolean> {
  const snapshot = await resolveSchoolEntitlements(schoolId);
  if (!snapshot) return false;
  return snapshot.hasFeature(featureKey);
}

/**
 * Resolves entitlements and returns the limit for a key.
 * Returns null (unlimited) if the school doesn't exist or enforcement is off.
 */
export async function getSchoolLimit(
  schoolId: string | mongoose.Types.ObjectId,
  limitKey: LimitKey
): Promise<number | null> {
  const snapshot = await resolveSchoolEntitlements(schoolId);
  if (!snapshot) return null;
  return snapshot.getLimit(limitKey);
}
