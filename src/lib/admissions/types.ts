// src/lib/admissions/types.ts
// Shared type definitions for the Admissions feature.
// See docs/ADMISSIONS_DEVELOPMENT_SPEC.md §3.

export type AdmissionFormFieldType =
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "number"
  | "single_select"
  | "multi_select"
  | "boolean"
  | "date"
  | "address"
  | "country"
  | "file_upload"
  | "grade_picker";

export type AdmissionSystemFieldKey =
  | "applicant.firstName"
  | "applicant.lastName"
  | "applicant.dateOfBirth"
  | "applicant.sex"
  | "applicant.intendedGradeId"
  | "applicant.photoUrl"
  | "applicant.address"
  | "applicant.priorSchool"
  | "applicant.languages"
  | "applicant.religion"
  | "applicant.specialNeeds"
  | "guardian.firstName"
  | "guardian.lastName"
  | "guardian.relationship"
  | "guardian.email"
  | "guardian.phone"
  | "guardian.address"
  | "guardian.occupation"
  | "consent.dataProcessing";

export type AdmissionFormSectionKey =
  | "applicant"
  | "guardian"
  | "academic"
  | "documents"
  | "additional";

export type AdmissionFormFieldOption = {
  value: string;
  label: string;
};

export type AdmissionFormFieldValidators = {
  min?: number;
  max?: number;
  pattern?: string;
  maxFiles?: number;
  mimeTypes?: string[];
};

export type AdmissionFormField = {
  id: string;
  label: string;
  helpText?: string;
  type: AdmissionFormFieldType;
  required: boolean;
  options?: AdmissionFormFieldOption[];
  validators?: AdmissionFormFieldValidators;
  systemFieldKey?: AdmissionSystemFieldKey;
  /** Locked fields cannot be removed or hidden by school admins. */
  isPlatformRequired?: boolean;
  visible: boolean;
  order: number;
};

export type AdmissionFormSection = {
  id: string;
  title: string;
  description?: string;
  fields: AdmissionFormField[];
  systemKey?: AdmissionFormSectionKey;
  order: number;
};

export type AdmissionDocumentRequirement = {
  id: string;
  label: string;
  helpText?: string;
  required: boolean;
  mimeTypes?: string[];
  maxSizeMb?: number;
  isPlatformRequired?: boolean;
};

export type AdmissionFormSchema = {
  sections: AdmissionFormSection[];
  documentRequirements: AdmissionDocumentRequirement[];
  consentText: string;
  localeDefault: string;
};

export type AdmissionCycleStatus =
  | "draft"
  | "published"
  | "paused"
  | "closed"
  | "archived";

export type AdmissionApplicationStatus =
  | "submitted"
  | "under_review"
  | "interview_scheduled"
  | "accepted"
  | "rejected"
  | "waitlisted"
  | "withdrawn"
  | "expired";

export type AdmissionChannel =
  | "public_link"
  | "embed"
  | "qr"
  | "direct_invite"
  | "whatsapp"
  | "internal";

export type AdmissionFeeStatus =
  | "not_required"
  | "pending"
  | "paid"
  | "waived";

/**
 * The platform-required field keys that cannot be removed or hidden.
 * Mirrors §3.3 of the spec.
 */
export const PLATFORM_REQUIRED_FIELD_KEYS: readonly AdmissionSystemFieldKey[] = [
  "applicant.firstName",
  "applicant.lastName",
  "applicant.dateOfBirth",
  "applicant.sex",
  "applicant.intendedGradeId",
  "guardian.firstName",
  "guardian.lastName",
  "guardian.relationship",
  "guardian.email",
  "guardian.phone",
  "consent.dataProcessing",
] as const;

export function isPlatformRequiredFieldKey(
  key: string | undefined | null
): key is AdmissionSystemFieldKey {
  return Boolean(
    key && (PLATFORM_REQUIRED_FIELD_KEYS as readonly string[]).includes(key)
  );
}
