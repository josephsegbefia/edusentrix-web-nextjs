/**
 * API feature registry.
 *
 * Maps API route paths to the feature key(s) that protect them.
 * Consumed by:
 * - scripts/audit-feature-gates.ts — checks guards are in place.
 * - P1.6 — wires enforcement into actual route handlers.
 *
 * HTTP methods are described for documentation; gate logic in routes uses
 * requireSchoolFeature() and enforceSchoolLimit() directly.
 *
 * Paths use Next.js API route convention (/api/...).
 * Dynamic segments use [param] notation.
 */

import type { FeatureKey } from "./feature-keys";
import { FEATURE_KEYS } from "./feature-keys";
import type { LimitKey } from "./limit-keys";
import { LIMIT_KEYS } from "./limit-keys";

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiRegistryEntry = {
  apiPath: string;
  label: string;
  /** Feature key required to call this endpoint. null = always accessible. */
  requiredFeature: FeatureKey | null;
  /** Limit key enforced on mutations (usually POST/PUT). */
  limitKey?: LimitKey;
  methods: ApiMethod[];
  /** If true, GET is always allowed (read-only); mutations need the feature. */
  readGetFree?: boolean;
};

export const API_FEATURE_REGISTRY: ApiRegistryEntry[] = [
  // ---------------------------------------------------------------------------
  // Students
  // ---------------------------------------------------------------------------
  {
    apiPath: "/api/admin/students",
    label: "List / create students",
    requiredFeature: FEATURE_KEYS.STUDENTS,
    limitKey: LIMIT_KEYS.maxStudents,
    methods: ["GET", "POST"],
    readGetFree: true,
  },
  {
    apiPath: "/api/admin/students/[id]",
    label: "Get / update / delete student",
    requiredFeature: FEATURE_KEYS.STUDENTS,
    methods: ["GET", "PUT", "PATCH", "DELETE"],
    readGetFree: true,
  },

  // ---------------------------------------------------------------------------
  // Teachers
  // ---------------------------------------------------------------------------
  {
    apiPath: "/api/admin/teachers",
    label: "List / create teachers",
    requiredFeature: FEATURE_KEYS.TEACHERS,
    limitKey: LIMIT_KEYS.maxTeachers,
    methods: ["GET", "POST"],
    readGetFree: true,
  },
  {
    apiPath: "/api/admin/teachers/[id]",
    label: "Get / update teacher",
    requiredFeature: FEATURE_KEYS.TEACHERS,
    methods: ["GET", "PUT", "PATCH", "DELETE"],
    readGetFree: true,
  },

  // ---------------------------------------------------------------------------
  // Invitations
  // ---------------------------------------------------------------------------
  {
    apiPath: "/api/admin/invitations",
    label: "List / send invitations",
    requiredFeature: FEATURE_KEYS.INVITATIONS,
    limitKey: LIMIT_KEYS.maxInvitationsPerMonth,
    methods: ["GET", "POST"],
    readGetFree: true,
  },

  // ---------------------------------------------------------------------------
  // Finance — fees
  // ---------------------------------------------------------------------------
  {
    apiPath: "/api/admin/fees",
    label: "List / create fee structures",
    requiredFeature: FEATURE_KEYS.FINANCE_FEES,
    methods: ["GET", "POST"],
    readGetFree: true,
  },
  {
    apiPath: "/api/admin/fees/[id]",
    label: "Update / delete fee structure",
    requiredFeature: FEATURE_KEYS.FINANCE_FEES,
    methods: ["GET", "PUT", "PATCH", "DELETE"],
    readGetFree: true,
  },

  // ---------------------------------------------------------------------------
  // Finance — invoices
  // ---------------------------------------------------------------------------
  {
    apiPath: "/api/admin/invoices",
    label: "List / create invoices",
    requiredFeature: FEATURE_KEYS.FINANCE_INVOICES,
    methods: ["GET", "POST"],
    readGetFree: true,
  },
  {
    apiPath: "/api/admin/invoices/[id]",
    label: "Update invoice",
    requiredFeature: FEATURE_KEYS.FINANCE_INVOICES,
    methods: ["GET", "PUT", "PATCH"],
    readGetFree: true,
  },

  // ---------------------------------------------------------------------------
  // Finance — payments (school admin)
  // ---------------------------------------------------------------------------
  {
    apiPath: "/api/admin/payments",
    label: "List / record payments",
    requiredFeature: FEATURE_KEYS.FINANCE_PAYMENTS,
    methods: ["GET", "POST"],
    readGetFree: true,
  },

  // ---------------------------------------------------------------------------
  // Finance — payments (parent-facing)
  // ---------------------------------------------------------------------------
  {
    apiPath: "/api/parent/payments",
    label: "Parent payment flow",
    requiredFeature: FEATURE_KEYS.FINANCE_PARENT_PAYMENTS,
    methods: ["GET", "POST"],
    readGetFree: true,
  },
  {
    apiPath: "/api/parent/payments/initiate",
    label: "Initiate parent payment",
    requiredFeature: FEATURE_KEYS.FINANCE_PARENT_PAYMENTS,
    methods: ["POST"],
  },

  // ---------------------------------------------------------------------------
  // Admissions
  // ---------------------------------------------------------------------------
  {
    apiPath: "/api/admin/admissions",
    label: "List / create admission cycles",
    requiredFeature: FEATURE_KEYS.ADMISSIONS,
    methods: ["GET", "POST"],
    readGetFree: true,
  },
  {
    apiPath: "/api/admin/admissions/[cycleId]",
    label: "Manage admission cycle",
    requiredFeature: FEATURE_KEYS.ADMISSIONS,
    methods: ["GET", "PUT", "PATCH", "DELETE"],
    readGetFree: true,
  },
  {
    apiPath: "/api/admin/admissions/[cycleId]/applications",
    label: "Applications",
    requiredFeature: FEATURE_KEYS.ADMISSIONS,
    methods: ["GET", "POST"],
    readGetFree: true,
  },

  // ---------------------------------------------------------------------------
  // Communications
  // ---------------------------------------------------------------------------
  {
    apiPath: "/api/admin/communications/notices",
    label: "Notices",
    requiredFeature: FEATURE_KEYS.COMMUNICATION_NOTICES,
    methods: ["GET", "POST", "PUT", "DELETE"],
    readGetFree: true,
  },
  {
    apiPath: "/api/admin/communications/messages",
    label: "Messaging",
    requiredFeature: FEATURE_KEYS.COMMUNICATION_MESSAGING,
    methods: ["GET", "POST"],
    readGetFree: true,
  },

  // ---------------------------------------------------------------------------
  // Academics
  // ---------------------------------------------------------------------------
  {
    apiPath: "/api/admin/schemes",
    label: "Schemes of Learning",
    requiredFeature: FEATURE_KEYS.ACADEMICS_SCHEMES,
    methods: ["GET", "POST", "PUT", "DELETE"],
    readGetFree: true,
  },
  {
    apiPath: "/api/admin/lesson-notes",
    label: "Lesson Notes",
    requiredFeature: FEATURE_KEYS.ACADEMICS_LESSON_NOTES,
    methods: ["GET", "POST", "PUT", "DELETE"],
    readGetFree: true,
  },
  {
    apiPath: "/api/teacher/lesson-notes",
    label: "Teacher lesson notes",
    requiredFeature: FEATURE_KEYS.ACADEMICS_LESSON_NOTES,
    methods: ["GET", "POST", "PUT"],
    readGetFree: true,
  },

  // ---------------------------------------------------------------------------
  // Assessment
  // ---------------------------------------------------------------------------
  {
    apiPath: "/api/admin/examinations",
    label: "Examinations",
    requiredFeature: FEATURE_KEYS.ASSESSMENT_EXAMINATIONS,
    limitKey: LIMIT_KEYS.examGenerationsPerTerm,
    methods: ["GET", "POST", "PUT", "DELETE"],
    readGetFree: true,
  },
  {
    apiPath: "/api/admin/question-bank",
    label: "Question Bank",
    requiredFeature: FEATURE_KEYS.ASSESSMENT_QUESTION_BANK,
    methods: ["GET", "POST", "PUT", "DELETE"],
    readGetFree: true,
  },

  // ---------------------------------------------------------------------------
  // AI / Leo
  // ---------------------------------------------------------------------------
  {
    apiPath: "/api/admin/ai/leo",
    label: "Leo AI chat/co-pilot",
    requiredFeature: FEATURE_KEYS.AI_LEO,
    methods: ["POST"],
  },
  {
    apiPath: "/api/admin/ai/lesson-notes",
    label: "AI lesson note generation",
    requiredFeature: FEATURE_KEYS.AI_LESSON_GENERATION,
    methods: ["POST"],
  },
  {
    apiPath: "/api/admin/ai/exam-questions",
    label: "AI exam question generation",
    requiredFeature: FEATURE_KEYS.AI_EXAM_GENERATION,
    limitKey: LIMIT_KEYS.examGenerationsPerTerm,
    methods: ["POST"],
  },
  {
    apiPath: "/api/teacher/ai/lesson-notes",
    label: "Teacher AI lesson note generation",
    requiredFeature: FEATURE_KEYS.AI_LESSON_GENERATION,
    methods: ["POST"],
  },

  // ---------------------------------------------------------------------------
  // EduSentrix Learn
  // ---------------------------------------------------------------------------
  {
    apiPath: "/api/admin/learn",
    label: "School admin manage Learn",
    requiredFeature: FEATURE_KEYS.LEARN_MANAGE,
    methods: ["GET", "POST", "PUT"],
    readGetFree: true,
  },
  {
    apiPath: "/api/parent/learn",
    label: "Parent learn access",
    requiredFeature: FEATURE_KEYS.LEARN_STUDENT_ACCESS,
    methods: ["GET", "POST"],
    readGetFree: true,
  },

  // ---------------------------------------------------------------------------
  // Analytics
  // ---------------------------------------------------------------------------
  {
    apiPath: "/api/admin/analytics",
    label: "Basic analytics",
    requiredFeature: FEATURE_KEYS.ANALYTICS_BASIC,
    methods: ["GET"],
  },
  {
    apiPath: "/api/admin/analytics/advanced",
    label: "Advanced analytics",
    requiredFeature: FEATURE_KEYS.ANALYTICS_ADVANCED,
    methods: ["GET"],
  },

  // ---------------------------------------------------------------------------
  // Data exports
  // ---------------------------------------------------------------------------
  {
    apiPath: "/api/admin/exports",
    label: "Data exports",
    requiredFeature: FEATURE_KEYS.DOCUMENTS_EXPORTS,
    limitKey: LIMIT_KEYS.reportExportsPerTerm,
    methods: ["GET", "POST"],
  },

  // ---------------------------------------------------------------------------
  // Entitlements (mobile companion app)
  // ---------------------------------------------------------------------------
  {
    apiPath: "/api/parent/entitlements",
    label: "Parent entitlements (mobile)",
    requiredFeature: null,
    methods: ["GET"],
  },
  {
    apiPath: "/api/teacher/me",
    label: "Teacher context (mobile)",
    requiredFeature: null,
    methods: ["GET"],
  },
];

// ---------------------------------------------------------------------------
// Lookup helper
// ---------------------------------------------------------------------------

export function getApiEntry(
  apiPath: string,
  registry: ApiRegistryEntry[] = API_FEATURE_REGISTRY
): ApiRegistryEntry | null {
  const exact = registry.find((r) => r.apiPath === apiPath);
  if (exact) return exact;

  for (const entry of registry) {
    const pattern = entry.apiPath
      .replace(/\[[^\]]+\]/g, "[^/]+")
      .replace(/\//g, "\\/");
    if (new RegExp(`^${pattern}$`).test(apiPath)) {
      return entry;
    }
  }

  return null;
}
