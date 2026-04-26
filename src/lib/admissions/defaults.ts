// src/lib/admissions/defaults.ts
// Default form schema seeded for every new AdmissionCycle.
// Platform-required fields are marked with `isPlatformRequired: true` so the
// form builder UI prevents removal/hiding.

import type {
  AdmissionDocumentRequirement,
  AdmissionFormField,
  AdmissionFormSchema,
  AdmissionFormSection,
} from "./types";

/**
 * Stable ids so a re-seed (or "Reset to defaults") preserves answers
 * already gathered for the same field.
 */
const ID = {
  // sections
  sectionApplicant: "sec_applicant",
  sectionGuardian: "sec_guardian",
  sectionAcademic: "sec_academic",
  sectionDocuments: "sec_documents",
  sectionAdditional: "sec_additional",

  // applicant fields
  applicantFirstName: "fld_applicant_firstname",
  applicantLastName: "fld_applicant_lastname",
  applicantSex: "fld_applicant_sex",
  applicantDob: "fld_applicant_dob",
  applicantPhoto: "fld_applicant_photo",
  applicantAddress: "fld_applicant_address",
  applicantPriorSchool: "fld_applicant_prior_school",
  applicantLanguages: "fld_applicant_languages",
  applicantReligion: "fld_applicant_religion",
  applicantSpecialNeeds: "fld_applicant_special_needs",

  // guardian fields
  guardianFirstName: "fld_guardian_firstname",
  guardianLastName: "fld_guardian_lastname",
  guardianRelationship: "fld_guardian_relationship",
  guardianEmail: "fld_guardian_email",
  guardianPhone: "fld_guardian_phone",
  guardianAddress: "fld_guardian_address",
  guardianOccupation: "fld_guardian_occupation",

  // academic
  intendedGrade: "fld_intended_grade",

  // consent
  consentDataProcessing: "fld_consent_data_processing",

  // documents
  docBirthCertificate: "doc_birth_certificate",
  docPriorReport: "doc_prior_report",
  docPassportPhoto: "doc_passport_photo",
} as const;

const RELATIONSHIP_OPTIONS = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "guardian", label: "Guardian" },
  { value: "grandparent", label: "Grandparent" },
  { value: "sibling", label: "Sibling" },
  { value: "other", label: "Other" },
];

const SEX_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const applicantFields: AdmissionFormField[] = [
  {
    id: ID.applicantFirstName,
    label: "First name",
    type: "short_text",
    required: true,
    visible: true,
    order: 0,
    systemFieldKey: "applicant.firstName",
    isPlatformRequired: true,
  },
  {
    id: ID.applicantLastName,
    label: "Last name",
    type: "short_text",
    required: true,
    visible: true,
    order: 1,
    systemFieldKey: "applicant.lastName",
    isPlatformRequired: true,
  },
  {
    id: ID.applicantDob,
    label: "Date of birth",
    type: "date",
    required: true,
    visible: true,
    order: 2,
    systemFieldKey: "applicant.dateOfBirth",
    isPlatformRequired: true,
  },
  {
    id: ID.applicantSex,
    label: "Sex",
    type: "single_select",
    required: true,
    visible: true,
    order: 3,
    options: SEX_OPTIONS,
    systemFieldKey: "applicant.sex",
    isPlatformRequired: true,
  },
  {
    id: ID.applicantPhoto,
    label: "Recent photograph",
    helpText: "A clear passport-style photo. JPG or PNG.",
    type: "file_upload",
    required: false,
    visible: true,
    order: 4,
    systemFieldKey: "applicant.photoUrl",
    validators: { maxFiles: 1, mimeTypes: ["image/jpeg", "image/png"] },
  },
  {
    id: ID.applicantAddress,
    label: "Home address",
    type: "address",
    required: false,
    visible: true,
    order: 5,
    systemFieldKey: "applicant.address",
  },
  {
    id: ID.applicantPriorSchool,
    label: "Previous school (if any)",
    type: "short_text",
    required: false,
    visible: true,
    order: 6,
    systemFieldKey: "applicant.priorSchool",
  },
  {
    id: ID.applicantLanguages,
    label: "Languages spoken at home",
    type: "short_text",
    required: false,
    visible: true,
    order: 7,
    systemFieldKey: "applicant.languages",
  },
  {
    id: ID.applicantReligion,
    label: "Religion",
    type: "short_text",
    required: false,
    visible: false,
    order: 8,
    systemFieldKey: "applicant.religion",
  },
  {
    id: ID.applicantSpecialNeeds,
    label: "Special needs or accommodations",
    type: "long_text",
    required: false,
    visible: true,
    order: 9,
    systemFieldKey: "applicant.specialNeeds",
  },
];

const academicFields: AdmissionFormField[] = [
  {
    id: ID.intendedGrade,
    label: "Grade applying for",
    helpText: "Choose the grade you are applying to join.",
    type: "grade_picker",
    required: true,
    visible: true,
    order: 0,
    systemFieldKey: "applicant.intendedGradeId",
    isPlatformRequired: true,
  },
];

const guardianFields: AdmissionFormField[] = [
  {
    id: ID.guardianFirstName,
    label: "First name",
    type: "short_text",
    required: true,
    visible: true,
    order: 0,
    systemFieldKey: "guardian.firstName",
    isPlatformRequired: true,
  },
  {
    id: ID.guardianLastName,
    label: "Last name",
    type: "short_text",
    required: true,
    visible: true,
    order: 1,
    systemFieldKey: "guardian.lastName",
    isPlatformRequired: true,
  },
  {
    id: ID.guardianRelationship,
    label: "Relationship to applicant",
    type: "single_select",
    required: true,
    visible: true,
    order: 2,
    options: RELATIONSHIP_OPTIONS,
    systemFieldKey: "guardian.relationship",
    isPlatformRequired: true,
  },
  {
    id: ID.guardianEmail,
    label: "Email",
    type: "email",
    required: true,
    visible: true,
    order: 3,
    systemFieldKey: "guardian.email",
    isPlatformRequired: true,
  },
  {
    id: ID.guardianPhone,
    label: "Phone",
    type: "phone",
    required: true,
    visible: true,
    order: 4,
    systemFieldKey: "guardian.phone",
    isPlatformRequired: true,
  },
  {
    id: ID.guardianAddress,
    label: "Postal address",
    type: "address",
    required: false,
    visible: true,
    order: 5,
    systemFieldKey: "guardian.address",
  },
  {
    id: ID.guardianOccupation,
    label: "Occupation",
    type: "short_text",
    required: false,
    visible: true,
    order: 6,
    systemFieldKey: "guardian.occupation",
  },
];

const consentFields: AdmissionFormField[] = [
  {
    id: ID.consentDataProcessing,
    label: "I consent to the school processing this application's information.",
    type: "boolean",
    required: true,
    visible: true,
    order: 0,
    systemFieldKey: "consent.dataProcessing",
    isPlatformRequired: true,
  },
];

const defaultSections: AdmissionFormSection[] = [
  {
    id: ID.sectionApplicant,
    title: "About the applicant",
    description: "Tell us about the student.",
    fields: applicantFields,
    systemKey: "applicant",
    order: 0,
  },
  {
    id: ID.sectionAcademic,
    title: "Academic information",
    description: "Which grade are you applying for?",
    fields: academicFields,
    systemKey: "academic",
    order: 1,
  },
  {
    id: ID.sectionGuardian,
    title: "Parent or guardian",
    description: "We will use these details to contact you about the application.",
    fields: guardianFields,
    systemKey: "guardian",
    order: 2,
  },
  {
    id: ID.sectionAdditional,
    title: "Consent",
    description: "Please confirm you understand how your information will be used.",
    fields: consentFields,
    systemKey: "additional",
    order: 3,
  },
];

const defaultDocumentRequirements: AdmissionDocumentRequirement[] = [
  {
    id: ID.docBirthCertificate,
    label: "Birth certificate",
    helpText: "PDF or image scan of the applicant's birth certificate.",
    required: true,
    mimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    maxSizeMb: 5,
  },
  {
    id: ID.docPriorReport,
    label: "Most recent school report",
    helpText: "Required only if the applicant has previously attended school.",
    required: false,
    mimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    maxSizeMb: 8,
  },
  {
    id: ID.docPassportPhoto,
    label: "Passport-sized photograph",
    required: false,
    mimeTypes: ["image/jpeg", "image/png"],
    maxSizeMb: 3,
  },
];

const DEFAULT_CONSENT_TEXT =
  "By submitting this application I confirm the information provided is accurate to the best of my knowledge, and I consent to the school processing it for the purposes of admissions.";

export function buildDefaultAdmissionFormSchema(): AdmissionFormSchema {
  return {
    sections: structuredClone(defaultSections),
    documentRequirements: structuredClone(defaultDocumentRequirements),
    consentText: DEFAULT_CONSENT_TEXT,
    localeDefault: "en",
  };
}

const DEFAULT_ACCEPTANCE_SUBJECT = "{{schoolName}} — Admission decision";

const DEFAULT_ACCEPTANCE_BODY = `<p>Dear {{guardianFirstName}},</p>
<p>We are pleased to offer <strong>{{applicantFirstName}} {{applicantLastName}}</strong> a place in <strong>{{targetGradeName}}</strong> at <strong>{{schoolName}}</strong>.</p>
<p>Next steps will be sent in a follow-up message. If you have any questions, simply reply to this email and a member of our admissions team will assist you.</p>
<p>Warm regards,<br/>{{schoolName}} admissions team</p>`;

const DEFAULT_REJECTION_SUBJECT = "{{schoolName}} — Application update";

const DEFAULT_REJECTION_BODY = `<p>Dear {{guardianFirstName}},</p>
<p>Thank you for your interest in <strong>{{schoolName}}</strong>. After careful consideration, we are unable to offer <strong>{{applicantFirstName}}</strong> a place at this time.</p>
<p>We wish your family the very best and encourage you to apply again in the future.</p>
<p>Sincerely,<br/>{{schoolName}} admissions team</p>`;

export const DEFAULT_ACCEPTANCE_TEMPLATE = {
  subject: DEFAULT_ACCEPTANCE_SUBJECT,
  htmlBody: DEFAULT_ACCEPTANCE_BODY,
};

export const DEFAULT_REJECTION_TEMPLATE = {
  subject: DEFAULT_REJECTION_SUBJECT,
  htmlBody: DEFAULT_REJECTION_BODY,
};
