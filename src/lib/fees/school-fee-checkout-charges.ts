import "server-only";

import type { Types } from "mongoose";
import { resolvePaymentChargePolicy } from "@/lib/subscriptions/resolve-payment-charge-policy";

export type SchoolFeePayerMode = "payer_pays" | "school_absorbs" | "waived";
export type SchoolFeePayerModePreference =
  | "platform_default"
  | "payer_pays"
  | "school_absorbs";

export type SchoolFeeCheckoutCharge = {
  invoiceAmountMinor: number;
  parentPayableMinor: number;
  platformFeeMinor: number;
  estimatedSchoolNetMinor: number;
  payerMode: SchoolFeePayerMode;
  policyPayerMode: SchoolFeePayerMode;
  payerModePreference: SchoolFeePayerModePreference;
  policyFound: boolean;
};

function normalizePreference(
  value: string | null | undefined
): SchoolFeePayerModePreference {
  if (value === "payer_pays" || value === "school_absorbs") return value;
  return "platform_default";
}

export async function resolveSchoolFeeCheckoutCharge(input: {
  schoolId: string | Types.ObjectId;
  amountMinor: number;
  payerModePreference?: string | null;
}): Promise<SchoolFeeCheckoutCharge> {
  const invoiceAmountMinor = Math.max(0, Math.round(input.amountMinor || 0));
  const resolved = await resolvePaymentChargePolicy({
    schoolId: input.schoolId,
    category: "school_fee",
    amountMinor: invoiceAmountMinor,
  });

  const payerModePreference = normalizePreference(input.payerModePreference);
  const payerMode =
    resolved.payerMode === "waived"
      ? "waived"
      : payerModePreference === "platform_default"
        ? resolved.payerMode
        : payerModePreference;
  const platformFeeMinor = payerMode === "waived" ? 0 : resolved.chargeMinor;
  const parentPayableMinor =
    payerMode === "payer_pays"
      ? invoiceAmountMinor + platformFeeMinor
      : invoiceAmountMinor;
  const estimatedSchoolNetMinor =
    payerMode === "payer_pays"
      ? invoiceAmountMinor
      : Math.max(0, invoiceAmountMinor - platformFeeMinor);

  return {
    invoiceAmountMinor,
    parentPayableMinor,
    platformFeeMinor,
    estimatedSchoolNetMinor,
    payerMode,
    policyPayerMode: resolved.payerMode,
    payerModePreference,
    policyFound: resolved.found,
  };
}
