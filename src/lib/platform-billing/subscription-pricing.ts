export type SubscriptionDiscountMode = "none" | "percent" | "fixed";

export type SubscriptionStatus =
  | "draft"
  | "trial"
  | "active"
  | "suspended"
  | "cancelled";

export type SubscriptionPricingInput = {
  basePriceMinor: number;
  manualPriceOverrideMinor?: number | null;
  discountMode?: SubscriptionDiscountMode | null;
  discountValue?: number | null;
};

export type SubscriptionPricingBreakdown = {
  baseTierPriceMinor: number;
  effectiveBasePriceMinor: number;
  discountAmountMinor: number;
  finalPriceMinor: number;
};

export function computeSubscriptionPricing(
  input: SubscriptionPricingInput
): SubscriptionPricingBreakdown {
  const baseTierPriceMinor = Math.max(0, Math.round(input.basePriceMinor || 0));
  const effectiveBasePriceMinor =
    typeof input.manualPriceOverrideMinor === "number" &&
    Number.isFinite(input.manualPriceOverrideMinor)
      ? Math.max(0, Math.round(input.manualPriceOverrideMinor))
      : baseTierPriceMinor;

  const discountMode = input.discountMode || "none";
  const normalizedDiscountValue =
    typeof input.discountValue === "number" && Number.isFinite(input.discountValue)
      ? Math.max(0, input.discountValue)
      : 0;

  let discountAmountMinor = 0;
  if (discountMode === "percent") {
    discountAmountMinor = Math.round(
      (effectiveBasePriceMinor * Math.min(100, normalizedDiscountValue)) / 100
    );
  } else if (discountMode === "fixed") {
    discountAmountMinor = Math.round(normalizedDiscountValue);
  }

  discountAmountMinor = Math.min(effectiveBasePriceMinor, discountAmountMinor);

  return {
    baseTierPriceMinor,
    effectiveBasePriceMinor,
    discountAmountMinor,
    finalPriceMinor: Math.max(0, effectiveBasePriceMinor - discountAmountMinor),
  };
}
