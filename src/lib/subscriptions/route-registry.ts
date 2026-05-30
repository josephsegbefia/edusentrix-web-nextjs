/**
 * School admin route feature registry.
 *
 * Maps every school-admin App Router page path to the feature key that must be
 * enabled for the school to access that page.
 *
 * Used by:
 * - scripts/audit-feature-gates.ts — static gate coverage check.
 * - Frontend navigation (P1.5) — hides locked routes.
 * - Locked page component (P1.4) — shows locked state when feature is disabled.
 *
 * Paths use the App Router convention (/admin/..., /teacher/..., /bursar/..., etc.).
 * Dynamic segments use [param] notation.
 *
 * requiredFeature: null means the route is always accessible (core nav, account pages).
 */

import type { FeatureKey } from "./feature-keys";
import { FEATURE_KEYS } from "./feature-keys";
import type { SchoolAccessMode } from "./access-mode";

export type RouteRegistryEntry = {
  path: string;
  label: string;
  requiredFeature: FeatureKey | null;
  /** Minimum access modes that can access this route. Defaults to allowing all except "suspended". */
  allowedInModes?: SchoolAccessMode[];
  /** If true, feature gate is gated on access mode only (data view in read-only). */
  readOnlyAllowed?: boolean;
};

export const SCHOOL_ADMIN_ROUTE_REGISTRY: RouteRegistryEntry[] = [
  // -------------------------------------------------------------------------
  // Core — always accessible
  // -------------------------------------------------------------------------
  { path: "/admin", label: "Dashboard", requiredFeature: null },
  { path: "/admin/school", label: "School Profile", requiredFeature: FEATURE_KEYS.SCHOOL_PROFILE },
  { path: "/admin/academic-periods", label: "Academic Periods", requiredFeature: FEATURE_KEYS.ACADEMIC_PERIODS },
  { path: "/admin/grades", label: "Grades & Classes", requiredFeature: FEATURE_KEYS.CLASSES },
  { path: "/admin/grades/[gradeId]", label: "Grade Detail", requiredFeature: FEATURE_KEYS.CLASSES },
  { path: "/admin/grades/[gradeId]/class-groups/[classGroupId]", label: "Class Group", requiredFeature: FEATURE_KEYS.CLASSES },

  // -------------------------------------------------------------------------
  // Students
  // -------------------------------------------------------------------------
  { path: "/admin/students", label: "Students", requiredFeature: FEATURE_KEYS.STUDENTS, readOnlyAllowed: true },
  { path: "/admin/students/[id]", label: "Student Detail", requiredFeature: FEATURE_KEYS.STUDENTS, readOnlyAllowed: true },
  { path: "/admin/students/new", label: "Enroll Student", requiredFeature: FEATURE_KEYS.STUDENTS },

  // -------------------------------------------------------------------------
  // Teachers & Staff
  // -------------------------------------------------------------------------
  { path: "/admin/teachers", label: "Teachers", requiredFeature: FEATURE_KEYS.TEACHERS, readOnlyAllowed: true },
  { path: "/admin/teachers/[id]", label: "Teacher Detail", requiredFeature: FEATURE_KEYS.TEACHERS, readOnlyAllowed: true },

  // -------------------------------------------------------------------------
  // Parents / Guardians
  // -------------------------------------------------------------------------
  { path: "/admin/parents", label: "Parents", requiredFeature: FEATURE_KEYS.PARENTS, readOnlyAllowed: true },
  { path: "/admin/parents/[id]", label: "Parent Detail", requiredFeature: FEATURE_KEYS.PARENTS, readOnlyAllowed: true },

  // -------------------------------------------------------------------------
  // Admissions
  // -------------------------------------------------------------------------
  { path: "/admin/admissions", label: "Admissions", requiredFeature: FEATURE_KEYS.ADMISSIONS, readOnlyAllowed: true },
  { path: "/admin/admissions/[cycleId]", label: "Admission Cycle", requiredFeature: FEATURE_KEYS.ADMISSIONS, readOnlyAllowed: true },
  { path: "/admin/admissions/new", label: "New Admission Cycle", requiredFeature: FEATURE_KEYS.ADMISSIONS },

  // -------------------------------------------------------------------------
  // Finance
  // -------------------------------------------------------------------------
  { path: "/admin/finance", label: "Finance", requiredFeature: FEATURE_KEYS.FINANCE_FEES, readOnlyAllowed: true },
  { path: "/admin/finance/fees", label: "Fee Setup", requiredFeature: FEATURE_KEYS.FINANCE_FEES, readOnlyAllowed: true },
  { path: "/admin/finance/invoices", label: "Invoices", requiredFeature: FEATURE_KEYS.FINANCE_INVOICES, readOnlyAllowed: true },
  { path: "/admin/finance/payments", label: "Payments", requiredFeature: FEATURE_KEYS.FINANCE_PAYMENTS, readOnlyAllowed: true },
  { path: "/admin/finance/reconciliation", label: "Reconciliation", requiredFeature: FEATURE_KEYS.FINANCE_RECONCILIATION, readOnlyAllowed: true },
  { path: "/admin/finance/reports", label: "Finance Reports", requiredFeature: FEATURE_KEYS.FINANCE_REPORTS, readOnlyAllowed: true },

  // -------------------------------------------------------------------------
  // Communications
  // -------------------------------------------------------------------------
  { path: "/admin/communications", label: "Communications", requiredFeature: FEATURE_KEYS.COMMUNICATION_NOTICES },
  { path: "/admin/communications/notices", label: "Notices", requiredFeature: FEATURE_KEYS.COMMUNICATION_NOTICES },
  { path: "/admin/communications/messages", label: "Messaging", requiredFeature: FEATURE_KEYS.COMMUNICATION_MESSAGING },

  // -------------------------------------------------------------------------
  // Academics
  // -------------------------------------------------------------------------
  { path: "/admin/academics", label: "Academics", requiredFeature: FEATURE_KEYS.ACADEMICS_SUBJECTS },
  { path: "/admin/academics/subjects", label: "Subjects", requiredFeature: FEATURE_KEYS.ACADEMICS_SUBJECTS },
  { path: "/admin/academics/curriculum", label: "Curriculum", requiredFeature: FEATURE_KEYS.ACADEMICS_CURRICULUM },
  { path: "/admin/academics/schemes", label: "Schemes of Learning", requiredFeature: FEATURE_KEYS.ACADEMICS_SCHEMES },
  { path: "/admin/academics/lesson-notes", label: "Lesson Notes", requiredFeature: FEATURE_KEYS.ACADEMICS_LESSON_NOTES },
  { path: "/admin/academics/lessons", label: "Lessons", requiredFeature: FEATURE_KEYS.ACADEMICS_LESSONS },
  { path: "/admin/academics/timetables", label: "Timetables", requiredFeature: FEATURE_KEYS.CLASSES },

  // -------------------------------------------------------------------------
  // Assessment
  // -------------------------------------------------------------------------
  { path: "/admin/assessments", label: "Assessments", requiredFeature: FEATURE_KEYS.ASSESSMENT_EXAMINATIONS },
  { path: "/admin/assessments/examinations", label: "Examinations", requiredFeature: FEATURE_KEYS.ASSESSMENT_EXAMINATIONS },
  { path: "/admin/assessments/question-bank", label: "Question Bank", requiredFeature: FEATURE_KEYS.ASSESSMENT_QUESTION_BANK },

  // -------------------------------------------------------------------------
  // Exam scheduling & invigilation (separate from question-bank examinations)
  // -------------------------------------------------------------------------
  { path: "/admin/exams/sessions", label: "Exam Sessions", requiredFeature: FEATURE_KEYS.ASSESSMENT_EXAMINATIONS, readOnlyAllowed: true },
  { path: "/admin/exams/sessions/[sessionId]/timetable", label: "Exam Timetable Builder", requiredFeature: FEATURE_KEYS.ASSESSMENT_EXAMINATIONS },
  { path: "/admin/exams/sessions/[sessionId]/conflicts", label: "Exam Conflict Review", requiredFeature: FEATURE_KEYS.ASSESSMENT_EXAMINATIONS },
  { path: "/admin/exams/analytics", label: "Exam Operations", requiredFeature: FEATURE_KEYS.ASSESSMENT_EXAMINATIONS, readOnlyAllowed: true },
  { path: "/admin/exams/venues", label: "Exam Venues", requiredFeature: FEATURE_KEYS.ASSESSMENT_EXAMINATIONS },

  // -------------------------------------------------------------------------
  // EduSentrix Learn
  // -------------------------------------------------------------------------
  { path: "/admin/learn", label: "EduSentrix Learn", requiredFeature: FEATURE_KEYS.LEARN_MANAGE },

  // -------------------------------------------------------------------------
  // Analytics
  // -------------------------------------------------------------------------
  { path: "/admin/analytics", label: "Analytics", requiredFeature: FEATURE_KEYS.ANALYTICS_BASIC, readOnlyAllowed: true },

  // -------------------------------------------------------------------------
  // Subscription / Billing (school admin read-only view)
  // -------------------------------------------------------------------------
  { path: "/admin/subscription", label: "Subscription", requiredFeature: null },

  // -------------------------------------------------------------------------
  // Invitations / Onboarding
  // -------------------------------------------------------------------------
  { path: "/admin/invitations", label: "Invitations", requiredFeature: FEATURE_KEYS.INVITATIONS },

  // -------------------------------------------------------------------------
  // Settings — always accessible
  // -------------------------------------------------------------------------
  { path: "/admin/settings", label: "Settings", requiredFeature: null },
];

// ---------------------------------------------------------------------------
// Teacher routes
// ---------------------------------------------------------------------------
export const TEACHER_ROUTE_REGISTRY: RouteRegistryEntry[] = [
  { path: "/teacher", label: "Dashboard", requiredFeature: null },
  { path: "/teacher/students", label: "My Students", requiredFeature: FEATURE_KEYS.STUDENTS, readOnlyAllowed: true },
  { path: "/teacher/grades", label: "My Classes", requiredFeature: FEATURE_KEYS.CLASSES },
  { path: "/teacher/lesson-notes", label: "Lesson Notes", requiredFeature: FEATURE_KEYS.ACADEMICS_LESSON_NOTES },
  { path: "/teacher/lesson-notes/new", label: "New Lesson Note", requiredFeature: FEATURE_KEYS.ACADEMICS_LESSON_NOTES },
  { path: "/teacher/schemes", label: "Schemes of Learning", requiredFeature: FEATURE_KEYS.ACADEMICS_SCHEMES },
  { path: "/teacher/examinations", label: "Examinations", requiredFeature: FEATURE_KEYS.ASSESSMENT_EXAMINATIONS },
  { path: "/teacher/exams", label: "My Exams", requiredFeature: FEATURE_KEYS.ASSESSMENT_EXAMINATIONS, readOnlyAllowed: true },
  { path: "/teacher/timetables", label: "Timetables", requiredFeature: FEATURE_KEYS.CLASSES },
  { path: "/teacher/communications", label: "Notices", requiredFeature: FEATURE_KEYS.COMMUNICATION_NOTICES },
  { path: "/teacher/learn", label: "EduSentrix Learn", requiredFeature: FEATURE_KEYS.LEARN_MANAGE },
];

// ---------------------------------------------------------------------------
// Parent routes
// ---------------------------------------------------------------------------
export const PARENT_ROUTE_REGISTRY: RouteRegistryEntry[] = [
  { path: "/parent", label: "Dashboard", requiredFeature: null },
  { path: "/parent/students", label: "My Children", requiredFeature: FEATURE_KEYS.STUDENTS, readOnlyAllowed: true },
  { path: "/parent/payments", label: "Payments", requiredFeature: FEATURE_KEYS.FINANCE_PARENT_PAYMENTS },
  { path: "/parent/notices", label: "Notices", requiredFeature: FEATURE_KEYS.COMMUNICATION_NOTICES },
  { path: "/parent/exams", label: "Upcoming Exams", requiredFeature: FEATURE_KEYS.ASSESSMENT_EXAMINATIONS, readOnlyAllowed: true },
  { path: "/parent/learn", label: "EduSentrix Learn", requiredFeature: FEATURE_KEYS.LEARN_STUDENT_ACCESS },
];

// ---------------------------------------------------------------------------
// Lookup helper
// ---------------------------------------------------------------------------

export function getRouteEntry(
  path: string,
  registry: RouteRegistryEntry[] = SCHOOL_ADMIN_ROUTE_REGISTRY
): RouteRegistryEntry | null {
  // Exact match first
  const exact = registry.find((r) => r.path === path);
  if (exact) return exact;

  // Segment match (replace dynamic [param] with actual path segments)
  for (const entry of registry) {
    const pattern = entry.path
      .replace(/\[[^\]]+\]/g, "[^/]+")
      .replace(/\//g, "\\/");
    if (new RegExp(`^${pattern}$`).test(path)) {
      return entry;
    }
  }

  return null;
}
