// src/lib/admissions/service.ts
// Service helpers for the Admissions feature: serialization and the
// form-schema validation that protects platform-required fields.
//
// See docs/ADMISSIONS_DEVELOPMENT_SPEC.md.

import type { Types } from "mongoose";
import type { IAdmissionCycle } from "@/models/AdmissionCycle";
import type { IAdmissionForm } from "@/models/AdmissionForm";
import type {
  AdmissionFormSchema,
  AdmissionSystemFieldKey,
} from "./types";
import { PLATFORM_REQUIRED_FIELD_KEYS } from "./types";
import { buildDefaultAdmissionFormSchema } from "./defaults";

export type AdmissionCycleDTO = {
  id: string;
  schoolId: string;
  name: string;
  slug: string;
  intakeGradeIds: string[];
  targetAcademicPeriodId: string | null;
  acceptsApplicationsFrom: string;
  acceptsApplicationsUntil: string | null;
  decisionDueBy: string | null;
  status: IAdmissionCycle["status"];
  formId: string | null;
  capacityByGradeId: Record<string, number>;
  waitlistEnabled: boolean;
  applicationFee: IAdmissionCycle["applicationFee"];
  acceptanceTemplate: IAdmissionCycle["acceptanceTemplate"];
  rejectionTemplate: IAdmissionCycle["rejectionTemplate"];
  branding: IAdmissionCycle["branding"];
  delegate: {
    userId: string;
    teacherId: string | null;
    assignedAt: string;
    assignedBy: string;
  } | null;
  analytics: IAdmissionCycle["analytics"];
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function objectIdToString(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value && typeof (value as Types.ObjectId).toString === "function") {
    return String(value);
  }
  return "";
}

function dateToIso(value: unknown): string | null {
  if (!value) return null;
  try {
    return new Date(value as string | Date).toISOString();
  } catch {
    return null;
  }
}

function capacityMapToObject(
  value: unknown
): Record<string, number> {
  if (!value) return {};
  if (value instanceof Map) {
    const out: Record<string, number> = {};
    for (const [key, v] of value as Map<string, number>) {
      out[String(key)] = Number(v);
    }
    return out;
  }
  if (typeof value === "object") {
    const out: Record<string, number> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      const n = Number(v);
      if (!Number.isNaN(n)) out[key] = n;
    }
    return out;
  }
  return {};
}

export function serializeAdmissionCycle(
  cycle: Record<string, unknown>
): AdmissionCycleDTO {
  const delegate = cycle.delegate as
    | (IAdmissionCycle["delegate"] & Record<string, unknown>)
    | null
    | undefined;

  return {
    id: objectIdToString(cycle._id),
    schoolId: objectIdToString(cycle.schoolId),
    name: String(cycle.name ?? ""),
    slug: String(cycle.slug ?? ""),
    intakeGradeIds: ((cycle.intakeGradeIds ?? []) as unknown[]).map(
      objectIdToString
    ),
    targetAcademicPeriodId: cycle.targetAcademicPeriodId
      ? objectIdToString(cycle.targetAcademicPeriodId)
      : null,
    acceptsApplicationsFrom:
      dateToIso(cycle.acceptsApplicationsFrom) ?? new Date(0).toISOString(),
    acceptsApplicationsUntil: dateToIso(cycle.acceptsApplicationsUntil),
    decisionDueBy: dateToIso(cycle.decisionDueBy),
    status: (cycle.status as IAdmissionCycle["status"]) ?? "draft",
    formId: cycle.formId ? objectIdToString(cycle.formId) : null,
    capacityByGradeId: capacityMapToObject(cycle.capacityByGradeId),
    waitlistEnabled: Boolean(cycle.waitlistEnabled ?? true),
    applicationFee: (cycle.applicationFee ??
      null) as IAdmissionCycle["applicationFee"],
    acceptanceTemplate: cycle.acceptanceTemplate as IAdmissionCycle["acceptanceTemplate"],
    rejectionTemplate: cycle.rejectionTemplate as IAdmissionCycle["rejectionTemplate"],
    branding: (cycle.branding ?? {}) as IAdmissionCycle["branding"],
    delegate: delegate
      ? {
          userId: objectIdToString(delegate.userId),
          teacherId: delegate.teacherId
            ? objectIdToString(delegate.teacherId)
            : null,
          assignedAt:
            dateToIso(delegate.assignedAt) ?? new Date().toISOString(),
          assignedBy: objectIdToString(delegate.assignedBy),
        }
      : null,
    analytics: (cycle.analytics ?? {
      totalSubmissions: 0,
      byStatus: {},
      byChannel: {},
    }) as IAdmissionCycle["analytics"],
    publishedAt: dateToIso(cycle.publishedAt),
    closedAt: dateToIso(cycle.closedAt),
    createdAt: dateToIso(cycle.createdAt) ?? new Date().toISOString(),
    updatedAt: dateToIso(cycle.updatedAt) ?? new Date().toISOString(),
  };
}

export type AdmissionFormDTO = {
  id: string;
  cycleId: string;
  schoolId: string;
  version: number;
  sections: IAdmissionForm["sections"];
  documentRequirements: IAdmissionForm["documentRequirements"];
  consentText: string;
  localeDefault: string;
  updatedAt: string;
};

export function serializeAdmissionForm(
  form: Record<string, unknown>
): AdmissionFormDTO {
  return {
    id: objectIdToString(form._id),
    cycleId: objectIdToString(form.cycleId),
    schoolId: objectIdToString(form.schoolId),
    version: Number(form.version ?? 1),
    sections: (form.sections ?? []) as IAdmissionForm["sections"],
    documentRequirements: (form.documentRequirements ??
      []) as IAdmissionForm["documentRequirements"],
    consentText: String(form.consentText ?? ""),
    localeDefault: String(form.localeDefault ?? "en"),
    updatedAt: dateToIso(form.updatedAt) ?? new Date().toISOString(),
  };
}

/**
 * Validates an updated form schema against the platform-required fields:
 * - Each platform-required system field must still be present, visible, and required.
 * - Returns the list of violations (empty array means valid).
 */
export function validatePlatformRequiredFields(
  schema: AdmissionFormSchema
): { ok: true } | { ok: false; missing: AdmissionSystemFieldKey[]; reason: string } {
  const presentByKey = new Map<AdmissionSystemFieldKey, { visible: boolean; required: boolean }>();
  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (field.systemFieldKey) {
        presentByKey.set(field.systemFieldKey, {
          visible: field.visible !== false,
          required: field.required === true,
        });
      }
    }
  }

  const missing: AdmissionSystemFieldKey[] = [];
  for (const key of PLATFORM_REQUIRED_FIELD_KEYS) {
    const found = presentByKey.get(key);
    if (!found || !found.visible || !found.required) {
      missing.push(key);
    }
  }

  if (missing.length === 0) return { ok: true };
  return {
    ok: false,
    missing,
    reason:
      "These fields are required by the platform and must remain visible and required: " +
      missing.join(", "),
  };
}

/**
 * Returns a fresh default form schema. Used both at cycle creation and when
 * the admin clicks "Reset to defaults".
 */
export function getDefaultAdmissionFormSchema(): AdmissionFormSchema {
  return buildDefaultAdmissionFormSchema();
}
