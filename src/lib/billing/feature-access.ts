export type SubscriptionFeatureKey =
  | "core_school_ops"
  | "students"
  | "teachers"
  | "invitations"
  | "fees"
  | "payments"
  | "parent_payments"
  | "disbursements"
  | "reports"
  | "analytics"
  | "curriculum_scheme"
  | "lesson_notes"
  | "examinations"
  | "question_bank"
  | "ai_lesson_notes"
  | "ai_leo_copilot"
  | "community"
  | "community_hub"
  | "enterprise"
  | "api_access"
  | "priority_support";

export type SubscriptionLimitKey =
  | "maxStudents"
  | "maxTeachers"
  | "maxInvitationsPerMonth"
  | "maxAICallsPerMonth"
  | "maxStorageBytes";

export type SubscriptionLimits = Record<SubscriptionLimitKey, number | null>;

const GB = 1024 * 1024 * 1024;

const FEATURE_ALIASES: Record<SubscriptionFeatureKey, string[]> = {
  core_school_ops: ["core_school_ops"],
  students: ["core_school_ops", "students"],
  teachers: ["core_school_ops", "teachers"],
  invitations: ["core_school_ops", "invitations"],
  fees: ["payments", "fees"],
  payments: ["payments"],
  parent_payments: ["payments", "parent_payments"],
  disbursements: ["payments", "disbursements"],
  reports: ["reports"],
  analytics: ["reports", "analytics"],
  curriculum_scheme: ["curriculum_scheme", "academics"],
  lesson_notes: ["lesson_notes", "ai_lesson_notes", "academics"],
  examinations: ["examinations", "question_bank"],
  question_bank: ["question_bank", "examinations"],
  ai_lesson_notes: ["reports", "ai_reports", "ai_lesson_notes"],
  ai_leo_copilot: ["ai_leo_copilot"],
  community: ["community", "community_hub"],
  community_hub: ["community", "community_hub"],
  enterprise: ["enterprise"],
  api_access: ["api_access", "enterprise"],
  priority_support: ["priority_support", "enterprise"],
};

const DEFAULT_LIMITS: Record<string, Omit<SubscriptionLimits, "maxStudents">> = {
  starter: {
    maxTeachers: 25,
    maxInvitationsPerMonth: 40,
    maxAICallsPerMonth: 0,
    maxStorageBytes: 5 * GB,
  },
  growth: {
    maxTeachers: 80,
    maxInvitationsPerMonth: 150,
    maxAICallsPerMonth: 300,
    maxStorageBytes: 25 * GB,
  },
  premium: {
    maxTeachers: null,
    maxInvitationsPerMonth: 500,
    maxAICallsPerMonth: 1200,
    maxStorageBytes: 100 * GB,
  },
  enterprise: {
    maxTeachers: null,
    maxInvitationsPerMonth: null,
    maxAICallsPerMonth: null,
    maxStorageBytes: null,
  },
  pilot_starter: {
    maxTeachers: 25,
    maxInvitationsPerMonth: 40,
    maxAICallsPerMonth: 80,
    maxStorageBytes: 5 * GB,
  },
  pilot_growth: {
    maxTeachers: 80,
    maxInvitationsPerMonth: 150,
    maxAICallsPerMonth: 300,
    maxStorageBytes: 25 * GB,
  },
  pilot_scale: {
    maxTeachers: null,
    maxInvitationsPerMonth: 500,
    maxAICallsPerMonth: 1200,
    maxStorageBytes: 100 * GB,
  },
};

export function hasTierFeature(
  features: string[],
  featureKey: SubscriptionFeatureKey
) {
  const normalized = new Set(
    features.map((feature) => feature.trim().toLowerCase()).filter(Boolean)
  );

  const candidates = FEATURE_ALIASES[featureKey] || [featureKey];
  return candidates.some((candidate) => normalized.has(candidate));
}

export function resolveTierLimits(input: {
  tierCode?: string | null;
  studentLimit?: number | null;
}): SubscriptionLimits {
  const defaults = input.tierCode ? DEFAULT_LIMITS[input.tierCode] : null;

  return {
    maxStudents:
      typeof input.studentLimit === "number" && input.studentLimit >= 0
        ? input.studentLimit
        : null,
    maxTeachers: defaults?.maxTeachers ?? null,
    maxInvitationsPerMonth: defaults?.maxInvitationsPerMonth ?? null,
    maxAICallsPerMonth: defaults?.maxAICallsPerMonth ?? null,
    maxStorageBytes: defaults?.maxStorageBytes ?? null,
  };
}
