import { Schema, model, models, type Model, type Types } from "mongoose";

export const ASSESSMENT_SCORE_HANDOFF_RECEIPT_STATUSES = [
  "pending",
  "completed",
  "failed",
] as const;
export type AssessmentScoreHandoffReceiptStatus =
  (typeof ASSESSMENT_SCORE_HANDOFF_RECEIPT_STATUSES)[number];

export interface IAssessmentScoreHandoffReceipt {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  sourceOutcomeId: Types.ObjectId;
  approvedRevisionId: Types.ObjectId;
  assessmentDefinitionVersionId: Types.ObjectId;
  assessmentDeliveryVersionId: Types.ObjectId;
  studentId: Types.ObjectId;
  assessmentPlanId: Types.ObjectId;
  assessmentItemId: Types.ObjectId;
  coreAssessmentScoreId: Types.ObjectId | null;
  sourceTotalMarks: number;
  sourceMaximumMarks: number;
  appliedScore: number | null;
  appliedMaximumMarks: number;
  scaling: {
    method: "identity_raw_marks";
    sourceMaximumMarks: number;
    targetMaximumMarks: number;
    rounding: "none";
  };
  sourceOperationId: string;
  requestIdempotencyKey: string;
  outcomeIntegrityReference: string;
  actorUserId: Types.ObjectId;
  actorRole: "school_admin";
  entitlementKey: "assessment.premium_publication";
  auditEventId: Types.ObjectId;
  status: AssessmentScoreHandoffReceiptStatus;
  failureCode: string | null;
  completedAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const receiptSchema = new Schema<IAssessmentScoreHandoffReceipt>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    sourceOutcomeId: { type: Schema.Types.ObjectId, ref: "AssessmentApprovedMarkingOutcome", required: true },
    approvedRevisionId: { type: Schema.Types.ObjectId, ref: "AssessmentMarkingRevision", required: true },
    assessmentDefinitionVersionId: { type: Schema.Types.ObjectId, ref: "AssessmentDefinitionVersion", required: true },
    assessmentDeliveryVersionId: { type: Schema.Types.ObjectId, ref: "AssessmentDeliveryVersion", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    assessmentPlanId: { type: Schema.Types.ObjectId, ref: "AssessmentPlan", required: true },
    assessmentItemId: { type: Schema.Types.ObjectId, ref: "AssessmentItem", required: true },
    coreAssessmentScoreId: { type: Schema.Types.ObjectId, ref: "AssessmentScore", default: null },
    sourceTotalMarks: { type: Number, required: true, min: 0 },
    sourceMaximumMarks: { type: Number, required: true, min: 0 },
    appliedScore: { type: Number, default: null, min: 0 },
    appliedMaximumMarks: { type: Number, required: true, min: 0 },
    scaling: {
      method: { type: String, enum: ["identity_raw_marks"], required: true },
      sourceMaximumMarks: { type: Number, required: true, min: 0 },
      targetMaximumMarks: { type: Number, required: true, min: 0 },
      rounding: { type: String, enum: ["none"], required: true },
    },
    sourceOperationId: { type: String, required: true, trim: true, maxlength: 300 },
    requestIdempotencyKey: { type: String, required: true, trim: true, maxlength: 240 },
    outcomeIntegrityReference: { type: String, required: true, length: 64 },
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorRole: { type: String, enum: ["school_admin"], required: true },
    entitlementKey: { type: String, enum: ["assessment.premium_publication"], required: true },
    auditEventId: { type: Schema.Types.ObjectId, ref: "AuditEvent", required: true },
    status: { type: String, enum: [...ASSESSMENT_SCORE_HANDOFF_RECEIPT_STATUSES], required: true },
    failureCode: { type: String, default: null, maxlength: 120 },
    completedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

receiptSchema.index(
  { schoolId: 1, sourceOperationId: 1 },
  { unique: true, name: "assess_score_handoff_source_operation_unique" }
);
receiptSchema.index(
  { schoolId: 1, requestIdempotencyKey: 1 },
  { unique: true, name: "assess_score_handoff_request_idempotency_unique" }
);
receiptSchema.index(
  { schoolId: 1, assessmentItemId: 1, studentId: 1, status: 1 },
  {
    unique: true,
    name: "assess_score_handoff_current_target_unique",
    partialFilterExpression: { status: "completed" },
  }
);
receiptSchema.index({ schoolId: 1, sourceOutcomeId: 1, status: 1 });

const IMMUTABLE_PATHS = new Set([
  "schoolId",
  "sourceOutcomeId",
  "approvedRevisionId",
  "assessmentDefinitionVersionId",
  "assessmentDeliveryVersionId",
  "studentId",
  "assessmentPlanId",
  "assessmentItemId",
  "coreAssessmentScoreId",
  "sourceTotalMarks",
  "sourceMaximumMarks",
  "appliedScore",
  "appliedMaximumMarks",
  "scaling",
  "sourceOperationId",
  "requestIdempotencyKey",
  "outcomeIntegrityReference",
  "actorUserId",
  "actorRole",
  "entitlementKey",
  "auditEventId",
  "createdAt",
]);

function changedPaths(update: unknown) {
  const paths = new Set<string>();
  for (const [operator, value] of Object.entries((update ?? {}) as Record<string, unknown>)) {
    if (operator.startsWith("$") && value && typeof value === "object") {
      Object.keys(value as Record<string, unknown>).forEach((path) => paths.add(path));
    } else if (!operator.startsWith("$")) {
      paths.add(operator);
    }
  }
  return paths;
}

receiptSchema.pre("save", function (next) {
  if (!this.isNew && [...this.modifiedPaths()].some((path) => IMMUTABLE_PATHS.has(path.split(".")[0]))) {
    return next(new Error("Score handoff receipt provenance is immutable"));
  }
  next();
});

for (const hook of ["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany", "findOneAndDelete"] as const) {
  receiptSchema.pre(hook, function (next) {
    if (hook.startsWith("delete")) return next(new Error("Score handoff receipts are append-only"));
    const illegal = [...changedPaths(this.getUpdate())].filter((path) => IMMUTABLE_PATHS.has(path.split(".")[0]));
    if (illegal.length > 0) return next(new Error(`Score handoff receipt provenance is immutable: ${illegal.join(", ")}`));
    next();
  });
}

export const AssessmentScoreHandoffReceipt: Model<IAssessmentScoreHandoffReceipt> =
  (models.AssessmentScoreHandoffReceipt as Model<IAssessmentScoreHandoffReceipt>) ||
  model<IAssessmentScoreHandoffReceipt>("AssessmentScoreHandoffReceipt", receiptSchema);
