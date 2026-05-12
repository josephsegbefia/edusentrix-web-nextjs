export type SubscriptionDiscountMode = "none" | "percent" | "fixed";

export type BillingCadence = "term" | "annual" | "monthly" | "custom";

export type SubscriptionLifecycleMode = "trial" | "pilot" | "paid" | "custom";

export const SUBSCRIPTION_STATUSES = [
  "draft",
  "trial",
  "trialing",
  "pilot",
  "active",
  "past_due",
  "grace",
  "restricted_read_only",
  "suspended",
  "cancelled",
  "expired",
  "archived",
] as const;

export const BILLING_CADENCES = ["term", "annual", "monthly", "custom"] as const;

export const SUBSCRIPTION_LIFECYCLE_MODES = [
  "trial",
  "pilot",
  "paid",
  "custom",
] as const;

export type SubscriptionStatus =
  (typeof SUBSCRIPTION_STATUSES)[number];

export const ACTIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "trial",
  "trialing",
  "pilot",
  "active",
];

export function normalizeSubscriptionStatus(
  status?: string | null
): SubscriptionStatus {
  if (status === "trial") return "trialing";

  return SUBSCRIPTION_STATUSES.includes(status as SubscriptionStatus)
    ? (status as SubscriptionStatus)
    : "draft";
}

export function isActiveSubscriptionStatus(status?: string | null) {
  const normalized = normalizeSubscriptionStatus(status);
  return (
    normalized === "trialing" ||
    normalized === "pilot" ||
    normalized === "active"
  );
}

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
