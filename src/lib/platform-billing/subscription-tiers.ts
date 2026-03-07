import { SubscriptionTier, type ISubscriptionTier } from "@/models/SubscriptionTier";

const DEFAULT_TIERS: Array<
  Pick<
    ISubscriptionTier,
    | "code"
    | "name"
    | "description"
    | "priceMinor"
    | "billingCadence"
    | "studentLimit"
    | "features"
    | "provisional"
    | "active"
    | "sortOrder"
  >
> = [
  {
    code: "pilot_starter",
    name: "Pilot Starter",
    description: "Small pilot schools validating the platform foundation.",
    priceMinor: 250000,
    billingCadence: "monthly",
    studentLimit: 300,
    features: ["core_school_ops", "payments", "support"],
    provisional: true,
    active: true,
    sortOrder: 1,
  },
  {
    code: "pilot_growth",
    name: "Pilot Growth",
    description: "Mid-sized pilot schools with broader operational usage.",
    priceMinor: 450000,
    billingCadence: "monthly",
    studentLimit: 900,
    features: ["core_school_ops", "payments", "reports", "support"],
    provisional: true,
    active: true,
    sortOrder: 2,
  },
  {
    code: "pilot_scale",
    name: "Pilot Scale",
    description: "Large pilot schools with heavier operational demand.",
    priceMinor: 750000,
    billingCadence: "monthly",
    studentLimit: null,
    features: [
      "core_school_ops",
      "payments",
      "reports",
      "priority_support",
      "pilot_priority",
    ],
    provisional: true,
    active: true,
    sortOrder: 3,
  },
];

export async function ensureDefaultSubscriptionTiers() {
  await Promise.all(
    DEFAULT_TIERS.map((tier) =>
      SubscriptionTier.updateOne({ code: tier.code }, { $setOnInsert: tier }, { upsert: true })
    )
  );

  return SubscriptionTier.find({ active: true }).sort({ sortOrder: 1, name: 1 });
}
