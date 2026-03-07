import mongoose from "mongoose";
import { computeSubscriptionPricing } from "@/lib/platform-billing/subscription-pricing";
import { resolveTransactionFeeConfigForSchool } from "@/lib/billing/transaction-fees";
import { School } from "@/models/School";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { SubscriptionEvent } from "@/models/SubscriptionEvent";
import { UsageMetric } from "@/models/UsageMetric";

export async function getPlatformSchoolList() {
  const [schools, subscriptions, usageMetrics] = await Promise.all([
    School.find({})
      .select("name status billing.transactionFees billing.paystack.subaccountCode")
      .sort({ name: 1 })
      .lean<Array<{
        _id: mongoose.Types.ObjectId;
        name?: string;
        status?: string;
        billing?: {
          paystack?: { subaccountCode?: string | null };
          transactionFees?: {
            mode?: "platform_default" | "custom" | "disabled";
            percent?: number | null;
            capMinor?: number | null;
            notes?: string | null;
            updatedAt?: Date | null;
          };
        };
      }>>(),
    SchoolSubscription.find({})
      .select(
        "schoolId tierCode tierName status basePriceMinor manualPriceOverrideMinor discountMode discountValue effectivePriceMinor"
      )
      .lean<Array<{
        schoolId: mongoose.Types.ObjectId;
        tierCode?: string | null;
        tierName?: string | null;
        status?: string;
        basePriceMinor?: number;
        manualPriceOverrideMinor?: number | null;
        discountMode?: "none" | "percent" | "fixed";
        discountValue?: number | null;
        effectivePriceMinor?: number;
      }>>(),
    UsageMetric.aggregate<{
      _id: mongoose.Types.ObjectId;
      totalEstimatedCostMinor: number;
      metricsCount: number;
    }>([
      {
        $group: {
          _id: "$schoolId",
          totalEstimatedCostMinor: { $sum: "$estimatedCostMinor" },
          metricsCount: { $sum: 1 },
        },
      },
    ]),
  ]);

  const subscriptionsBySchool = new Map(
    subscriptions.map((subscription) => [String(subscription.schoolId), subscription])
  );
  const usageBySchool = new Map(
    usageMetrics.map((row) => [String(row._id), row])
  );

  return schools.map((school) => {
    const schoolId = String(school._id);
    const subscription = subscriptionsBySchool.get(schoolId);
    const usage = usageBySchool.get(schoolId);
    const feeConfig = resolveTransactionFeeConfigForSchool(
      school.billing?.transactionFees || null
    );
    const pricing = subscription
      ? computeSubscriptionPricing({
          basePriceMinor: subscription.basePriceMinor || 0,
          manualPriceOverrideMinor: subscription.manualPriceOverrideMinor || null,
          discountMode: subscription.discountMode || "none",
          discountValue: subscription.discountValue ?? null,
        })
      : null;

    return {
      id: schoolId,
      name: school.name || "Unnamed School",
      status: school.status || "pending",
      paymentReady: Boolean(school.billing?.paystack?.subaccountCode),
      transactionFeePolicy: {
        mode: school.billing?.transactionFees?.mode || "platform_default",
        percent: school.billing?.transactionFees?.percent ?? null,
        capMinor: school.billing?.transactionFees?.capMinor ?? null,
        notes: school.billing?.transactionFees?.notes || null,
        updatedAt: school.billing?.transactionFees?.updatedAt?.toISOString?.() || null,
      },
      effectiveTransactionFee: feeConfig,
      subscription: subscription
        ? {
            tierCode: subscription.tierCode || null,
            tierName: subscription.tierName || null,
            status: subscription.status || "draft",
            effectivePriceMinor: Math.max(
              0,
              Math.round(Number(subscription.effectivePriceMinor || 0))
            ),
            discountExposureMinor: pricing?.discountAmountMinor || 0,
          }
        : null,
      usage: {
        totalEstimatedCostMinor: Math.max(
          0,
          Math.round(Number(usage?.totalEstimatedCostMinor || 0))
        ),
        metricsCount: Math.max(0, Math.round(Number(usage?.metricsCount || 0))),
      },
    };
  });
}

export async function getPlatformSchoolDetail(schoolId: string) {
  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    return null;
  }

  const schoolIdObj = new mongoose.Types.ObjectId(schoolId);
  const [school, subscription, usageMetrics, subscriptionEvents] = await Promise.all([
    School.findById(schoolIdObj)
      .select("name status billing.transactionFees billing.paystack.subaccountCode city region email")
      .lean<{
        _id: mongoose.Types.ObjectId;
        name?: string;
        status?: string;
        city?: string;
        region?: string;
        email?: string;
        billing?: {
          paystack?: { subaccountCode?: string | null };
          transactionFees?: {
            mode?: "platform_default" | "custom" | "disabled";
            percent?: number | null;
            capMinor?: number | null;
            notes?: string | null;
            updatedAt?: Date | null;
          };
        };
      } | null>(),
    SchoolSubscription.findOne({ schoolId: schoolIdObj })
      .select(
        "tierId tierCode tierName status basePriceMinor manualPriceOverrideMinor discountMode discountValue effectivePriceMinor note pilotEndsAt updatedAt"
      )
      .lean<{
        _id: mongoose.Types.ObjectId;
        tierId?: mongoose.Types.ObjectId | null;
        tierCode?: string | null;
        tierName?: string | null;
        status?: string;
        basePriceMinor?: number;
        manualPriceOverrideMinor?: number | null;
        discountMode?: "none" | "percent" | "fixed";
        discountValue?: number | null;
        effectivePriceMinor?: number;
        note?: string | null;
        pilotEndsAt?: Date | null;
        updatedAt?: Date | null;
      } | null>(),
    UsageMetric.find({ schoolId: schoolIdObj })
      .sort({ updatedAt: -1 })
      .limit(25)
      .lean<Array<{
        _id: mongoose.Types.ObjectId;
        provider: string;
        metricKey: string;
        quantity?: number;
        unitLabel?: string;
        estimatedCostMinor?: number;
        periodStart: Date;
        periodEnd: Date;
        updatedAt?: Date | null;
      }>>(),
    SubscriptionEvent.find({ schoolId: schoolIdObj })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean<Array<{
        _id: mongoose.Types.ObjectId;
        eventType: string;
        summary: string;
        actorEmail?: string | null;
        createdAt: Date;
      }>>(),
  ]);

  if (!school) {
    return null;
  }

  const feeConfig = resolveTransactionFeeConfigForSchool(
    school.billing?.transactionFees || null
  );
  const totalEstimatedCostMinor = usageMetrics.reduce(
    (sum, metric) => sum + Math.max(0, Math.round(Number(metric.estimatedCostMinor || 0))),
    0
  );
  const pricing = subscription
    ? computeSubscriptionPricing({
        basePriceMinor: subscription.basePriceMinor || 0,
        manualPriceOverrideMinor: subscription.manualPriceOverrideMinor || null,
        discountMode: subscription.discountMode || "none",
        discountValue: subscription.discountValue ?? null,
      })
    : null;

  return {
    id: String(school._id),
    name: school.name || "Unnamed School",
    status: school.status || "pending",
    city: school.city || null,
    region: school.region || null,
    email: school.email || null,
    paymentReady: Boolean(school.billing?.paystack?.subaccountCode),
    transactionFeePolicy: {
      mode: school.billing?.transactionFees?.mode || "platform_default",
      percent: school.billing?.transactionFees?.percent ?? null,
      capMinor: school.billing?.transactionFees?.capMinor ?? null,
      notes: school.billing?.transactionFees?.notes || null,
      updatedAt: school.billing?.transactionFees?.updatedAt?.toISOString?.() || null,
    },
    effectiveTransactionFee: feeConfig,
    subscription: subscription
      ? {
          id: String(subscription._id),
          tierId: subscription.tierId ? String(subscription.tierId) : null,
          tierCode: subscription.tierCode || null,
          tierName: subscription.tierName || null,
          status: subscription.status || "draft",
          basePriceMinor: Math.max(0, Math.round(Number(subscription.basePriceMinor || 0))),
          manualPriceOverrideMinor:
            subscription.manualPriceOverrideMinor ?? null,
          discountMode: subscription.discountMode || "none",
          discountValue: subscription.discountValue ?? null,
          effectivePriceMinor: Math.max(
            0,
            Math.round(Number(subscription.effectivePriceMinor || 0))
          ),
          discountExposureMinor: pricing?.discountAmountMinor || 0,
          note: subscription.note || null,
          pilotEndsAt: subscription.pilotEndsAt?.toISOString?.().slice(0, 10) || null,
          updatedAt: subscription.updatedAt?.toISOString?.() || null,
        }
      : null,
    usage: {
      totalEstimatedCostMinor,
      metricsCount: usageMetrics.length,
      metrics: usageMetrics.map((metric) => ({
        id: String(metric._id),
        provider: metric.provider,
        metricKey: metric.metricKey,
        quantity: Math.max(0, Number(metric.quantity || 0)),
        unitLabel: metric.unitLabel || "units",
        estimatedCostMinor: Math.max(
          0,
          Math.round(Number(metric.estimatedCostMinor || 0))
        ),
        periodStart: metric.periodStart.toISOString().slice(0, 10),
        periodEnd: metric.periodEnd.toISOString().slice(0, 10),
        updatedAt: metric.updatedAt?.toISOString?.() || null,
      })),
    },
    events: subscriptionEvents.map((event) => ({
      id: String(event._id),
      eventType: event.eventType,
      summary: event.summary,
      actorEmail: event.actorEmail || null,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}
