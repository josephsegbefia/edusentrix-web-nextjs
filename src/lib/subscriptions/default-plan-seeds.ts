import { SubscriptionTier } from "@/models/SubscriptionTier";
import { PLAN_CODES, PLAN_META, type PlanCode } from "./plan-codes";
import { getDefaultFeaturesForPlan } from "./plan-defaults";
import { DEFAULT_PLAN_LIMITS } from "./limit-keys";

export function getCanonicalSubscriptionPlanSeeds() {
  return [
    {
      code: PLAN_CODES.PILOT,
      name: PLAN_META.pilot.label,
      description: PLAN_META.pilot.description,
      publicVisible: PLAN_META.pilot.publicVisible,
      priceMinor: 0,
      billingCadence: "custom" as const,
      pricing: {
        currency: "GHS",
        pricePerStudentPerTermMinor: null,
        minimumTermFeeMinor: null,
        annualDiscountPercent: null,
        onboardingFeeMinor: null,
      },
      features: [],
      limits: DEFAULT_PLAN_LIMITS.pilot,
      pilotDefaults: {
        defaultDurationDays: 30,
        gracePeriodDays: 7,
      },
      version: 1,
      active: true,
      provisional: false,
      sortOrder: PLAN_META.pilot.sortOrder,
    },
    {
      code: PLAN_CODES.STARTER,
      name: PLAN_META.starter.label,
      description: PLAN_META.starter.description,
      publicVisible: PLAN_META.starter.publicVisible,
      priceMinor: 800_00,
      billingCadence: "term" as const,
      pricing: {
        currency: "GHS",
        pricePerStudentPerTermMinor: 8_00,
        minimumTermFeeMinor: 800_00,
        annualDiscountPercent: 10,
        onboardingFeeMinor: null,
      },
      features: getDefaultFeaturesForPlan(PLAN_CODES.STARTER),
      limits: DEFAULT_PLAN_LIMITS.starter,
      version: 1,
      active: true,
      provisional: false,
      sortOrder: PLAN_META.starter.sortOrder,
    },
    {
      code: PLAN_CODES.GROWTH,
      name: PLAN_META.growth.label,
      description: PLAN_META.growth.description,
      publicVisible: PLAN_META.growth.publicVisible,
      priceMinor: 1500_00,
      billingCadence: "term" as const,
      pricing: {
        currency: "GHS",
        pricePerStudentPerTermMinor: 15_00,
        minimumTermFeeMinor: 1500_00,
        annualDiscountPercent: 10,
        onboardingFeeMinor: null,
      },
      features: getDefaultFeaturesForPlan(PLAN_CODES.GROWTH),
      limits: DEFAULT_PLAN_LIMITS.growth,
      version: 1,
      active: true,
      provisional: false,
      sortOrder: PLAN_META.growth.sortOrder,
    },
    {
      code: PLAN_CODES.ENTERPRISE,
      name: PLAN_META.enterprise.label,
      description: PLAN_META.enterprise.description,
      publicVisible: PLAN_META.enterprise.publicVisible,
      priceMinor: 2500_00,
      billingCadence: "term" as const,
      pricing: {
        currency: "GHS",
        pricePerStudentPerTermMinor: 25_00,
        minimumTermFeeMinor: 2500_00,
        annualDiscountPercent: 10,
        onboardingFeeMinor: null,
      },
      features: getDefaultFeaturesForPlan(PLAN_CODES.ENTERPRISE),
      limits: DEFAULT_PLAN_LIMITS.enterprise,
      version: 1,
      active: true,
      provisional: false,
      sortOrder: PLAN_META.enterprise.sortOrder,
    },
  ] satisfies Array<Record<string, unknown> & { code: PlanCode; features: string[] }>;
}

export async function syncCanonicalSubscriptionPlans(options?: {
  dryRun?: boolean;
  dropExisting?: boolean;
}) {
  const seeds = getCanonicalSubscriptionPlanSeeds();

  if (options?.dropExisting && !options.dryRun) {
    await SubscriptionTier.deleteMany({
      code: { $in: Object.values(PLAN_CODES) },
    });
  }

  const results: Array<{
    code: PlanCode;
    id: string | null;
    action: "upserted" | "dry_run";
    featureCount: number;
  }> = [];

  for (const seed of seeds) {
    const { code, ...data } = seed;
    if (options?.dryRun) {
      results.push({
        code,
        id: null,
        action: "dry_run",
        featureCount: seed.features.length,
      });
      continue;
    }

    const result = await SubscriptionTier.findOneAndUpdate(
      { code },
      { $set: data },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    results.push({
      code,
      id: String(result._id),
      action: "upserted",
      featureCount: seed.features.length,
    });
  }

  return {
    total: seeds.length,
    dryRun: Boolean(options?.dryRun),
    droppedExisting: Boolean(options?.dropExisting && !options.dryRun),
    results,
  };
}
