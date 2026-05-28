import "server-only";

import type { ISubscriptionTier } from "@/models/SubscriptionTier";
import type { ISchoolSubscription } from "@/models/SchoolSubscription";
import {
  computeSubscriptionBasePrice,
  computeSubscriptionPricing,
  type BillingCadence,
} from "@/lib/platform-billing/subscription-pricing";
import { PLAN_CODES, type PlanCode } from "./plan-codes";

const PLAN_RANK: Record<string, number> = {
  [PLAN_CODES.PILOT]: 0,
  [PLAN_CODES.STARTER]: 1,
  [PLAN_CODES.GROWTH]: 2,
  [PLAN_CODES.ENTERPRISE]: 3,
};

export type PlanChangeKind = "upgrade" | "downgrade" | "lateral";

export type PlanChangeQuote = {
  kind: PlanChangeKind;
  currentPlanCode: string | null;
  targetPlanCode: string;
  currentPeriodPriceMinor: number;
  targetPeriodPriceMinor: number;
  proratedCreditMinor: number;
  proratedTargetChargeMinor: number;
  amountDueNowMinor: number;
  remainingPeriodRatio: number;
  effectiveAt: "immediate" | "renewal";
  scheduledAt: string | null;
  billingCadence: BillingCadence;
  targetBillingCadence: BillingCadence;
  cadenceChange: boolean;
  studentCount: number;
  note: string;
};

function normalizeCadence(value: string | null | undefined): BillingCadence {
  return value === "annual" || value === "monthly" || value === "custom" ? value : "term";
}

function periodRatio(startsAt: Date | null | undefined, endsAt: Date | null | undefined, now: Date) {
  if (!startsAt || !endsAt || endsAt <= now || endsAt <= startsAt) return 1;
  const total = endsAt.getTime() - startsAt.getTime();
  const remaining = endsAt.getTime() - now.getTime();
  return Math.max(0, Math.min(1, remaining / total));
}

function rank(code: string | null | undefined) {
  return PLAN_RANK[code ?? ""] ?? -1;
}

export function computePlanChangeQuote(input: {
  currentSubscription: Pick<
    ISchoolSubscription,
    "tierCode" | "billingCadence" | "startsAt" | "endsAt" | "effectivePriceMinor" | "manualPriceOverrideMinor" | "discountMode" | "discountValue"
  >;
  targetPlan: Pick<ISubscriptionTier, "code" | "name" | "priceMinor" | "pricing">;
  targetBillingCadence?: BillingCadence | null;
  studentCount: number;
  now?: Date;
}): PlanChangeQuote {
  const now = input.now ?? new Date();
  const currentCode = input.currentSubscription.tierCode ?? null;
  const targetCode = input.targetPlan.code as PlanCode;
  const currentRank = rank(currentCode);
  const targetRank = rank(targetCode);
  const kind: PlanChangeKind =
    targetRank > currentRank ? "upgrade" : targetRank < currentRank ? "downgrade" : "lateral";

  const billingCadence = normalizeCadence(input.currentSubscription.billingCadence);
  const targetBillingCadence = normalizeCadence(input.targetBillingCadence ?? billingCadence);
  const cadenceChange = targetBillingCadence !== billingCadence;
  const targetBase = computeSubscriptionBasePrice({
    studentCount: input.studentCount,
    pricePerStudentPerTermMinor: input.targetPlan.pricing?.pricePerStudentPerTermMinor ?? null,
    minimumTermFeeMinor: input.targetPlan.pricing?.minimumTermFeeMinor ?? input.targetPlan.priceMinor ?? null,
    annualDiscountPercent: input.targetPlan.pricing?.annualDiscountPercent ?? null,
    billingCadence: targetBillingCadence,
  });
  const targetPricing = computeSubscriptionPricing({
    basePriceMinor: targetBase.basePriceMinor,
    discountMode: input.currentSubscription.discountMode,
    discountValue: input.currentSubscription.discountValue,
  });

  const currentPeriodPriceMinor = Math.max(0, Math.round(input.currentSubscription.effectivePriceMinor || 0));
  const targetPeriodPriceMinor = targetPricing.finalPriceMinor;
  const remainingPeriodRatio = periodRatio(
    input.currentSubscription.startsAt ?? null,
    input.currentSubscription.endsAt ?? null,
    now
  );
  const proratedCreditMinor = Math.round(currentPeriodPriceMinor * remainingPeriodRatio);
  const proratedTargetChargeMinor = Math.round(targetPeriodPriceMinor * remainingPeriodRatio);
  const amountDueNowMinor =
    kind === "upgrade"
      ? Math.max(0, proratedTargetChargeMinor - proratedCreditMinor)
      : 0;
  const scheduleForRenewal = kind === "downgrade" || (kind === "lateral" && cadenceChange);

  return {
    kind,
    currentPlanCode: currentCode,
    targetPlanCode: targetCode,
    currentPeriodPriceMinor,
    targetPeriodPriceMinor,
    proratedCreditMinor,
    proratedTargetChargeMinor,
    amountDueNowMinor,
    remainingPeriodRatio,
    effectiveAt: scheduleForRenewal ? "renewal" : "immediate",
    scheduledAt:
      scheduleForRenewal && input.currentSubscription.endsAt
        ? input.currentSubscription.endsAt.toISOString()
        : null,
    billingCadence,
    targetBillingCadence,
    cadenceChange,
    studentCount: Math.max(0, Math.round(input.studentCount)),
    note:
      kind === "downgrade"
        ? "Downgrades are scheduled for renewal by default so the school keeps access already paid for; no automatic refund is issued."
        : cadenceChange
          ? "Same-tier cadence changes are scheduled from the next term so current paid coverage remains intact."
        : kind === "upgrade"
          ? "Upgrade amount is the prorated difference between the current plan value and the target plan value for the remaining billing period."
          : "Same-rank plan changes are treated as immediate updates when confirmed by platform billing.",
  };
}
