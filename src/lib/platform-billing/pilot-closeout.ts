import mongoose from "mongoose";
import { School } from "@/models/School";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { UsageMetric } from "@/models/UsageMetric";

export type PilotCloseoutRecommendation = {
  schoolId: mongoose.Types.ObjectId;
  schoolName: string;
  subscriptionId?: mongoose.Types.ObjectId | null;
  tierName?: string | null;
  subscriptionStatus?: string | null;
  currentSubscriptionPriceMinor: number;
  transactionFeeRevenueMinor: number;
  estimatedCostMinor: number;
  realizedRevenueMinor: number;
  marginMinor: number;
  marginPercent: number;
  recommendedSubscriptionPriceMinor: number;
  recommendedAction: "keep" | "raise_price" | "assign_price" | "review";
  narrative: string;
};

export type PilotCloseoutSummary = {
  totalSubscriptionRevenueMinor: number;
  totalTransactionFeeRevenueMinor: number;
  totalRealizedRevenueMinor: number;
  totalEstimatedCostMinor: number;
  totalMarginMinor: number;
  negativeMarginSchools: number;
  targetMarginPercent: number;
};

export type PilotCloseoutSnapshot = {
  schoolCount: number;
  summary: PilotCloseoutSummary;
  recommendations: PilotCloseoutRecommendation[];
};

type SchoolRow = {
  _id: mongoose.Types.ObjectId;
  name?: string;
};

type SubscriptionRow = {
  _id: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  tierName?: string | null;
  status?: string | null;
  effectivePriceMinor?: number;
};

type UsageRow = {
  schoolId: mongoose.Types.ObjectId;
  provider: string;
  metricKey: string;
  quantity?: number;
  estimatedCostMinor?: number;
};

function getTargetMarginPercent() {
  const raw = Number(process.env.PILOT_CLOSEOUT_TARGET_MARGIN_PERCENT || "25");
  if (!Number.isFinite(raw)) return 25;
  return Math.min(80, Math.max(0, raw));
}

function computeRecommendedSubscriptionPriceMinor(args: {
  estimatedCostMinor: number;
  transactionFeeRevenueMinor: number;
  targetMarginPercent: number;
}) {
  const netCostToCover = Math.max(
    0,
    args.estimatedCostMinor - args.transactionFeeRevenueMinor
  );
  const targetMarginRatio = args.targetMarginPercent / 100;

  if (targetMarginRatio >= 0.99) {
    return netCostToCover;
  }

  if (netCostToCover <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.ceil(netCostToCover / Math.max(0.01, 1 - targetMarginRatio))
  );
}

function buildNarrative(args: {
  schoolName: string;
  currentSubscriptionPriceMinor: number;
  transactionFeeRevenueMinor: number;
  estimatedCostMinor: number;
  marginMinor: number;
  recommendedSubscriptionPriceMinor: number;
  action: PilotCloseoutRecommendation["recommendedAction"];
}) {
  if (args.action === "assign_price") {
    return `${args.schoolName} is operating with cost exposure but no effective subscription price. Assign a paid subscription before pilot closeout.`;
  }

  if (args.action === "raise_price") {
    return `${args.schoolName} is running below the target margin. Raise the subscription price to at least ${args.recommendedSubscriptionPriceMinor} minor units based on current cost-to-serve.`;
  }

  if (args.action === "keep") {
    return `${args.schoolName} is currently covering estimated cost-to-serve within the target margin guardrail. Existing pricing can remain in place unless broader tier strategy changes.`;
  }

  if (args.marginMinor < 0) {
    return `${args.schoolName} remains loss-making even after transaction-fee revenue is considered. Review discounting, tier fit, and cost drivers before approval.`;
  }

  return `${args.schoolName} needs manual review before final pilot pricing is approved.`;
}

export function buildPilotCloseoutFallbackSummary(snapshot: PilotCloseoutSnapshot) {
  if (snapshot.schoolCount === 0) {
    return "No active or trial school subscriptions were found for the selected period.";
  }

  const topRisks = snapshot.recommendations
    .filter((item) => item.recommendedAction !== "keep")
    .slice(0, 3)
    .map(
      (item) =>
        `${item.schoolName} (${item.recommendedAction.replace("_", " ")}, margin ${item.marginPercent.toFixed(1)}%)`
    );

  return [
    `${snapshot.schoolCount} schools were evaluated for pilot closeout.`,
    `${snapshot.summary.negativeMarginSchools} schools are currently below break-even on estimated cost-to-serve.`,
    topRisks.length > 0
      ? `Priority reviews: ${topRisks.join("; ")}.`
      : "No immediate pricing escalations were identified from the current snapshot.",
  ].join(" ");
}

export async function buildPilotCloseoutSnapshot(args: {
  periodStart: Date;
  periodEnd: Date;
}): Promise<PilotCloseoutSnapshot> {
  const targetMarginPercent = getTargetMarginPercent();

  const [schools, subscriptions, usageMetrics] = await Promise.all([
    School.find({}).select("name").lean<SchoolRow[]>(),
    SchoolSubscription.find({
      status: { $in: ["trial", "active", "suspended"] },
    })
      .select("schoolId tierName status effectivePriceMinor")
      .lean<SubscriptionRow[]>(),
    UsageMetric.find({
      periodStart: { $gte: args.periodStart },
      periodEnd: { $lte: args.periodEnd },
    })
      .select("schoolId provider metricKey quantity estimatedCostMinor")
      .lean<UsageRow[]>(),
  ]);

  const schoolNameMap = new Map(
    schools.map((school) => [String(school._id), school.name || "Unnamed School"])
  );

  const usageBySchool = new Map<
    string,
    {
      estimatedCostMinor: number;
      transactionFeeRevenueMinor: number;
    }
  >();

  for (const metric of usageMetrics) {
    const key = String(metric.schoolId);
    const current = usageBySchool.get(key) || {
      estimatedCostMinor: 0,
      transactionFeeRevenueMinor: 0,
    };

    current.estimatedCostMinor += Math.max(
      0,
      Number(metric.estimatedCostMinor || 0)
    );

    if (
      metric.provider === "paystack" &&
      metric.metricKey === "edusentrix_fee_revenue_minor"
    ) {
      current.transactionFeeRevenueMinor += Math.max(
        0,
        Math.round(Number(metric.quantity || 0))
      );
    }

    usageBySchool.set(key, current);
  }

  const recommendations: PilotCloseoutRecommendation[] = subscriptions
    .map((subscription) => {
      const schoolId = String(subscription.schoolId);
      const schoolName = schoolNameMap.get(schoolId) || "Unnamed School";
      const usage = usageBySchool.get(schoolId) || {
        estimatedCostMinor: 0,
        transactionFeeRevenueMinor: 0,
      };
      const currentSubscriptionPriceMinor = Math.max(
        0,
        Math.round(Number(subscription.effectivePriceMinor || 0))
      );
      const realizedRevenueMinor =
        currentSubscriptionPriceMinor + usage.transactionFeeRevenueMinor;
      const marginMinor = realizedRevenueMinor - usage.estimatedCostMinor;
      const marginPercent =
        realizedRevenueMinor > 0
          ? (marginMinor / realizedRevenueMinor) * 100
          : usage.estimatedCostMinor > 0
            ? -100
            : 0;
      const recommendedSubscriptionPriceMinor =
        computeRecommendedSubscriptionPriceMinor({
          estimatedCostMinor: usage.estimatedCostMinor,
          transactionFeeRevenueMinor: usage.transactionFeeRevenueMinor,
          targetMarginPercent,
        });

      let recommendedAction: PilotCloseoutRecommendation["recommendedAction"] = "review";
      if (currentSubscriptionPriceMinor <= 0 && usage.estimatedCostMinor > 0) {
        recommendedAction = "assign_price";
      } else if (
        recommendedSubscriptionPriceMinor > currentSubscriptionPriceMinor &&
        usage.estimatedCostMinor > 0
      ) {
        recommendedAction = "raise_price";
      } else if (marginMinor >= 0) {
        recommendedAction = "keep";
      }

      const narrative = buildNarrative({
        schoolName,
        currentSubscriptionPriceMinor,
        transactionFeeRevenueMinor: usage.transactionFeeRevenueMinor,
        estimatedCostMinor: usage.estimatedCostMinor,
        marginMinor,
        recommendedSubscriptionPriceMinor,
        action: recommendedAction,
      });

      return {
        schoolId: subscription.schoolId,
        schoolName,
        subscriptionId: subscription._id,
        tierName: subscription.tierName || null,
        subscriptionStatus: subscription.status || null,
        currentSubscriptionPriceMinor,
        transactionFeeRevenueMinor: usage.transactionFeeRevenueMinor,
        estimatedCostMinor: usage.estimatedCostMinor,
        realizedRevenueMinor,
        marginMinor,
        marginPercent: Number(marginPercent.toFixed(2)),
        recommendedSubscriptionPriceMinor,
        recommendedAction,
        narrative,
      };
    })
    .sort((a, b) => a.marginMinor - b.marginMinor);

  const summary: PilotCloseoutSummary = {
    totalSubscriptionRevenueMinor: recommendations.reduce(
      (sum, row) => sum + row.currentSubscriptionPriceMinor,
      0
    ),
    totalTransactionFeeRevenueMinor: recommendations.reduce(
      (sum, row) => sum + row.transactionFeeRevenueMinor,
      0
    ),
    totalRealizedRevenueMinor: recommendations.reduce(
      (sum, row) => sum + row.realizedRevenueMinor,
      0
    ),
    totalEstimatedCostMinor: recommendations.reduce(
      (sum, row) => sum + row.estimatedCostMinor,
      0
    ),
    totalMarginMinor: recommendations.reduce((sum, row) => sum + row.marginMinor, 0),
    negativeMarginSchools: recommendations.filter((row) => row.marginMinor < 0).length,
    targetMarginPercent,
  };

  return {
    schoolCount: recommendations.length,
    summary,
    recommendations,
  };
}
