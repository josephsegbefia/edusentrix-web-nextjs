import { Schema, model, models, type Model, type Types } from "mongoose";
import type { IAssessmentMarkingScoreEntry } from "./AssessmentMarkingEvaluation";

export const ASSESSMENT_APPROVED_MARKING_OUTCOME_STATUSES = ["current", "superseded"] as const;
export type AssessmentApprovedMarkingOutcomeStatus = (typeof ASSESSMENT_APPROVED_MARKING_OUTCOME_STATUSES)[number];

export interface IAssessmentMarkingEvidenceProvenance {
  evidencePageId: Types.ObjectId;
  pageId: string;
  pageNumber: number | null;
  assetId: Types.ObjectId;
  receiptId: Types.ObjectId;
  digest: string;
  sizeBytes: number;
}

export interface IAssessmentApprovedMarkingOutcome {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  assessmentDefinitionVersionId: Types.ObjectId;
  assessmentDeliveryVersionId: Types.ObjectId;
  assessmentPaperPacketId: Types.ObjectId;
  packetAssignmentId: Types.ObjectId;
  studentId: Types.ObjectId;
  markingAssignmentId: Types.ObjectId;
  markingEvaluationId: Types.ObjectId;
  reviewerAssignmentId: Types.ObjectId;
  approvedRevisionId: Types.ObjectId;
  approvedRevisionNumber: number;
  outcomeKey: string;
  questionScores: IAssessmentMarkingScoreEntry[];
  maximumAvailableMarks: number;
  totalMarks: number;
  unmarkedQuestionCount: number;
  definitionContentHash: string;
  deliveryContentHash: string;
  questionCatalogDigest: string;
  evidenceProvenance: IAssessmentMarkingEvidenceProvenance[];
  evidenceProvenanceDigest: string;
  integrityReference: string;
  approvedBy: Types.ObjectId;
  approvedAt: Date;
  status: AssessmentApprovedMarkingOutcomeStatus;
  coreResultStatus: "not_written";
  scoreHandoffStatus: "not_authorized";
  createdAt: Date;
  updatedAt: Date;
}

const scoreSchema = new Schema<IAssessmentMarkingScoreEntry>({
  questionId: { type: String, required: true, trim: true, maxlength: 160 },
  sectionId: { type: String, default: null, maxlength: 160 },
  questionOrder: { type: Number, required: true, min: 0 },
  maximumMarks: { type: Number, required: true, min: 0 },
  criteriaDigest: { type: String, required: true, length: 64 },
  score: { type: Number, required: true, min: 0 },
  feedback: { type: String, default: null, maxlength: 4000 },
}, { _id: false });

const provenanceSchema = new Schema<IAssessmentMarkingEvidenceProvenance>({
  evidencePageId: { type: Schema.Types.ObjectId, ref: "AssessmentEvidencePage", required: true },
  pageId: { type: String, required: true, maxlength: 160 },
  pageNumber: { type: Number, default: null },
  assetId: { type: Schema.Types.ObjectId, ref: "StoredAsset", required: true },
  receiptId: { type: Schema.Types.ObjectId, ref: "AssessmentEvidenceReceipt", required: true },
  digest: { type: String, required: true, length: 64, match: /^[a-f0-9]{64}$/ },
  sizeBytes: { type: Number, required: true, min: 1 },
}, { _id: false });

const outcomeSchema = new Schema<IAssessmentApprovedMarkingOutcome>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  assessmentDefinitionVersionId: { type: Schema.Types.ObjectId, ref: "AssessmentDefinitionVersion", required: true, index: true },
  assessmentDeliveryVersionId: { type: Schema.Types.ObjectId, ref: "AssessmentDeliveryVersion", required: true, index: true },
  assessmentPaperPacketId: { type: Schema.Types.ObjectId, ref: "AssessmentPaperPacket", required: true },
  packetAssignmentId: { type: Schema.Types.ObjectId, ref: "AssessmentPaperPacketAssignment", required: true },
  studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  markingAssignmentId: { type: Schema.Types.ObjectId, ref: "AssessmentMarkingAssignment", required: true },
  markingEvaluationId: { type: Schema.Types.ObjectId, ref: "AssessmentMarkingEvaluation", required: true },
  reviewerAssignmentId: { type: Schema.Types.ObjectId, ref: "AssessmentMarkingReviewerAssignment", required: true },
  approvedRevisionId: { type: Schema.Types.ObjectId, ref: "AssessmentMarkingRevision", required: true },
  approvedRevisionNumber: { type: Number, required: true, min: 1 },
  outcomeKey: { type: String, required: true, trim: true, maxlength: 300 },
  questionScores: { type: [scoreSchema], required: true },
  maximumAvailableMarks: { type: Number, required: true, min: 0 },
  totalMarks: { type: Number, required: true, min: 0 },
  unmarkedQuestionCount: { type: Number, required: true, min: 0, default: 0 },
  definitionContentHash: { type: String, required: true, length: 64 },
  deliveryContentHash: { type: String, required: true, length: 64 },
  questionCatalogDigest: { type: String, required: true, length: 64 },
  evidenceProvenance: { type: [provenanceSchema], required: true },
  evidenceProvenanceDigest: { type: String, required: true, length: 64 },
  integrityReference: { type: String, required: true, length: 64 },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  approvedAt: { type: Date, required: true },
  status: { type: String, enum: [...ASSESSMENT_APPROVED_MARKING_OUTCOME_STATUSES], required: true, default: "current", index: true },
  coreResultStatus: { type: String, enum: ["not_written"], required: true, default: "not_written" },
  scoreHandoffStatus: { type: String, enum: ["not_authorized"], required: true, default: "not_authorized" },
}, { timestamps: true });

outcomeSchema.index({ schoolId: 1, outcomeKey: 1 }, { unique: true, name: "assess_approved_outcome_key_unique" });
outcomeSchema.index({ schoolId: 1, approvedRevisionId: 1 }, { unique: true, name: "assess_approved_outcome_revision_unique" });
outcomeSchema.index({ schoolId: 1, markingAssignmentId: 1, status: 1 }, { unique: true, name: "assess_approved_outcome_current_unique", partialFilterExpression: { status: "current" } });

const IMMUTABLE_PATHS = new Set([
  "schoolId", "assessmentDefinitionVersionId", "assessmentDeliveryVersionId", "assessmentPaperPacketId", "packetAssignmentId", "studentId", "markingAssignmentId", "markingEvaluationId", "reviewerAssignmentId", "approvedRevisionId", "approvedRevisionNumber", "outcomeKey", "questionScores", "maximumAvailableMarks", "totalMarks", "unmarkedQuestionCount", "definitionContentHash", "deliveryContentHash", "questionCatalogDigest", "evidenceProvenance", "evidenceProvenanceDigest", "integrityReference", "approvedBy", "approvedAt", "coreResultStatus", "scoreHandoffStatus", "createdAt",
]);

outcomeSchema.pre("save", function (next) {
  if (!this.isNew) return next(new Error("Approved marking outcomes are immutable"));
  next();
});
for (const hook of ["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany", "findOneAndDelete"] as const) {
  outcomeSchema.pre(hook, function (next) {
    if (hook.startsWith("delete")) return next(new Error("Approved marking outcomes are append-only"));
    const update = this.getUpdate() as Record<string, unknown> | undefined;
    const paths = Object.entries(update ?? {}).flatMap(([operator, value]) => operator.startsWith("$") && value && typeof value === "object" ? Object.keys(value as Record<string, unknown>) : [operator]);
    const illegal = paths.filter((path) => IMMUTABLE_PATHS.has(path.split(".")[0]));
    if (illegal.length || paths.some((path) => path.split(".")[0] !== "status")) return next(new Error("Approved marking outcomes are immutable"));
    next();
  });
}

export const AssessmentApprovedMarkingOutcome: Model<IAssessmentApprovedMarkingOutcome> =
  (models.AssessmentApprovedMarkingOutcome as Model<IAssessmentApprovedMarkingOutcome>) ||
  model<IAssessmentApprovedMarkingOutcome>("AssessmentApprovedMarkingOutcome", outcomeSchema);
