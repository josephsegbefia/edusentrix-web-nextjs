import { Schema, model, models, type Model, type Types } from "mongoose";

export const ASSESSMENT_EVIDENCE_SESSION_STATUSES = ["active", "revoked", "expired", "closed"] as const;
export type AssessmentEvidenceSessionStatus = (typeof ASSESSMENT_EVIDENCE_SESSION_STATUSES)[number];

export interface IAssessmentEvidenceCaptureSession {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  assessmentDeliveryVersionId: Types.ObjectId;
  operatorUserId: Types.ObjectId;
  deviceSessionId: string;
  idempotencyKey: string;
  status: AssessmentEvidenceSessionStatus;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedBy: Types.ObjectId | null;
  revokeReason: string | null;
  closedAt: Date | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<IAssessmentEvidenceCaptureSession>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    assessmentDeliveryVersionId: { type: Schema.Types.ObjectId, ref: "AssessmentDeliveryVersion", required: true },
    operatorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    deviceSessionId: { type: String, required: true, trim: true, maxlength: 160 },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 240 },
    status: { type: String, enum: [...ASSESSMENT_EVIDENCE_SESSION_STATUSES], required: true, default: "active", index: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    revokeReason: { type: String, trim: true, maxlength: 1000, default: null },
    closedAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

sessionSchema.index({ schoolId: 1, idempotencyKey: 1 }, { unique: true, name: "assess_evidence_session_idempotency_unique" });
sessionSchema.index({ schoolId: 1, operatorUserId: 1, status: 1, expiresAt: 1 });

export const AssessmentEvidenceCaptureSession: Model<IAssessmentEvidenceCaptureSession> =
  (models.AssessmentEvidenceCaptureSession as Model<IAssessmentEvidenceCaptureSession>) ||
  model<IAssessmentEvidenceCaptureSession>("AssessmentEvidenceCaptureSession", sessionSchema);
