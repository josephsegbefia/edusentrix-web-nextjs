// src/lib/admissions/public-shape.ts
// DTOs returned by /api/public/admissions/* endpoints. We strip everything
// that should not be exposed to anonymous applicants (analytics, internal
// notes, decision detail, etc.) and only ship what the form renderer needs.

import type {
  AdmissionDocumentRequirement,
  AdmissionFormSection,
} from "./types";

export type PublicCycleDTO = {
  schoolId: string;
  schoolName: string;
  schoolLogoUrl: string | null;
  cycleId: string;
  name: string;
  slug: string;
  status: "published" | "paused" | "closed";
  acceptsApplicationsFrom: string;
  acceptsApplicationsUntil: string | null;
  decisionDueBy: string | null;
  branding: {
    accentColor: string | null;
    welcomeMessage: string | null;
    heroImageUrl: string | null;
  };
  acceptingApplications: boolean;
  closedReason: string | null;
  /** Public application fee summary (only present when fee.enabled). */
  applicationFee: {
    amountMinor: number;
    currency: string;
    mode: "manual_record" | "online_paystack";
    instructions: string | null;
  } | null;
};

export type PublicGradeDTO = {
  id: string;
  name: string;
};

export type PublicFormDTO = {
  formId: string;
  version: number;
  sections: AdmissionFormSection[];
  documentRequirements: AdmissionDocumentRequirement[];
  consentText: string;
  localeDefault: string;
  /** Grades the cycle accepts. Empty array means all active grades. */
  intakeGrades: PublicGradeDTO[];
};

export type PublicApplicationDTO = {
  applicationId: string;
  referenceCode: string;
  trackerUrl: string;
  status:
    | "submitted"
    | "under_review"
    | "interview_scheduled"
    | "accepted"
    | "rejected"
    | "waitlisted"
    | "withdrawn"
    | "expired";
  submittedAt: string | null;
  applicant: {
    firstName: string;
    lastName: string;
    intendedGradeName: string | null;
  };
  cycle: {
    name: string;
    schoolName: string;
  };
  /** Documents requirements still missing (id + label). */
  missingDocuments: Array<{ id: string; label: string }>;
  /** Application fee summary surfaced to the applicant. */
  fee: {
    status: "not_required" | "pending" | "paid" | "waived";
    amountMinor: number | null;
    currency: string | null;
    mode: "manual_record" | "online_paystack" | null;
    instructions: string | null;
    paidAt: string | null;
  };
  /** When the school schedules an interview / assessment (ISO). */
  interviewAt: string | null;
  /** Optional end time for the same slot (ISO). */
  interviewEndsAt?: string | null;
};
