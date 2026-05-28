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

export const TERMS_PER_ACADEMIC_YEAR = 3;

export type SubscriptionBasePriceInput = {
  pricePerStudentPerTermMinor?: number | null;
  minimumTermFeeMinor?: number | null;
  annualDiscountPercent?: number | null;
  billingCadence?: BillingCadence | null;
  studentCount?: number | null;
};

export type SubscriptionBasePriceBreakdown = {
  studentCount: number;
  pricePerStudentPerTermMinor: number | null;
  perStudentSubtotalPerTermMinor: number;
  minimumTermFeeMinor: number | null;
  minimumStudentThreshold: number | null;
  termBasePriceMinor: number;
  billingTerms: number;
  annualDiscountPercent: number | null;
  annualDiscountAmountMinor: number;
  basePriceMinor: number;
};

export type SubscriptionPricingBreakdown = {
  baseTierPriceMinor: number;
  effectiveBasePriceMinor: number;
  discountAmountMinor: number;
  finalPriceMinor: number;
};

function normaliseMinor(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

export function computeSubscriptionBasePrice(
  input: SubscriptionBasePriceInput
): SubscriptionBasePriceBreakdown {
  const studentCount = Math.max(0, Math.round(input.studentCount ?? 0));
  const pricePerStudentPerTermMinor = normaliseMinor(input.pricePerStudentPerTermMinor);
  const minimumTermFeeMinor = normaliseMinor(input.minimumTermFeeMinor);

  const perStudentSubtotalPerTermMinor =
    pricePerStudentPerTermMinor != null ? studentCount * pricePerStudentPerTermMinor : 0;

  const termBasePriceMinor = Math.max(
    perStudentSubtotalPerTermMinor,
    minimumTermFeeMinor ?? 0
  );

  const billingTerms = input.billingCadence === "annual" ? TERMS_PER_ACADEMIC_YEAR : 1;
  const annualSubtotalMinor = termBasePriceMinor * billingTerms;
  const annualDiscountPercent =
    input.billingCadence === "annual" && typeof input.annualDiscountPercent === "number"
      ? Math.min(100, Math.max(0, input.annualDiscountPercent))
      : null;
  const annualDiscountAmountMinor =
    annualDiscountPercent != null
      ? Math.round((annualSubtotalMinor * annualDiscountPercent) / 100)
      : 0;

  const minimumStudentThreshold =
    minimumTermFeeMinor != null && pricePerStudentPerTermMinor != null && pricePerStudentPerTermMinor > 0
      ? Math.ceil(minimumTermFeeMinor / pricePerStudentPerTermMinor)
      : null;

  return {
    studentCount,
    pricePerStudentPerTermMinor,
    perStudentSubtotalPerTermMinor,
    minimumTermFeeMinor,
    minimumStudentThreshold,
    termBasePriceMinor,
    billingTerms,
    annualDiscountPercent,
    annualDiscountAmountMinor,
    basePriceMinor: Math.max(0, annualSubtotalMinor - annualDiscountAmountMinor),
  };
}

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
