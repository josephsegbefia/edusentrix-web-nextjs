import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { isSchoolPaymentReady } from "@/lib/school-payments/payment-setup";
import {
  type SubscriptionFeatureKey,
  type SubscriptionLimitKey,
  type SubscriptionLimits,
} from "@/lib/billing/feature-access";
import type {
  BillingCadence,
  SubscriptionLifecycleMode,
  SubscriptionStatus,
} from "@/lib/platform-billing/subscription-pricing";
import type { SchoolAccessMode } from "@/lib/billing/resolve-school-access-mode";
import type { UsageEventCategory } from "@/models/UsageEvent";
import type { PlatformBillingProvider } from "@/lib/platform-billing/providers";

export type SubscriptionSnapshot = {
  schoolId: string;
  schoolName: string;
  schoolStatus: string;
  paymentReady: boolean;
  subscription: {
    id: string | null;
    status: SubscriptionStatus;
    normalizedStatus: SubscriptionStatus;
    accessMode: SchoolAccessMode;
    tierId: string | null;
    tierCode: string | null;
    tierName: string | null;
    tierVersion: number | null;
    lifecycleMode: SubscriptionLifecycleMode | null;
    billingCadence: BillingCadence | null;
    startsAt: string | null;
    endsAt: string | null;
    trialEndsAt: string | null;
    gracePeriodEndsAt: string | null;
    basePriceMinor: number;
    manualPriceOverrideMinor: number | null;
    discountMode: "none" | "percent" | "fixed";
    discountValue: number | null;
    effectivePriceMinor: number;
    pilotEndsAt: string | null;
  };
  pricing: {
    baseTierPriceMinor: number;
    effectiveBasePriceMinor: number;
    discountAmountMinor: number;
    finalPriceMinor: number;
  };
  features: string[];
  limits: SubscriptionLimits;
  usage: {
    students: number;
    teachers: number;
  };
  hasFeature: (featureKey: SubscriptionFeatureKey) => boolean;
};

export type TrackUsageInput = {
  schoolId: string | mongoose.Types.ObjectId;
  provider: PlatformBillingProvider;
  category?: UsageEventCategory;
  metricKey: string;
  quantity?: number;
  unitLabel?: string;
  unitCostMinor?: number;
  estimatedCostMinor?: number;
  actorId?: mongoose.Types.ObjectId | null;
  actorEmail?: string | null;
  entityType?: string | null;
  entityId?: mongoose.Types.ObjectId | null;
  metadata?: Record<string, unknown> | null;
  allocationMethod?: "direct" | "weighted" | "manual";
  sourceType?: "manual" | "provider_sync" | "system_estimate";
  notes?: string | null;
};

const UNLIMITED_LIMITS: SubscriptionLimits = {
  maxStudents: null,
  maxTeachers: null,
  maxInvitationsPerMonth: null,
  maxAICallsPerMonth: null,
  maxStorageBytes: null,
};

function normalizeSchoolId(schoolId: string | mongoose.Types.ObjectId) {
  return typeof schoolId === "string"
    ? new mongoose.Types.ObjectId(schoolId)
    : schoolId;
}

/** Lightweight school context — no subscription tier gating. */
export async function getSchoolSubscriptionSnapshot(
  schoolId: string | mongoose.Types.ObjectId
): Promise<SubscriptionSnapshot | null> {
  await connectToDatabase();

  const schoolIdObj = normalizeSchoolId(schoolId);
  const [school, students, teachers] = await Promise.all([
    School.findById(schoolIdObj)
      .select("name status createdBy bank billing")
      .lean<{
        _id: mongoose.Types.ObjectId;
        name?: string;
        status?: string;
        bank?: unknown;
        billing?: unknown;
      } | null>(),
    Student.countDocuments({ schoolId: schoolIdObj }),
    Teacher.countDocuments({ schoolId: schoolIdObj, status: "active" }),
  ]);

  if (!school) return null;

  return {
    schoolId: String(school._id),
    schoolName: school.name || "Unnamed School",
    schoolStatus: school.status || "pending",
    paymentReady: isSchoolPaymentReady(school),
    subscription: {
      id: null,
      status: "active",
      normalizedStatus: "active",
      accessMode: "full",
      tierId: null,
      tierCode: null,
      tierName: null,
      tierVersion: null,
      lifecycleMode: null,
      billingCadence: null,
      startsAt: null,
      endsAt: null,
      trialEndsAt: null,
      gracePeriodEndsAt: null,
      basePriceMinor: 0,
      manualPriceOverrideMinor: null,
      discountMode: "none",
      discountValue: null,
      effectivePriceMinor: 0,
      pilotEndsAt: null,
    },
    pricing: {
      baseTierPriceMinor: 0,
      effectiveBasePriceMinor: 0,
      discountAmountMinor: 0,
      finalPriceMinor: 0,
    },
    features: [],
    limits: UNLIMITED_LIMITS,
    usage: {
      students: Math.max(0, students),
      teachers: Math.max(0, teachers),
    },
    hasFeature() {
      return true;
    },
  };
}

export async function hasFeature(
  _schoolId: string | mongoose.Types.ObjectId,
  _featureKey: SubscriptionFeatureKey
) {
  return true;
}

export async function checkLimit(
  _schoolId: string | mongoose.Types.ObjectId,
  _limitKey: SubscriptionLimitKey,
  _increment = 1
) {
  return { allowed: true, current: 0, limit: null };
}

export function inferUsageCategory(input: {
  provider: PlatformBillingProvider;
  metricKey: string;
}): UsageEventCategory {
  if (input.provider === "openai" || input.metricKey.startsWith("ai_")) {
    return "ai";
  }
  if (
    input.provider === "uploadthing" ||
    input.provider === "storage" ||
    input.metricKey.includes("storage") ||
    input.metricKey.includes("uploaded")
  ) {
    return "storage";
  }
  if (input.provider === "paystack" || input.metricKey.includes("payment")) {
    return "payment";
  }
  if (input.provider === "email" || input.metricKey.includes("notification")) {
    return "notification";
  }
  if (input.metricKey.includes("invitation")) return "invitation";
  if (input.metricKey.includes("export")) return "export";
  return "other";
}

/** No-op — usage metering removed with subscription gating. */
export async function trackUsage(_input: TrackUsageInput) {
  return null;
}
