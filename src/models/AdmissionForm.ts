// src/models/AdmissionForm.ts
// Mongoose model for the form schema attached to an AdmissionCycle.
// See docs/ADMISSIONS_DEVELOPMENT_SPEC.md §3.2.

import { Schema, model, models, Types, type Model } from "mongoose";
import type {
  AdmissionDocumentRequirement,
  AdmissionFormFieldOption,
  AdmissionFormFieldType,
  AdmissionFormFieldValidators,
  AdmissionFormSection,
  AdmissionFormSectionKey,
  AdmissionSystemFieldKey,
} from "@/lib/admissions/types";

export interface IAdmissionForm {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  cycleId: Types.ObjectId;
  version: number;
  sections: AdmissionFormSection[];
  documentRequirements: AdmissionDocumentRequirement[];
  consentText: string;
  localeDefault: string;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const fieldOptionSchema = new Schema<AdmissionFormFieldOption>(
  {
    value: { type: String, required: true },
    label: { type: String, required: true },
  },
  { _id: false }
);

const fieldValidatorsSchema = new Schema<AdmissionFormFieldValidators>(
  {
    min: { type: Number, default: undefined },
    max: { type: Number, default: undefined },
    pattern: { type: String, default: undefined },
    maxFiles: { type: Number, default: undefined },
    mimeTypes: { type: [String], default: undefined },
  },
  { _id: false }
);

const FIELD_TYPES: AdmissionFormFieldType[] = [
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
];

const SYSTEM_FIELD_KEYS: AdmissionSystemFieldKey[] = [
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
];

const SECTION_KEYS: AdmissionFormSectionKey[] = [
  "applicant",
  "guardian",
  "academic",
  "documents",
  "additional",
];

const fieldSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    helpText: { type: String, default: undefined },
    type: { type: String, enum: FIELD_TYPES, required: true },
    required: { type: Boolean, default: false },
    options: { type: [fieldOptionSchema], default: undefined },
    validators: { type: fieldValidatorsSchema, default: undefined },
    systemFieldKey: { type: String, enum: SYSTEM_FIELD_KEYS, default: undefined },
    isPlatformRequired: { type: Boolean, default: false },
    visible: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const sectionSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: undefined },
    fields: { type: [fieldSchema], default: [] },
    systemKey: { type: String, enum: SECTION_KEYS, default: undefined },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const documentRequirementSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    helpText: { type: String, default: undefined },
    required: { type: Boolean, default: false },
    mimeTypes: { type: [String], default: undefined },
    maxSizeMb: { type: Number, default: undefined },
    isPlatformRequired: { type: Boolean, default: false },
  },
  { _id: false }
);

const admissionFormSchema = new Schema<IAdmissionForm>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    cycleId: {
      type: Schema.Types.ObjectId,
      ref: "AdmissionCycle",
      required: true,
      index: true,
    },
    version: { type: Number, required: true, default: 1 },
    sections: { type: [sectionSchema], default: [] },
    documentRequirements: { type: [documentRequirementSchema], default: [] },
    consentText: { type: String, required: true },
    localeDefault: { type: String, default: "en" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

admissionFormSchema.index(
  { schoolId: 1, cycleId: 1, version: -1 },
  { unique: true }
);

export const AdmissionForm: Model<IAdmissionForm> =
  (models.AdmissionForm as Model<IAdmissionForm>) ||
  model<IAdmissionForm>("AdmissionForm", admissionFormSchema);
