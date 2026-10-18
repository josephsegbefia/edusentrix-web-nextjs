import { Schema, model, models, type Model, type Types } from "mongoose";

export const ASSESSMENT_EVIDENCE_PAGE_STATUSES = ["reserved", "pending_reconciliation", "verified", "rejected", "deleted"] as const;
export type AssessmentEvidencePageStatus = (typeof ASSESSMENT_EVIDENCE_PAGE_STATUSES)[number];
export const ASSESSMENT_EVIDENCE_RECONCILIATION_OUTCOMES = [
  "awaiting_upload", "valid", "duplicate", "conflict", "unknown_packet", "wrong_delivery",
  "unknown_page", "voided_packet", "out_of_order", "unassigned_packet", "assignment_correction_pending",
  "missing_object", "invalid_digest", "invalid_mime", "invalid_size", "rejected",
] as const;
export type AssessmentEvidenceReconciliationOutcome = (typeof ASSESSMENT_EVIDENCE_RECONCILIATION_OUTCOMES)[number];

export interface IAssessmentEvidencePage {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  assessmentDeliveryVersionId: Types.ObjectId;
  captureSessionId: Types.ObjectId;
  packetId: Types.ObjectId | null;
  observedPacketId: string;
  pageId: string;
  expectedPageNumber: number | null;
  expectedPageCount: number | null;
  captureOrder: number | null;
  assignmentId: Types.ObjectId | null;
  assetId: Types.ObjectId | null;
  clientUploadId: string;
  expectedDigest: string | null;
  verifiedDigest: string | null;
  digestAlgorithm: "sha256";
  integrityStatus: "unverified" | "verified" | "rejected";
  status: AssessmentEvidencePageStatus;
  accepted: boolean;
  reconciliationOutcome: AssessmentEvidenceReconciliationOutcome;
  retentionPolicyRef: string;
  retentionUntil: Date | null;
  legalHold: { active: boolean; reference: string | null; reason: string | null; placedBy: Types.ObjectId | null; placedAt: Date | null };
  deletionStatus: "not_requested" | "requested" | "denied" | "deleted";
  uploadedAt: Date | null;
  verifiedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const legalHoldSchema = new Schema({
  active: { type: Boolean, required: true, default: false },
  reference: { type: String, trim: true, maxlength: 180, default: null },
  reason: { type: String, trim: true, maxlength: 1000, default: null },
  placedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  placedAt: { type: Date, default: null },
}, { _id: false });

const evidenceSchema = new Schema<IAssessmentEvidencePage>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    assessmentDeliveryVersionId: { type: Schema.Types.ObjectId, ref: "AssessmentDeliveryVersion", required: true },
    captureSessionId: { type: Schema.Types.ObjectId, ref: "AssessmentEvidenceCaptureSession", required: true },
    packetId: { type: Schema.Types.ObjectId, ref: "AssessmentPaperPacket", default: null },
    observedPacketId: { type: String, required: true, trim: true, maxlength: 160 },
    pageId: { type: String, required: true, trim: true, maxlength: 160 },
    expectedPageNumber: { type: Number, min: 1, default: null },
    expectedPageCount: { type: Number, min: 1, default: null },
    captureOrder: { type: Number, min: 1, default: null },
    assignmentId: { type: Schema.Types.ObjectId, ref: "AssessmentPaperPacketAssignment", default: null },
    assetId: { type: Schema.Types.ObjectId, ref: "StoredAsset", default: null },
    clientUploadId: { type: String, required: true, trim: true, maxlength: 240 },
    expectedDigest: { type: String, trim: true, lowercase: true, match: /^[a-f0-9]{64}$/, default: null },
    verifiedDigest: { type: String, trim: true, lowercase: true, match: /^[a-f0-9]{64}$/, default: null },
    digestAlgorithm: { type: String, enum: ["sha256"], required: true, default: "sha256" },
    integrityStatus: { type: String, enum: ["unverified", "verified", "rejected"], required: true, default: "unverified" },
    status: { type: String, enum: [...ASSESSMENT_EVIDENCE_PAGE_STATUSES], required: true, default: "reserved", index: true },
    reconciliationOutcome: { type: String, enum: [...ASSESSMENT_EVIDENCE_RECONCILIATION_OUTCOMES], required: true, default: "awaiting_upload", index: true },
    retentionPolicyRef: { type: String, required: true, trim: true, maxlength: 180, default: "assess-paper-evidence-default" },
    retentionUntil: { type: Date, default: null },
    legalHold: { type: legalHoldSchema, required: true, default: () => ({ active: false }) },
    deletionStatus: { type: String, enum: ["not_requested", "requested", "denied", "deleted"], required: true, default: "not_requested" },
    uploadedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

evidenceSchema.index({ schoolId: 1, captureSessionId: 1, clientUploadId: 1 }, { unique: true, name: "assess_evidence_client_upload_unique" });
evidenceSchema.index({ schoolId: 1, assessmentDeliveryVersionId: 1, packetId: 1, pageId: 1, status: 1 });
evidenceSchema.index({ schoolId: 1, reconciliationOutcome: 1, createdAt: -1 });
evidenceSchema.index({ schoolId: 1, retentionUntil: 1, deletionStatus: 1 });
evidenceSchema.index(
  { schoolId: 1, assessmentDeliveryVersionId: 1, packetId: 1, pageId: 1 },
  { unique: true, name: "assess_evidence_verified_page_unique", partialFilterExpression: { accepted: true } }
);

// `accepted` is deliberately not exposed in the public interface; it is a
// uniqueness marker used only to prevent two concurrent verified pages from
// becoming current for one packet/page.
evidenceSchema.add({ accepted: { type: Boolean, required: true, default: false } });

export const AssessmentEvidencePage: Model<IAssessmentEvidencePage> =
  (models.AssessmentEvidencePage as Model<IAssessmentEvidencePage>) ||
  model<IAssessmentEvidencePage>("AssessmentEvidencePage", evidenceSchema);
