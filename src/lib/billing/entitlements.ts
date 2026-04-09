import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getCurrentMonthRange } from "@/lib/platform-billing/period-range";
import { computeSubscriptionPricing } from "@/lib/platform-billing/subscription-pricing";
import { School } from "@/models/School";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { SubscriptionTier } from "@/models/SubscriptionTier";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { UsageMetric } from "@/models/UsageMetric";
import type { PlatformBillingProvider } from "@/lib/platform-billing/providers";
import { isSchoolPaymentReady } from "@/lib/school-payments/payment-setup";
import {
  hasTierFeature,
  resolveTierLimits,
  type SubscriptionFeatureKey,
  type SubscriptionLimitKey,
  type SubscriptionLimits,
} from "@/lib/billing/feature-access";

export type SubscriptionSnapshot = {
  schoolId: string;
  schoolName: string;
  schoolStatus: string;
  paymentReady: boolean;
  subscription: {
    id: string | null;
    status: "draft" | "trial" | "active" | "suspended" | "cancelled";
    tierId: string | null;
    tierCode: string | null;
    tierName: string | null;
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
  metricKey: string;
  quantity?: number;
  unitLabel?: string;
  unitCostMinor?: number;
  estimatedCostMinor?: number;
  actorId?: mongoose.Types.ObjectId | null;
  actorEmail?: string | null;
  allocationMethod?: "direct" | "weighted" | "manual";
  sourceType?: "manual" | "provider_sync" | "system_estimate";
  notes?: string | null;
};

function normalizeSchoolId(schoolId: string | mongoose.Types.ObjectId) {
  return typeof schoolId === "string"
    ? new mongoose.Types.ObjectId(schoolId)
    : schoolId;
}

export async function getSchoolSubscriptionSnapshot(
  schoolId: string | mongoose.Types.ObjectId
): Promise<SubscriptionSnapshot | null> {
  await connectToDatabase();

  const schoolIdObj = normalizeSchoolId(schoolId);
  const [school, subscription, students, teachers] = await Promise.all([
    School.findById(schoolIdObj)
      .select("name status createdBy bank billing")
      .lean<{
        _id: mongoose.Types.ObjectId;
        name?: string;
        status?: string;
        createdBy?: mongoose.Types.ObjectId | null;
        bank?: {
          bankName?: string | null;
          branchName?: string | null;
          sortCode?: string | null;
          accountName?: string | null;
          accountNumber?: string | null;
        } | null;
        billing?: {
          status?: "unprovisioned" | "provisioned" | "failed" | null;
          paymentSetup?: {
            status?:
              | "not_started"
              | "awaiting_billing_owner"
              | "details_submitted"
              | "pending_provisioning"
              | "review_required"
              | "provisioned"
              | "failed"
              | null;
            ownerUserId?: mongoose.Types.ObjectId | null;
            ownerName?: string | null;
            ownerEmail?: string | null;
          } | null;
          paystack?: {
            subaccountCode?: string | null;
            subaccountId?: string | null;
            lastError?: string | null;
          } | null;
        };
      } | null>(),
    SchoolSubscription.findOne({ schoolId: schoolIdObj })
      .select(
        "tierId tierCode tierName status basePriceMinor manualPriceOverrideMinor discountMode discountValue effectivePriceMinor pilotEndsAt"
      )
      .lean<{
        _id: mongoose.Types.ObjectId;
        tierId?: mongoose.Types.ObjectId | null;
        tierCode?: string | null;
        tierName?: string | null;
        status?: "draft" | "trial" | "active" | "suspended" | "cancelled";
        basePriceMinor?: number;
        manualPriceOverrideMinor?: number | null;
        discountMode?: "none" | "percent" | "fixed";
        discountValue?: number | null;
        effectivePriceMinor?: number;
        pilotEndsAt?: Date | null;
      } | null>(),
    Student.countDocuments({ schoolId: schoolIdObj }),
    Teacher.countDocuments({ schoolId: schoolIdObj, status: "active" }),
  ]);

  if (!school) return null;

  const tier = subscription?.tierId
    ? await SubscriptionTier.findById(subscription.tierId)
        .select("features studentLimit")
        .lean<{
          features?: string[];
          studentLimit?: number | null;
        } | null>()
    : null;
  const features = Array.isArray(tier?.features) ? tier.features : [];
  const limits = resolveTierLimits({
    tierCode: subscription?.tierCode || null,
    studentLimit:
      typeof tier?.studentLimit === "number" ? tier.studentLimit : null,
  });

  const pricing = computeSubscriptionPricing({
    basePriceMinor: subscription?.basePriceMinor || 0,
    manualPriceOverrideMinor: subscription?.manualPriceOverrideMinor || null,
    discountMode: subscription?.discountMode || "none",
    discountValue: subscription?.discountValue ?? null,
  });

  return {
    schoolId: String(school._id),
    schoolName: school.name || "Unnamed School",
    schoolStatus: school.status || "pending",
    paymentReady: isSchoolPaymentReady(school),
    subscription: {
      id: subscription ? String(subscription._id) : null,
      status: subscription?.status || "draft",
      tierId: subscription?.tierId ? String(subscription.tierId) : null,
      tierCode: subscription?.tierCode || null,
      tierName: subscription?.tierName || null,
      basePriceMinor: Math.max(0, Math.round(Number(subscription?.basePriceMinor || 0))),
      manualPriceOverrideMinor: subscription?.manualPriceOverrideMinor ?? null,
      discountMode: subscription?.discountMode || "none",
      discountValue: subscription?.discountValue ?? null,
      effectivePriceMinor: Math.max(0, Math.round(Number(subscription?.effectivePriceMinor || 0))),
      pilotEndsAt: subscription?.pilotEndsAt?.toISOString?.().slice(0, 10) || null,
    },
    pricing,
    features,
    limits,
    usage: {
      students: Math.max(0, students),
      teachers: Math.max(0, teachers),
    },
    hasFeature(featureKey: SubscriptionFeatureKey) {
      return hasTierFeature(features, featureKey);
    },
  };
}

export async function hasFeature(
  schoolId: string | mongoose.Types.ObjectId,
  featureKey: SubscriptionFeatureKey
) {
  const snapshot = await getSchoolSubscriptionSnapshot(schoolId);
  if (!snapshot) return false;
  return snapshot.hasFeature(featureKey);
}

export async function checkLimit(
  schoolId: string | mongoose.Types.ObjectId,
  limitKey: SubscriptionLimitKey,
  increment = 1
) {
  const snapshot = await getSchoolSubscriptionSnapshot(schoolId);
  if (!snapshot) {
    return { allowed: false, current: 0, limit: null };
  }

  let current = 0;
  if (limitKey === "maxStudents") {
    current = snapshot.usage.students;
  } else if (limitKey === "maxTeachers") {
    current = snapshot.usage.teachers;
  } else {
    await connectToDatabase();

    const schoolIdObj = normalizeSchoolId(schoolId);
    const monthRange = getCurrentMonthRange();
    const query: Record<string, unknown> = {
      schoolId: schoolIdObj,
    };

    if (limitKey === "maxInvitationsPerMonth") {
      query.provider = "internal";
      query.metricKey = "invitations_sent";
      query.periodStart = monthRange.periodStart;
      query.periodEnd = monthRange.periodEnd;
    } else if (limitKey === "maxAICallsPerMonth") {
      query.provider = "openai";
      query.metricKey = "ai_calls";
      query.periodStart = monthRange.periodStart;
      query.periodEnd = monthRange.periodEnd;
    } else if (limitKey === "maxStorageBytes") {
      query.provider = "uploadthing";
      query.metricKey = "uploaded_bytes";
    }

    const aggregate = await UsageMetric.aggregate<{ total: number }>([
      { $match: query },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ["$quantity", 0] } },
        },
      },
    ]);

    current = Math.max(0, Number(aggregate[0]?.total || 0));
  }
  const limit = snapshot.limits[limitKey];

  return {
    allowed: limit === null ? true : current + increment <= limit,
    current,
    limit,
  };
}

export async function trackUsage(input: TrackUsageInput) {
  await connectToDatabase();

  const { periodStart, periodEnd } = getCurrentMonthRange();
  const schoolIdObj = normalizeSchoolId(input.schoolId);
  const quantity = Math.max(0, Number(input.quantity || 1));
  const unitCostMinor = Math.max(0, Math.round(Number(input.unitCostMinor || 0)));
  const estimatedCostMinor =
    input.estimatedCostMinor !== undefined
      ? Math.max(0, Math.round(Number(input.estimatedCostMinor || 0)))
      : Math.max(0, Math.round(quantity * unitCostMinor));

  const metric = await UsageMetric.findOneAndUpdate(
    {
      schoolId: schoolIdObj,
      provider: input.provider,
      metricKey: input.metricKey,
      periodStart,
      periodEnd,
    },
    {
      $inc: {
        quantity,
        estimatedCostMinor,
      },
      $set: {
        unitLabel: input.unitLabel || "units",
        unitCostMinor,
        allocationMethod: input.allocationMethod || "manual",
        sourceType: input.sourceType || "manual",
        notes: input.notes || null,
        updatedBy: input.actorId || null,
        updatedByEmail: input.actorEmail || null,
        updatedAt: new Date(),
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  return metric;
}
