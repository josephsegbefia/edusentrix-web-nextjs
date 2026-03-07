import mongoose from "mongoose";
import { getCurrentMonthRange, parseDateOnly } from "@/lib/platform-billing/period-range";
import { computeSubscriptionPricing } from "@/lib/platform-billing/subscription-pricing";
import { Payment } from "@/models/Payment";
import { School } from "@/models/School";
import { SchoolDisbursement } from "@/models/SchoolDisbursement";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { ServiceCostEntry } from "@/models/ServiceCostEntry";
import { UsageMetric } from "@/models/UsageMetric";

export type RevenuePeriod = {
  periodStart: Date;
  periodEnd: Date;
};

function parsePeriodEnd(value?: string | null) {
  const parsed = parseDateOnly(value);
  if (!parsed) return null;
  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
}

export function resolveRevenuePeriod(input?: {
  periodStart?: string | null;
  periodEnd?: string | null;
}): RevenuePeriod {
  const fallback = getCurrentMonthRange();
  const periodStart = parseDateOnly(input?.periodStart) || fallback.periodStart;
  const periodEnd = parsePeriodEnd(input?.periodEnd) || fallback.periodEnd;
  return { periodStart, periodEnd };
}

type SchoolRow = {
  _id: mongoose.Types.ObjectId;
  name?: string;
  status?: string;
};

type SubscriptionRow = {
  _id: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  tierCode?: string | null;
  tierName?: string | null;
  status?: string;
  basePriceMinor?: number;
  manualPriceOverrideMinor?: number | null;
  discountMode?: "none" | "percent" | "fixed";
  discountValue?: number | null;
  effectivePriceMinor?: number;
};

type RevenueSchoolAggregate = {
  schoolId: string;
  schoolName: string;
  schoolStatus: string;
  subscriptionStatus: string;
  tierCode: string | null;
  tierName: string | null;
  subscriptionRevenueMinor: number;
  discountExposureMinor: number;
  transactionFeeRevenueMinor: number;
  processorFeeCostMinor: number;
  attributedCostMinor: number;
  grossMarginMinor: number;
};

export async function getPlatformRevenueSummary(input?: {
  periodStart?: string | null;
  periodEnd?: string | null;
}) {
  const { periodStart, periodEnd } = resolveRevenuePeriod(input);

  const [schools, subscriptions, payments, disbursements, usageMetrics, serviceCosts] =
    await Promise.all([
      School.find({})
        .select("name status")
        .sort({ name: 1 })
        .lean<SchoolRow[]>(),
      SchoolSubscription.find({})
        .select(
          "schoolId tierCode tierName status basePriceMinor manualPriceOverrideMinor discountMode discountValue effectivePriceMinor"
        )
        .lean<SubscriptionRow[]>(),
      Payment.find({
        paymentDate: { $gte: periodStart, $lte: periodEnd },
        status: "completed",
      })
        .select("schoolId amountMinor platformFeeMinor processorFeeMinor")
        .lean<Array<{
          schoolId: mongoose.Types.ObjectId;
          amountMinor?: number;
          platformFeeMinor?: number;
          processorFeeMinor?: number;
        }>>(),
      SchoolDisbursement.find({
        createdAt: { $gte: periodStart, $lte: periodEnd },
        paymentRail: "paystack",
        status: { $in: ["processing", "completed"] },
      })
        .select("schoolId amountMinor platformFeeMinor processorFeeMinor")
        .lean<Array<{
          schoolId: mongoose.Types.ObjectId;
          amountMinor?: number;
          platformFeeMinor?: number;
          processorFeeMinor?: number;
        }>>(),
      UsageMetric.find({
        periodStart: { $gte: periodStart },
        periodEnd: { $lte: periodEnd },
      })
        .select("schoolId estimatedCostMinor")
        .lean<Array<{
          schoolId: mongoose.Types.ObjectId;
          estimatedCostMinor?: number;
        }>>(),
      ServiceCostEntry.find({
        periodStart: { $gte: periodStart },
        periodEnd: { $lte: periodEnd },
      })
        .select("provider amountMinor")
        .lean<Array<{ provider: string; amountMinor?: number }>>(),
    ]);

  const schoolMap = new Map(
    schools.map((school) => [String(school._id), school])
  );
  const subscriptionMap = new Map(
    subscriptions.map((subscription) => [String(subscription.schoolId), subscription])
  );

  const paymentVolumeMinor = payments.reduce(
    (sum, payment) => sum + Math.max(0, Math.round(Number(payment.amountMinor || 0))),
    0
  );
  const inboundFeeRevenueMinor = payments.reduce(
    (sum, payment) =>
      sum + Math.max(0, Math.round(Number(payment.platformFeeMinor || 0))),
    0
  );
  const inboundProcessorCostMinor = payments.reduce(
    (sum, payment) =>
      sum + Math.max(0, Math.round(Number(payment.processorFeeMinor || 0))),
    0
  );
  const outboundDisbursementMinor = disbursements.reduce(
    (sum, disbursement) =>
      sum + Math.max(0, Math.round(Number(disbursement.amountMinor || 0))),
    0
  );
  const outboundFeeRevenueMinor = disbursements.reduce(
    (sum, disbursement) =>
      sum + Math.max(0, Math.round(Number(disbursement.platformFeeMinor || 0))),
    0
  );
  const outboundProcessorCostMinor = disbursements.reduce(
    (sum, disbursement) =>
      sum + Math.max(0, Math.round(Number(disbursement.processorFeeMinor || 0))),
    0
  );

  const schoolsById = new Map<string, RevenueSchoolAggregate>();
  const getAggregate = (schoolId: string): RevenueSchoolAggregate => {
    const existing = schoolsById.get(schoolId);
    if (existing) return existing;

    const school = schoolMap.get(schoolId);
    const subscription = subscriptionMap.get(schoolId);
    const pricing = subscription
      ? computeSubscriptionPricing({
          basePriceMinor: subscription.basePriceMinor || 0,
          manualPriceOverrideMinor: subscription.manualPriceOverrideMinor || null,
          discountMode: subscription.discountMode || "none",
          discountValue: subscription.discountValue ?? null,
        })
      : null;

    const created: RevenueSchoolAggregate = {
      schoolId,
      schoolName: school?.name || "Unnamed School",
      schoolStatus: school?.status || "pending",
      subscriptionStatus: subscription?.status || "draft",
      tierCode: subscription?.tierCode || null,
      tierName: subscription?.tierName || null,
      subscriptionRevenueMinor:
        subscription && ["active", "trial"].includes(subscription.status || "")
          ? Math.max(0, Math.round(Number(subscription.effectivePriceMinor || 0)))
          : 0,
      discountExposureMinor: pricing?.discountAmountMinor || 0,
      transactionFeeRevenueMinor: 0,
      processorFeeCostMinor: 0,
      attributedCostMinor: 0,
      grossMarginMinor: 0,
    };

    schoolsById.set(schoolId, created);
    return created;
  };

  for (const payment of payments) {
    const aggregate = getAggregate(String(payment.schoolId));
    aggregate.transactionFeeRevenueMinor += Math.max(
      0,
      Math.round(Number(payment.platformFeeMinor || 0))
    );
    aggregate.processorFeeCostMinor += Math.max(
      0,
      Math.round(Number(payment.processorFeeMinor || 0))
    );
  }

  for (const disbursement of disbursements) {
    const aggregate = getAggregate(String(disbursement.schoolId));
    aggregate.transactionFeeRevenueMinor += Math.max(
      0,
      Math.round(Number(disbursement.platformFeeMinor || 0))
    );
    aggregate.processorFeeCostMinor += Math.max(
      0,
      Math.round(Number(disbursement.processorFeeMinor || 0))
    );
  }

  for (const metric of usageMetrics) {
    const aggregate = getAggregate(String(metric.schoolId));
    aggregate.attributedCostMinor += Math.max(
      0,
      Math.round(Number(metric.estimatedCostMinor || 0))
    );
  }

  const schoolAggregates = Array.from(schoolsById.values())
    .map((row) => ({
      ...row,
      grossMarginMinor:
        row.subscriptionRevenueMinor +
        row.transactionFeeRevenueMinor -
        row.processorFeeCostMinor -
        row.attributedCostMinor,
    }))
    .sort(
      (a, b) =>
        b.subscriptionRevenueMinor + b.transactionFeeRevenueMinor -
        (a.subscriptionRevenueMinor + a.transactionFeeRevenueMinor)
    );

  const tierMix = new Map<string, { tierCode: string; tierName: string; schools: number }>();
  for (const subscription of subscriptions) {
    if (!["active", "trial", "suspended"].includes(subscription.status || "")) {
      continue;
    }
    const key = subscription.tierCode || "unassigned";
    const existing =
      tierMix.get(key) || {
        tierCode: key,
        tierName: subscription.tierName || "Unassigned",
        schools: 0,
      };
    existing.schools += 1;
    tierMix.set(key, existing);
  }

  const serviceCostByProvider = new Map<string, number>();
  let serviceCostLedgerMinor = 0;
  for (const entry of serviceCosts) {
    const amountMinor = Math.max(0, Math.round(Number(entry.amountMinor || 0)));
    serviceCostLedgerMinor += amountMinor;
    serviceCostByProvider.set(
      entry.provider,
      (serviceCostByProvider.get(entry.provider) || 0) + amountMinor
    );
  }

  const realizedMrrMinor = schoolAggregates.reduce(
    (sum, row) => sum + row.subscriptionRevenueMinor,
    0
  );
  const discountExposureMinor = schoolAggregates.reduce(
    (sum, row) => sum + row.discountExposureMinor,
    0
  );
  const transactionFeeRevenueMinor =
    inboundFeeRevenueMinor + outboundFeeRevenueMinor;
  const processorFeeCostMinor =
    inboundProcessorCostMinor + outboundProcessorCostMinor;
  const usageAttributedCostMinor = schoolAggregates.reduce(
    (sum, row) => sum + row.attributedCostMinor,
    0
  );

  return {
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
    summary: {
      activeSchools: schools.filter((school) => school.status === "active").length,
      activeSubscriptions: subscriptions.filter((subscription) =>
        ["active", "trial"].includes(subscription.status || "")
      ).length,
      realizedMrrMinor,
      arrRunRateMinor: realizedMrrMinor * 12,
      discountExposureMinor,
      paymentVolumeMinor,
      outboundDisbursementMinor,
      transactionFeeRevenueMinor,
      processorFeeCostMinor,
      netPaymentMarginMinor: transactionFeeRevenueMinor - processorFeeCostMinor,
      usageAttributedCostMinor,
      serviceCostLedgerMinor,
      grossMarginMinor:
        realizedMrrMinor +
        transactionFeeRevenueMinor -
        processorFeeCostMinor -
        usageAttributedCostMinor,
    },
    serviceCosts: Array.from(serviceCostByProvider.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([provider, amountMinor]) => ({ provider, amountMinor })),
    tierMix: Array.from(tierMix.values()).sort((a, b) => b.schools - a.schools),
    schools: schoolAggregates,
  };
}
