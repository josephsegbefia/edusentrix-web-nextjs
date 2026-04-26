// src/lib/admissions/submission.ts
// Server-side validation that a public submission satisfies the active form
// schema (visibility, required fields, basic typing). Returns a normalized
// payload split into the structured `applicant` / `guardian` / `additional`
// shape the model expects.

import type {
  AdmissionFormField,
  AdmissionFormSchema,
  AdmissionSystemFieldKey,
} from "./types";

export type RawAnswer = string | number | boolean | string[] | null | undefined;

export type SubmissionInput = {
  /** Map of field id → applicant-provided answer. */
  answers: Record<string, RawAnswer>;
  /** Optional documents already uploaded; keyed by requirement id. */
  documents?: Array<{
    requirementId: string;
    label?: string;
    fileUrl: string;
    fileName?: string;
    sizeBytes?: number;
    mimeType?: string;
  }>;
};

export type NormalizedSubmission = {
  applicant: {
    firstName: string;
    lastName: string;
    sex?: "male" | "female" | null;
    dateOfBirth?: Date | null;
    intendedGradeId?: string | null;
    photoUrl?: string | null;
    address?: string | null;
  };
  guardian: {
    firstName: string;
    lastName: string;
    relationship?: string | null;
    email: string;
    phone?: string | null;
    address?: string | null;
    occupation?: string | null;
  };
  additional: Record<string, unknown>;
  consentGiven: boolean;
};

export type ValidationError = {
  fieldId: string;
  message: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9 ()-]{6,20}$/;

function trimToString(value: RawAnswer): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return String(value).trim();
}

function isEmpty(value: RawAnswer): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "boolean") return value === false;
  return false;
}

function flattenFields(schema: AdmissionFormSchema): AdmissionFormField[] {
  const result: AdmissionFormField[] = [];
  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (field.visible === false) continue;
      result.push(field);
    }
  }
  return result;
}

/**
 * Validate the raw submission payload against the form schema. Returns a list
 * of validation errors (empty array means it passed) and a normalized shape
 * ready to be persisted on AdmissionApplication.
 */
export function validateAndNormalizeSubmission(
  schema: AdmissionFormSchema,
  input: SubmissionInput
): { ok: false; errors: ValidationError[] } | { ok: true; data: NormalizedSubmission } {
  const fields = flattenFields(schema);
  const errors: ValidationError[] = [];
  const additional: Record<string, unknown> = {};
  const systemValues: Partial<Record<AdmissionSystemFieldKey, RawAnswer>> = {};

  for (const field of fields) {
    const raw = input.answers?.[field.id];
    const empty = isEmpty(raw);

    if (field.required && empty) {
      errors.push({
        fieldId: field.id,
        message: `${field.label} is required`,
      });
      continue;
    }

    if (empty) continue;

    switch (field.type) {
      case "email": {
        const value = trimToString(raw).toLowerCase();
        if (!EMAIL_REGEX.test(value)) {
          errors.push({ fieldId: field.id, message: `${field.label} must be a valid email` });
          continue;
        }
        if (field.systemFieldKey) systemValues[field.systemFieldKey] = value;
        else additional[field.id] = value;
        break;
      }
      case "phone": {
        const value = trimToString(raw);
        if (!PHONE_REGEX.test(value)) {
          errors.push({ fieldId: field.id, message: `${field.label} must be a valid phone number` });
          continue;
        }
        if (field.systemFieldKey) systemValues[field.systemFieldKey] = value;
        else additional[field.id] = value;
        break;
      }
      case "date": {
        const value = trimToString(raw);
        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) {
          errors.push({ fieldId: field.id, message: `${field.label} must be a valid date` });
          continue;
        }
        if (field.systemFieldKey) systemValues[field.systemFieldKey] = value;
        else additional[field.id] = value;
        break;
      }
      case "boolean": {
        const value = raw === true || raw === "true" || raw === "on";
        if (field.required && !value) {
          errors.push({ fieldId: field.id, message: `${field.label} is required` });
          continue;
        }
        if (field.systemFieldKey) systemValues[field.systemFieldKey] = value;
        else additional[field.id] = value;
        break;
      }
      case "single_select": {
        const value = trimToString(raw);
        const allowed = new Set((field.options ?? []).map((opt) => opt.value));
        if (allowed.size > 0 && !allowed.has(value)) {
          errors.push({ fieldId: field.id, message: `${field.label} has an unsupported value` });
          continue;
        }
        if (field.systemFieldKey) systemValues[field.systemFieldKey] = value;
        else additional[field.id] = value;
        break;
      }
      case "multi_select": {
        const arr = Array.isArray(raw)
          ? raw.map((v) => trimToString(v as RawAnswer)).filter(Boolean)
          : trimToString(raw)
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean);
        const allowed = new Set((field.options ?? []).map((opt) => opt.value));
        if (allowed.size > 0 && arr.some((v) => !allowed.has(v))) {
          errors.push({ fieldId: field.id, message: `${field.label} has an unsupported selection` });
          continue;
        }
        if (field.systemFieldKey) systemValues[field.systemFieldKey] = arr;
        else additional[field.id] = arr;
        break;
      }
      case "number": {
        const num = Number(raw);
        if (!Number.isFinite(num)) {
          errors.push({ fieldId: field.id, message: `${field.label} must be a number` });
          continue;
        }
        if (
          typeof field.validators?.min === "number" &&
          num < field.validators.min
        ) {
          errors.push({
            fieldId: field.id,
            message: `${field.label} must be at least ${field.validators.min}`,
          });
          continue;
        }
        if (
          typeof field.validators?.max === "number" &&
          num > field.validators.max
        ) {
          errors.push({
            fieldId: field.id,
            message: `${field.label} must be at most ${field.validators.max}`,
          });
          continue;
        }
        if (field.systemFieldKey) systemValues[field.systemFieldKey] = num;
        else additional[field.id] = num;
        break;
      }
      case "grade_picker": {
        const value = trimToString(raw);
        if (!/^[a-f\d]{24}$/i.test(value)) {
          errors.push({ fieldId: field.id, message: `Pick a valid grade` });
          continue;
        }
        if (field.systemFieldKey) systemValues[field.systemFieldKey] = value;
        else additional[field.id] = value;
        break;
      }
      case "file_upload": {
        const value = trimToString(raw);
        if (field.systemFieldKey) systemValues[field.systemFieldKey] = value;
        else additional[field.id] = value;
        break;
      }
      case "short_text":
      case "long_text":
      case "address":
      case "country":
      default: {
        const value = trimToString(raw);
        if (
          typeof field.validators?.min === "number" &&
          value.length < field.validators.min
        ) {
          errors.push({
            fieldId: field.id,
            message: `${field.label} must be at least ${field.validators.min} characters`,
          });
          continue;
        }
        if (
          typeof field.validators?.max === "number" &&
          value.length > field.validators.max
        ) {
          errors.push({
            fieldId: field.id,
            message: `${field.label} must be at most ${field.validators.max} characters`,
          });
          continue;
        }
        if (field.systemFieldKey) systemValues[field.systemFieldKey] = value;
        else additional[field.id] = value;
        break;
      }
    }
  }

  // Required documents
  const providedDocs = new Set(
    (input.documents ?? []).map((doc) => doc.requirementId)
  );
  for (const requirement of schema.documentRequirements) {
    if (requirement.required && !providedDocs.has(requirement.id)) {
      errors.push({
        fieldId: requirement.id,
        message: `Upload required: ${requirement.label}`,
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const get = <T>(key: AdmissionSystemFieldKey): T | undefined =>
    systemValues[key] as T | undefined;

  const dobRaw = get<string>("applicant.dateOfBirth");
  const dob = dobRaw ? new Date(dobRaw) : null;
  const sexRaw = get<string>("applicant.sex");

  const data: NormalizedSubmission = {
    applicant: {
      firstName: String(get<string>("applicant.firstName") ?? ""),
      lastName: String(get<string>("applicant.lastName") ?? ""),
      sex:
        sexRaw === "male" || sexRaw === "female" ? (sexRaw as "male" | "female") : null,
      dateOfBirth: dob && !Number.isNaN(dob.getTime()) ? dob : null,
      intendedGradeId: get<string>("applicant.intendedGradeId") ?? null,
      photoUrl: get<string>("applicant.photoUrl") ?? null,
      address: get<string>("applicant.address") ?? null,
    },
    guardian: {
      firstName: String(get<string>("guardian.firstName") ?? ""),
      lastName: String(get<string>("guardian.lastName") ?? ""),
      relationship: get<string>("guardian.relationship") ?? null,
      email: String(get<string>("guardian.email") ?? "").toLowerCase(),
      phone: get<string>("guardian.phone") ?? null,
      address: get<string>("guardian.address") ?? null,
      occupation: get<string>("guardian.occupation") ?? null,
    },
    additional,
    consentGiven: Boolean(get<boolean>("consent.dataProcessing")),
  };

  return { ok: true, data };
}
