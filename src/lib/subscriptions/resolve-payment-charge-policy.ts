/**
 * resolvePaymentChargePolicy
 *
 * Resolves the applicable PaymentChargePolicy for a given school and payment
 * category, following the precedence order defined in spec §7.5:
 *
 *   1. school + category  (scope: "school_category")
 *   2. school default     (scope: "school", no category)
 *   3. global category    (scope: "category", no school)
 *   4. global default     (scope: "global", no school, no category)
 *   5. null — no charge
 *
 * computeCharge() applies the resolved policy to an amount:
 *   - percentage: Math.round(amountMinor * bps / 10000)
 *   - fixed: fixedFeeMinor
 *   - hybrid: percentage + fixed
 *   - waived: 0
 *   - cap/floor applied after calculation
 *
 * Spec §11.4, §13A.12.
 */

import mongoose from "mongoose";
import {
  PaymentChargePolicy,
  type IPaymentChargePolicy,
  type PaymentCategory,
} from "@/models/PaymentChargePolicy";

export type ResolvedChargePolicy = {
  found: boolean;
  policy: IPaymentChargePolicy | null;
  chargeMinor: number;
  payerMode: "payer_pays" | "school_absorbs" | "waived";
  totalPayableMinor: number;
  breakdown: {
    baseAmountMinor: number;
    platformChargeMinor: number;
    payerMode: string;
  };
};

export async function resolvePaymentChargePolicy(params: {
  schoolId: string | mongoose.Types.ObjectId;
  category: PaymentCategory;
  amountMinor: number;
}): Promise<ResolvedChargePolicy> {
  const { schoolId, category, amountMinor } = params;
  const schoolObjId = new mongoose.Types.ObjectId(String(schoolId));

  const enforcementEnabled = process.env.SUBSCRIPTION_PAYMENT_CHARGES_ENABLED === "true";

  if (!enforcementEnabled) {
    return {
      found: false,
      policy: null,
      chargeMinor: 0,
      payerMode: "waived",
      totalPayableMinor: amountMinor,
      breakdown: {
        baseAmountMinor: amountMinor,
        platformChargeMinor: 0,
        payerMode: "waived",
      },
    };
  }

  // Fetch all potentially matching policies
  const candidates = await PaymentChargePolicy.find({
    active: true,
    $or: [
      { scope: "school_category", schoolId: schoolObjId, category },
      { scope: "school", schoolId: schoolObjId, category: null },
      { scope: "category", schoolId: null, category },
      { scope: "global", schoolId: null, category: null },
    ],
  }).lean<IPaymentChargePolicy[]>();

  // Find best match per precedence
  const PRECEDENCE_ORDER: IPaymentChargePolicy["scope"][] = [
    "school_category",
    "school",
    "category",
    "global",
  ];

  let policy: IPaymentChargePolicy | null = null;
  for (const scope of PRECEDENCE_ORDER) {
    const match = candidates.find((c) => {
      if (c.scope !== scope) return false;
      if (scope === "school_category") return String(c.schoolId) === String(schoolId) && c.category === category;
      if (scope === "school") return String(c.schoolId) === String(schoolId) && !c.category;
      if (scope === "category") return !c.schoolId && c.category === category;
      return !c.schoolId && !c.category; // global
    });
    if (match) { policy = match; break; }
  }

  if (!policy || policy.payerMode === "waived") {
    return {
      found: Boolean(policy),
      policy,
      chargeMinor: 0,
      payerMode: "waived",
      totalPayableMinor: amountMinor,
      breakdown: { baseAmountMinor: amountMinor, platformChargeMinor: 0, payerMode: "waived" },
    };
  }

  // Calculate raw charge
  let rawCharge = 0;
  if (policy.chargeType === "percentage" && policy.percentageBps) {
    rawCharge = Math.round((amountMinor * policy.percentageBps) / 10000);
  } else if (policy.chargeType === "fixed" && policy.fixedFeeMinor) {
    rawCharge = policy.fixedFeeMinor;
  } else if (policy.chargeType === "hybrid") {
    const pctPart = policy.percentageBps ? Math.round((amountMinor * policy.percentageBps) / 10000) : 0;
    const fixedPart = policy.fixedFeeMinor ?? 0;
    rawCharge = pctPart + fixedPart;
  }

  // Apply floor / cap
  if (policy.minChargeMinor && rawCharge < policy.minChargeMinor) {
    rawCharge = policy.minChargeMinor;
  }
  if (policy.maxChargeMinor && rawCharge > policy.maxChargeMinor) {
    rawCharge = policy.maxChargeMinor;
  }

  const totalPayableMinor =
    policy.payerMode === "payer_pays" ? amountMinor + rawCharge : amountMinor;

  return {
    found: true,
    policy,
    chargeMinor: rawCharge,
    payerMode: policy.payerMode,
    totalPayableMinor,
    breakdown: {
      baseAmountMinor: amountMinor,
      platformChargeMinor: rawCharge,
      payerMode: policy.payerMode,
    },
  };
}
