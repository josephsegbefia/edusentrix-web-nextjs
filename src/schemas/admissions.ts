// src/schemas/admissions.ts
// Zod validation for the Admissions feature.
// See docs/ADMISSIONS_DEVELOPMENT_SPEC.md.

import { z } from "zod";

const objectIdString = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid id");

const slugRegex = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

export const CycleApplicationFeeSchema = z.object({
  enabled: z.boolean(),
  amountMinor: z.number().int().min(0).default(0),
  currency: z.string().length(3).default("GHS"),
  mode: z.enum(["manual_record", "online_paystack"]).default("manual_record"),
  instructions: z.string().max(500).optional(),
});

export const CycleEmailTemplateSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  htmlBody: z.string().min(1),
  replyToAlias: z.string().nullish(),
});

export const CycleBrandingSchema = z.object({
  heroImageUrl: z.string().url().nullish(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/i, "Use a hex like #112233")
    .nullish(),
  welcomeMessage: z.string().max(500).nullish(),
});

export const CreateAdmissionCycleSchema = z.object({
  name: z.string().trim().min(1, "Cycle name is required").max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(slugRegex, "Use 1–48 lowercase letters, numbers, or dashes")
    .max(48),
  intakeGradeIds: z.array(objectIdString).default([]),
  targetAcademicPeriodId: objectIdString.nullish(),
  acceptsApplicationsFrom: z.coerce.date(),
  acceptsApplicationsUntil: z.coerce.date().nullish(),
  decisionDueBy: z.coerce.date().nullish(),
  capacityByGradeId: z.record(z.string(), z.number().int().min(0)).optional(),
  waitlistEnabled: z.boolean().default(true),
  applicationFee: CycleApplicationFeeSchema.nullish(),
  branding: CycleBrandingSchema.optional(),
  /** Optional preset that seeds the form schema and a few defaults. */
  templateId: z
    .enum(["blank", "standard_primary", "standard_jhs", "standard_shs"])
    .optional(),
});

export const UpdateAdmissionCycleSchema = CreateAdmissionCycleSchema.partial().extend({
  acceptanceTemplate: CycleEmailTemplateSchema.optional(),
  rejectionTemplate: CycleEmailTemplateSchema.optional(),
});

const FieldOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

const FieldValidatorsSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  pattern: z.string().optional(),
  maxFiles: z.number().int().min(1).optional(),
  mimeTypes: z.array(z.string()).optional(),
});

const FieldTypeEnum = z.enum([
  "short_text",
  "long_text",
  "email",
  "phone",
  "number",
  "single_select",
  "multi_select",
  "boolean",
  "date",
  "address",
  "country",
  "file_upload",
  "grade_picker",
]);

const SystemFieldKeyEnum = z.enum([
  "applicant.firstName",
  "applicant.lastName",
  "applicant.dateOfBirth",
  "applicant.sex",
  "applicant.intendedGradeId",
  "applicant.photoUrl",
  "applicant.address",
  "applicant.priorSchool",
  "applicant.languages",
  "applicant.religion",
  "applicant.specialNeeds",
  "guardian.firstName",
  "guardian.lastName",
  "guardian.relationship",
  "guardian.email",
  "guardian.phone",
  "guardian.address",
  "guardian.occupation",
  "consent.dataProcessing",
]);

const SectionKeyEnum = z.enum([
  "applicant",
  "guardian",
  "academic",
  "documents",
  "additional",
]);

const FormFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1).max(200),
  helpText: z.string().max(500).optional(),
  type: FieldTypeEnum,
  required: z.boolean().default(false),
  options: z.array(FieldOptionSchema).optional(),
  validators: FieldValidatorsSchema.optional(),
  systemFieldKey: SystemFieldKeyEnum.optional(),
  isPlatformRequired: z.boolean().optional().default(false),
  visible: z.boolean().default(true),
  order: z.number().int().min(0).default(0),
});

const FormSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional(),
  fields: z.array(FormFieldSchema).default([]),
  systemKey: SectionKeyEnum.optional(),
  order: z.number().int().min(0).default(0),
});

const DocumentRequirementSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1).max(120),
  helpText: z.string().max(500).optional(),
  required: z.boolean().default(false),
  mimeTypes: z.array(z.string()).optional(),
  maxSizeMb: z.number().min(1).max(50).optional(),
  isPlatformRequired: z.boolean().optional().default(false),
});

export const UpdateAdmissionFormSchema = z.object({
  sections: z.array(FormSectionSchema).min(1),
  documentRequirements: z.array(DocumentRequirementSchema).default([]),
  consentText: z.string().trim().min(1),
  localeDefault: z.string().min(2).max(10).default("en"),
});

export const AssignAdmissionsDelegateSchema = z.object({
  teacherId: objectIdString,
});

export type CreateAdmissionCycleInput = z.infer<
  typeof CreateAdmissionCycleSchema
>;
export type UpdateAdmissionCycleInput = z.infer<
  typeof UpdateAdmissionCycleSchema
>;
export type UpdateAdmissionFormInput = z.infer<typeof UpdateAdmissionFormSchema>;
export type AssignAdmissionsDelegateInput = z.infer<
  typeof AssignAdmissionsDelegateSchema
>;
