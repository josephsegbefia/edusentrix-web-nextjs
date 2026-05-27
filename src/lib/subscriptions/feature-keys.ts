/**
 * Canonical subscription feature key registry.
 *
 * RULES:
 * - All feature keys must be defined here. Never use raw string literals for feature keys anywhere in the app.
 * - Dotted namespace format: "module.feature" or "module.sub_feature".
 * - Unknown keys must be rejected by assertKnownFeatureKey().
 * - Legacy flat keys (core_school_ops, ai_leo_copilot, etc.) are NOT supported here.
 *   See scripts/audit-legacy-feature-keys.ts for the migration scanner.
 */

// ---------------------------------------------------------------------------
// FEATURE_KEYS — flat-key export for convenience
// ---------------------------------------------------------------------------

export const FEATURE_KEYS = {
  // Core school operations
  SCHOOL_PROFILE: "core.school_profile",
  ACADEMIC_PERIODS: "core.academic_periods",
  CLASSES: "core.classes",
  STUDENTS: "core.students",
  TEACHERS: "core.teachers",
  PARENTS: "core.parents",
  INVITATIONS: "core.invitations",

  // Admissions
  ADMISSIONS: "admissions.applications",
  ADMISSION_FEES: "admissions.fees",

  // Finance
  FINANCE_FEES: "finance.fees",
  FINANCE_INVOICES: "finance.invoices",
  FINANCE_PAYMENTS: "finance.payments",
  FINANCE_PARENT_PAYMENTS: "finance.parent_payments",
  FINANCE_RECONCILIATION: "finance.reconciliation",
  FINANCE_DISBURSEMENTS: "finance.disbursements",
  FINANCE_REPORTS: "finance.reports",

  // Communications
  COMMUNICATION_NOTICES: "communications.notices",
  COMMUNICATION_MESSAGING: "communications.messaging",
  COMMUNICATION_COMMUNITY: "communications.community",

  // Academics
  ACADEMICS_SUBJECTS: "academics.subjects",
  ACADEMICS_CURRICULUM: "academics.curriculum",
  ACADEMICS_SCHEMES: "academics.schemes",
  ACADEMICS_LESSON_NOTES: "academics.lesson_notes",
  ACADEMICS_LESSONS: "academics.lessons",

  // Assessment
  ASSESSMENT_EXAMINATIONS: "assessment.examinations",
  ASSESSMENT_QUESTION_BANK: "assessment.question_bank",

  // AI features
  AI_LEO: "ai.leo",
  AI_LESSON_GENERATION: "ai.lesson_generation",
  AI_ANALYTICS: "ai.analytics",
  AI_EXAM_GENERATION: "ai.exam_generation",

  // EduSentrix Learn
  LEARN_MANAGE: "learn.manage",
  LEARN_STUDENT_ACCESS: "learn.student_access",

  // Meetings
  MEETINGS_VIDEO: "meetings.video",

  // Analytics
  ANALYTICS_BASIC: "analytics.basic",
  ANALYTICS_ADVANCED: "analytics.advanced",

  // Documents & storage
  DOCUMENTS_STORAGE: "documents.storage",
  DOCUMENTS_EXPORTS: "documents.exports",

  // Platform / support
  SUPPORT_PRIORITY: "support.priority",
  DEVELOPER_API_ACCESS: "developer.api_access",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

// ---------------------------------------------------------------------------
// Feature metadata
// ---------------------------------------------------------------------------

type SchoolRole =
  | "school_admin"
  | "bursar"
  | "billing_owner"
  | "teacher"
  | "parent"
  | "student";

export type FeatureDefinition = {
  key: FeatureKey;
  label: string;
  description: string;
  module: string;
  /** Which school roles can use this feature (empty = all authed school roles). */
  allowedForRoles?: SchoolRole[];
  /** Whether an additional usage credit check is required before allowing the action. */
  requiresUsageCheck?: boolean;
  /** Whether server-side payment charge resolution is required in flows for this feature. */
  requiresPaymentChargeCheck?: boolean;
};

export const FEATURE_DEFINITIONS: Record<FeatureKey, FeatureDefinition> = {
  // Core
  "core.school_profile": {
    key: "core.school_profile",
    label: "School Profile",
    description: "View and edit school profile information.",
    module: "core",
  },
  "core.academic_periods": {
    key: "core.academic_periods",
    label: "Academic Periods",
    description: "Manage academic years and terms.",
    module: "core",
  },
  "core.classes": {
    key: "core.classes",
    label: "Grades & Classes",
    description: "Manage grades, class groups, and subject offerings.",
    module: "core",
  },
  "core.students": {
    key: "core.students",
    label: "Students",
    description: "View and manage student records.",
    module: "core",
    allowedForRoles: ["school_admin", "bursar", "teacher"],
  },
  "core.teachers": {
    key: "core.teachers",
    label: "Teachers & Staff",
    description: "View and manage teacher and staff records.",
    module: "core",
    allowedForRoles: ["school_admin"],
  },
  "core.parents": {
    key: "core.parents",
    label: "Parents & Guardians",
    description: "View parent/guardian links and parent accounts.",
    module: "core",
    allowedForRoles: ["school_admin", "bursar"],
  },
  "core.invitations": {
    key: "core.invitations",
    label: "Invitations",
    description: "Invite teachers, parents, and staff.",
    module: "core",
    allowedForRoles: ["school_admin"],
  },

  // Admissions
  "admissions.applications": {
    key: "admissions.applications",
    label: "Admissions",
    description: "Manage admission cycles and applications.",
    module: "admissions",
    allowedForRoles: ["school_admin"],
  },
  "admissions.fees": {
    key: "admissions.fees",
    label: "Admission Fees",
    description: "Collect and manage admission application fees.",
    module: "admissions",
    requiresPaymentChargeCheck: true,
  },

  // Finance
  "finance.fees": {
    key: "finance.fees",
    label: "Fee Setup",
    description: "Create and manage school fee structures.",
    module: "finance",
    allowedForRoles: ["school_admin", "bursar"],
  },
  "finance.invoices": {
    key: "finance.invoices",
    label: "Invoices",
    description: "View and manage student fee invoices.",
    module: "finance",
    allowedForRoles: ["school_admin", "bursar"],
  },
  "finance.payments": {
    key: "finance.payments",
    label: "Payments",
    description: "Record and track school fee payments.",
    module: "finance",
    requiresPaymentChargeCheck: true,
    allowedForRoles: ["school_admin", "bursar"],
  },
  "finance.parent_payments": {
    key: "finance.parent_payments",
    label: "Parent Payments",
    description: "Parent-facing fee payment flows.",
    module: "finance",
    requiresPaymentChargeCheck: true,
    allowedForRoles: ["parent"],
  },
  "finance.reconciliation": {
    key: "finance.reconciliation",
    label: "Reconciliation",
    description: "Reconcile fee payments and resolve discrepancies.",
    module: "finance",
    allowedForRoles: ["school_admin", "bursar"],
  },
  "finance.disbursements": {
    key: "finance.disbursements",
    label: "Disbursements",
    description: "Settlement and payout management.",
    module: "finance",
    allowedForRoles: ["school_admin", "bursar", "billing_owner"],
  },
  "finance.reports": {
    key: "finance.reports",
    label: "Finance Reports",
    description: "Finance summaries and reports.",
    module: "finance",
    allowedForRoles: ["school_admin", "bursar"],
  },

  // Communications
  "communications.notices": {
    key: "communications.notices",
    label: "Notices",
    description: "Send notices and announcements to parents and students.",
    module: "communications",
  },
  "communications.messaging": {
    key: "communications.messaging",
    label: "Messaging",
    description: "Direct and bulk messaging.",
    module: "communications",
  },
  "communications.community": {
    key: "communications.community",
    label: "Community",
    description: "Community boards and discussions.",
    module: "communications",
  },

  // Academics
  "academics.subjects": {
    key: "academics.subjects",
    label: "Subjects",
    description: "Manage subject offerings and assignments.",
    module: "academics",
    allowedForRoles: ["school_admin", "teacher"],
  },
  "academics.curriculum": {
    key: "academics.curriculum",
    label: "Curriculum",
    description: "Curriculum planning and syllabi.",
    module: "academics",
    allowedForRoles: ["school_admin", "teacher"],
  },
  "academics.schemes": {
    key: "academics.schemes",
    label: "Schemes of Learning",
    description: "Build and manage schemes of learning.",
    module: "academics",
    allowedForRoles: ["school_admin", "teacher"],
  },
  "academics.lesson_notes": {
    key: "academics.lesson_notes",
    label: "Lesson Notes",
    description: "Create, submit, and review lesson notes.",
    module: "academics",
    allowedForRoles: ["school_admin", "teacher"],
  },
  "academics.lessons": {
    key: "academics.lessons",
    label: "Lessons",
    description: "Lesson delivery and session management.",
    module: "academics",
    allowedForRoles: ["school_admin", "teacher"],
  },

  // Assessment
  "assessment.examinations": {
    key: "assessment.examinations",
    label: "Examinations",
    description: "Create and manage examination papers.",
    module: "assessment",
    allowedForRoles: ["school_admin", "teacher"],
  },
  "assessment.question_bank": {
    key: "assessment.question_bank",
    label: "Question Bank",
    description: "Maintain a reusable question bank.",
    module: "assessment",
    allowedForRoles: ["school_admin", "teacher"],
  },

  // AI
  "ai.leo": {
    key: "ai.leo",
    label: "Leo AI",
    description: "Leo AI assistant and co-pilot.",
    module: "ai",
    requiresUsageCheck: true,
    allowedForRoles: ["school_admin", "teacher"],
  },
  "ai.lesson_generation": {
    key: "ai.lesson_generation",
    label: "AI Lesson Generation",
    description: "AI-powered lesson note drafting.",
    module: "ai",
    requiresUsageCheck: true,
    allowedForRoles: ["school_admin", "teacher"],
  },
  "ai.analytics": {
    key: "ai.analytics",
    label: "AI Analytics",
    description: "AI-powered analytics and insights.",
    module: "ai",
    requiresUsageCheck: true,
    allowedForRoles: ["school_admin"],
  },
  "ai.exam_generation": {
    key: "ai.exam_generation",
    label: "AI Exam Generation",
    description: "AI-generated exam questions and papers.",
    module: "ai",
    requiresUsageCheck: true,
    allowedForRoles: ["school_admin", "teacher"],
  },

  // Learn
  "learn.manage": {
    key: "learn.manage",
    label: "Manage EduSentrix Learn",
    description: "Manage school EduSentrix Learn access and student accounts.",
    module: "learn",
    allowedForRoles: ["school_admin"],
  },
  "learn.student_access": {
    key: "learn.student_access",
    label: "EduSentrix Learn (Student)",
    description: "Student access to EduSentrix Learn platform.",
    module: "learn",
    requiresUsageCheck: true,
    allowedForRoles: ["student"],
  },

  // Meetings
  "meetings.video": {
    key: "meetings.video",
    label: "Video Meetings",
    description: "Schedule and run video meetings.",
    module: "meetings",
    requiresUsageCheck: true,
  },

  // Analytics
  "analytics.basic": {
    key: "analytics.basic",
    label: "Basic Analytics",
    description: "Basic school performance analytics and dashboards.",
    module: "analytics",
  },
  "analytics.advanced": {
    key: "analytics.advanced",
    label: "Advanced Analytics",
    description: "Advanced analytics, trends, and reports.",
    module: "analytics",
    allowedForRoles: ["school_admin"],
  },

  // Documents
  "documents.storage": {
    key: "documents.storage",
    label: "Document Storage",
    description: "Upload and store school documents.",
    module: "documents",
    requiresUsageCheck: true,
  },
  "documents.exports": {
    key: "documents.exports",
    label: "Data Exports",
    description: "Export student, finance, and academic data.",
    module: "documents",
    requiresUsageCheck: true,
  },

  // Support / Developer
  "support.priority": {
    key: "support.priority",
    label: "Priority Support",
    description: "Priority support response SLA.",
    module: "support",
  },
  "developer.api_access": {
    key: "developer.api_access",
    label: "API Access",
    description: "External API access for integrations.",
    module: "developer",
  },
};

// ---------------------------------------------------------------------------
// Canonical set for fast lookup
// ---------------------------------------------------------------------------

const KNOWN_FEATURE_KEYS = new Set<string>(Object.values(FEATURE_KEYS));

/**
 * Asserts the given key is a known canonical feature key.
 *
 * - In development or test: throws immediately.
 * - In production: returns false (caller should deny and log).
 */
export function assertKnownFeatureKey(
  featureKey: string
): featureKey is FeatureKey {
  if (KNOWN_FEATURE_KEYS.has(featureKey)) return true;

  const msg = `[EduSentrix Subscriptions] Unknown feature key: "${featureKey}". Add it to src/lib/subscriptions/feature-keys.ts or fix the caller.`;

  if (process.env.NODE_ENV !== "production") {
    throw new Error(msg);
  }

  console.error(msg);
  return false;
}

export function isKnownFeatureKey(featureKey: string): featureKey is FeatureKey {
  return KNOWN_FEATURE_KEYS.has(featureKey);
}
