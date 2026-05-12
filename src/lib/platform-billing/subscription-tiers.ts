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
    | "pricing"
    | "limits"
    | "transactionFees"
    | "trialDefaults"
    | "pilotDefaults"
    | "publicVisible"
    | "version"
    | "provisional"
    | "active"
    | "sortOrder"
  >
> = [
  {
    code: "starter",
    name: "Starter",
    description: "Core school operations for smaller schools starting on EduSentrix.",
    priceMinor: 0,
    billingCadence: "term",
    studentLimit: 300,
    features: ["core_school_ops", "students", "teachers", "fees", "payments"],
    pricing: {
      currency: "GHS",
      pricePerStudentPerTermMinor: 0,
      minimumTermFeeMinor: 0,
      annualDiscountPercent: 10,
      onboardingFeeMinor: 0,
    },
    limits: {
      maxStudents: 300,
      maxTeachers: 25,
      maxInvitationsPerMonth: 40,
      maxAICallsPerMonth: 0,
      maxStorageBytes: 5 * 1024 * 1024 * 1024,
    },
    transactionFees: {
      schoolFeesPlatformPercent: 0,
      fundraisingPlatformPercent: 0,
      payerMode: "payer_pays",
    },
    trialDefaults: {
      durationDays: 30,
      maxLeoActions: 25,
      maxStorageBytes: 2 * 1024 * 1024 * 1024,
      transactionFeesApply: true,
    },
    pilotDefaults: {
      duration: "one_term",
      maxLeoActionsPerTerm: 100,
      maxStorageBytes: 5 * 1024 * 1024 * 1024,
      transactionFeesApply: true,
    },
    publicVisible: false,
    version: 1,
    provisional: false,
    active: true,
    sortOrder: 1,
  },
  {
    code: "growth",
    name: "Growth",
    description: "Operational, finance, academics, and reporting tools for growing schools.",
    priceMinor: 0,
    billingCadence: "term",
    studentLimit: 900,
    features: [
      "core_school_ops",
      "students",
      "teachers",
      "fees",
      "payments",
      "reports",
      "analytics",
      "curriculum_scheme",
      "lesson_notes",
    ],
    pricing: {
      currency: "GHS",
      pricePerStudentPerTermMinor: 0,
      minimumTermFeeMinor: 0,
      annualDiscountPercent: 10,
      onboardingFeeMinor: 0,
    },
    limits: {
      maxStudents: 900,
      maxTeachers: 80,
      maxInvitationsPerMonth: 150,
      maxAICallsPerMonth: 300,
      maxStorageBytes: 25 * 1024 * 1024 * 1024,
    },
    transactionFees: {
      schoolFeesPlatformPercent: 0,
      fundraisingPlatformPercent: 0,
      payerMode: "payer_pays",
    },
    trialDefaults: {
      durationDays: 30,
      maxLeoActions: 50,
      maxStorageBytes: 2 * 1024 * 1024 * 1024,
      transactionFeesApply: true,
    },
    pilotDefaults: {
      duration: "one_term",
      maxLeoActionsPerTerm: 250,
      maxStorageBytes: 10 * 1024 * 1024 * 1024,
      transactionFeesApply: true,
    },
    publicVisible: false,
    version: 1,
    provisional: false,
    active: true,
    sortOrder: 2,
  },
  {
    code: "premium",
    name: "Premium",
    description: "Advanced academics, AI, examinations, communications, and automation.",
    priceMinor: 0,
    billingCadence: "term",
    studentLimit: null,
    features: [
      "core_school_ops",
      "students",
      "teachers",
      "fees",
      "payments",
      "reports",
      "analytics",
      "curriculum_scheme",
      "lesson_notes",
      "examinations",
      "question_bank",
      "ai_leo_copilot",
      "ai_lesson_notes",
      "community",
    ],
    pricing: {
      currency: "GHS",
      pricePerStudentPerTermMinor: 0,
      minimumTermFeeMinor: 0,
      annualDiscountPercent: 10,
      onboardingFeeMinor: 0,
    },
    limits: {
      maxStudents: null,
      maxTeachers: null,
      maxInvitationsPerMonth: 500,
      maxAICallsPerMonth: 1200,
      maxStorageBytes: 100 * 1024 * 1024 * 1024,
    },
    transactionFees: {
      schoolFeesPlatformPercent: 0,
      fundraisingPlatformPercent: 0,
      payerMode: "payer_pays",
    },
    trialDefaults: {
      durationDays: 30,
      maxLeoActions: 75,
      maxStorageBytes: 2 * 1024 * 1024 * 1024,
      transactionFeesApply: true,
    },
    pilotDefaults: {
      duration: "one_term",
      maxLeoActionsPerTerm: 500,
      maxStorageBytes: 25 * 1024 * 1024 * 1024,
      transactionFeesApply: true,
    },
    publicVisible: false,
    version: 1,
    provisional: false,
    active: true,
    sortOrder: 3,
  },
  {
    code: "enterprise",
    name: "Enterprise",
    description: "Custom contracts, advanced limits, integrations, and dedicated support.",
    priceMinor: 0,
    billingCadence: "custom",
    studentLimit: null,
    features: [
      "core_school_ops",
      "students",
      "teachers",
      "fees",
      "payments",
      "reports",
      "analytics",
      "curriculum_scheme",
      "lesson_notes",
      "examinations",
      "question_bank",
      "ai_leo_copilot",
      "ai_lesson_notes",
      "community",
      "enterprise",
      "api_access",
      "priority_support",
    ],
    pricing: {
      currency: "GHS",
      pricePerStudentPerTermMinor: null,
      minimumTermFeeMinor: null,
      annualDiscountPercent: 10,
      onboardingFeeMinor: null,
    },
    limits: {
      maxStudents: null,
      maxTeachers: null,
      maxInvitationsPerMonth: null,
      maxAICallsPerMonth: null,
      maxStorageBytes: null,
    },
    transactionFees: {
      schoolFeesPlatformPercent: 0,
      fundraisingPlatformPercent: 0,
      payerMode: "configurable",
    },
    trialDefaults: {
      durationDays: 30,
      maxLeoActions: 100,
      maxStorageBytes: 5 * 1024 * 1024 * 1024,
      transactionFeesApply: true,
    },
    pilotDefaults: {
      duration: "one_term",
      maxLeoActionsPerTerm: 1000,
      maxStorageBytes: 100 * 1024 * 1024 * 1024,
      transactionFeesApply: true,
    },
    publicVisible: false,
    version: 1,
    provisional: false,
    active: true,
    sortOrder: 4,
  },
  {
    code: "pilot_starter",
    name: "Pilot Starter",
    description: "Small pilot schools validating the platform foundation.",
    priceMinor: 250000,
    billingCadence: "monthly",
    studentLimit: 300,
    features: ["core_school_ops", "payments", "support"],
    pricing: null,
    limits: null,
    transactionFees: null,
    trialDefaults: null,
    pilotDefaults: null,
    publicVisible: false,
    version: 1,
    provisional: true,
    active: true,
    sortOrder: 101,
  },
  {
    code: "pilot_growth",
    name: "Pilot Growth",
    description: "Mid-sized pilot schools with broader operational usage.",
    priceMinor: 450000,
    billingCadence: "monthly",
    studentLimit: 900,
    features: ["core_school_ops", "payments", "reports", "support"],
    pricing: null,
    limits: null,
    transactionFees: null,
    trialDefaults: null,
    pilotDefaults: null,
    publicVisible: false,
    version: 1,
    provisional: true,
    active: true,
    sortOrder: 102,
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
    pricing: null,
    limits: null,
    transactionFees: null,
    trialDefaults: null,
    pilotDefaults: null,
    publicVisible: false,
    version: 1,
    provisional: true,
    active: true,
    sortOrder: 103,
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
