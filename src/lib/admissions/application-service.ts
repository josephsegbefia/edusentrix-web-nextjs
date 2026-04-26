// src/lib/admissions/application-service.ts
// Server-side helpers for admin-facing application APIs (DTO serialization,
// search/filter helpers).

import type { IAdmissionApplication } from "@/models/AdmissionApplication";
import type { AdmissionApplicationStatus } from "./types";

export type AdmissionApplicationListItemDTO = {
  id: string;
  cycleId: string;
  referenceCode: string;
  status: AdmissionApplicationStatus;
  channel: string;
  feeStatus: string;
  submittedAt: string | null;
  applicant: {
    firstName: string;
    lastName: string;
    intendedGradeId: string | null;
    intendedGradeName: string | null;
    sex: "male" | "female" | null;
    dateOfBirth: string | null;
    photoUrl: string | null;
  };
  guardian: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    relationship: string | null;
  };
  documentsCount: number;
  hasDecision: boolean;
  provisioned: boolean;
  assignedReviewerId: string | null;
  trackerToken: string;
};

export type AdmissionApplicationDetailDTO = AdmissionApplicationListItemDTO & {
  formVersion: number;
  applicantAddress: string | null;
  guardianAddress: string | null;
  guardianOccupation: string | null;
  additional: Record<string, unknown>;
  documents: Array<{
    requirementId: string;
    label: string;
    fileUrl: string;
    fileName: string | null;
    sizeBytes: number | null;
    mimeType: string | null;
    uploadedAt: string;
  }>;
  decision: {
    outcome: "accepted" | "rejected" | "waitlisted";
    notes: string | null;
    decidedAt: string;
    targetGradeId: string | null;
    targetClassGroupId: string | null;
  } | null;
  notesPrivate: string | null;
  inviteCode: string | null;
  referrer: string | null;
};

export function serializeApplicationListItem(
  app: IAdmissionApplication & { _gradeName?: string | null }
): AdmissionApplicationListItemDTO {
  return {
    id: String(app._id),
    cycleId: String(app.cycleId),
    referenceCode: app.referenceCode,
    status: app.status,
    channel: app.channel,
    feeStatus: app.feeStatus,
    submittedAt: app.submittedAt ? new Date(app.submittedAt).toISOString() : null,
    applicant: {
      firstName: app.applicant.firstName,
      lastName: app.applicant.lastName,
      intendedGradeId: app.applicant.intendedGradeId
        ? String(app.applicant.intendedGradeId)
        : null,
      intendedGradeName: app._gradeName ?? null,
      sex: app.applicant.sex ?? null,
      dateOfBirth: app.applicant.dateOfBirth
        ? new Date(app.applicant.dateOfBirth).toISOString()
        : null,
      photoUrl: app.applicant.photoUrl ?? null,
    },
    guardian: {
      firstName: app.guardian.firstName,
      lastName: app.guardian.lastName,
      email: app.guardian.email,
      phone: app.guardian.phone ?? null,
      relationship: app.guardian.relationship ?? null,
    },
    documentsCount: (app.documents ?? []).length,
    hasDecision: Boolean(app.decision),
    provisioned: Boolean(app.provisioned),
    assignedReviewerId: app.assignedReviewerId
      ? String(app.assignedReviewerId)
      : null,
    trackerToken: app.tracker?.token ?? "",
  };
}

export function serializeApplicationDetail(
  app: IAdmissionApplication & { _gradeName?: string | null }
): AdmissionApplicationDetailDTO {
  const additionalEntries: Record<string, unknown> = {};
  const additionalRaw = app.additional;
  if (additionalRaw instanceof Map) {
    for (const [k, v] of additionalRaw.entries()) additionalEntries[k] = v;
  } else if (additionalRaw && typeof additionalRaw === "object") {
    Object.assign(additionalEntries, additionalRaw);
  }

  return {
    ...serializeApplicationListItem(app),
    formVersion: app.formVersion,
    applicantAddress: app.applicant.address ?? null,
    guardianAddress: app.guardian.address ?? null,
    guardianOccupation: app.guardian.occupation ?? null,
    additional: additionalEntries,
    documents: (app.documents ?? []).map((doc) => ({
      requirementId: doc.requirementId,
      label: doc.label,
      fileUrl: doc.fileUrl,
      fileName: doc.fileName ?? null,
      sizeBytes: doc.sizeBytes ?? null,
      mimeType: doc.mimeType ?? null,
      uploadedAt: new Date(doc.uploadedAt).toISOString(),
    })),
    decision: app.decision
      ? {
          outcome: app.decision.outcome,
          notes: app.decision.notes ?? null,
          decidedAt: new Date(app.decision.decidedAt).toISOString(),
          targetGradeId: app.decision.targetGradeId
            ? String(app.decision.targetGradeId)
            : null,
          targetClassGroupId: app.decision.targetClassGroupId
            ? String(app.decision.targetClassGroupId)
            : null,
        }
      : null,
    notesPrivate: app.notesPrivate ?? null,
    inviteCode: app.inviteCode ?? null,
    referrer: app.referrer ?? null,
  };
}
