import { Schema, model, models, type Model, type Types } from "mongoose";

export const ASSESSMENT_MARKING_REVIEWER_ASSIGNMENT_STATUSES = ["active", "revoked", "completed"] as const;
export type AssessmentMarkingReviewerAssignmentStatus = (typeof ASSESSMENT_MARKING_REVIEWER_ASSIGNMENT_STATUSES)[number];

export interface IAssessmentMarkingReviewerAssignment {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  assessmentDefinitionVersionId: Types.ObjectId;
  assessmentDeliveryVersionId: Types.ObjectId;
  assessmentPaperPacketId: Types.ObjectId;
  packetAssignmentId: Types.ObjectId;
  markingAssignmentId: Types.ObjectId;
  markingEvaluationId: Types.ObjectId | null;
  reviewerUserId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  assignedAt: Date;
  status: AssessmentMarkingReviewerAssignmentStatus;
  idempotencyKey: string;
  revokedAt: Date | null;
  revokedBy: Types.ObjectId | null;
  revokeReason: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const reviewerAssignmentSchema = new Schema<IAssessmentMarkingReviewerAssignment>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    assessmentDefinitionVersionId: { type: Schema.Types.ObjectId, ref: "AssessmentDefinitionVersion", required: true, index: true },
    assessmentDeliveryVersionId: { type: Schema.Types.ObjectId, ref: "AssessmentDeliveryVersion", required: true, index: true },
    assessmentPaperPacketId: { type: Schema.Types.ObjectId, ref: "AssessmentPaperPacket", required: true },
    packetAssignmentId: { type: Schema.Types.ObjectId, ref: "AssessmentPaperPacketAssignment", required: true, index: true },
    markingAssignmentId: { type: Schema.Types.ObjectId, ref: "AssessmentMarkingAssignment", required: true, index: true },
    markingEvaluationId: { type: Schema.Types.ObjectId, ref: "AssessmentMarkingEvaluation", default: null },
    reviewerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedAt: { type: Date, required: true, default: () => new Date() },
    status: { type: String, enum: [...ASSESSMENT_MARKING_REVIEWER_ASSIGNMENT_STATUSES], required: true, default: "active", index: true },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 240 },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    revokeReason: { type: String, trim: true, maxlength: 2000, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

reviewerAssignmentSchema.index(
  { schoolId: 1, markingAssignmentId: 1, status: 1 },
  { unique: true, name: "assess_marking_reviewer_active_unique", partialFilterExpression: { status: "active" } }
);
reviewerAssignmentSchema.index({ schoolId: 1, idempotencyKey: 1 }, { unique: true, name: "assess_marking_reviewer_idempotency_unique" });
reviewerAssignmentSchema.index({ schoolId: 1, reviewerUserId: 1, status: 1, updatedAt: -1 });

const IMMUTABLE_PATHS = new Set([
  "schoolId", "assessmentDefinitionVersionId", "assessmentDeliveryVersionId", "assessmentPaperPacketId",
  "packetAssignmentId", "markingAssignmentId", "markingEvaluationId", "reviewerUserId", "assignedBy", "assignedAt", "idempotencyKey", "createdAt",
]);
const LIFECYCLE_PATHS = new Set(["status", "revokedAt", "revokedBy", "revokeReason", "completedAt", "updatedAt"]);

function updatePaths(update: unknown) {
  return Object.entries((update ?? {}) as Record<string, unknown>).flatMap(([operator, value]) => {
    if (!operator.startsWith("$")) return [operator];
    return value && typeof value === "object" ? Object.keys(value as Record<string, unknown>) : [];
  });
}

function assertLifecycleOnly(update: unknown) {
  const paths = updatePaths(update);
  const illegal = paths.filter((path) => IMMUTABLE_PATHS.has(path.split(".")[0]) || !LIFECYCLE_PATHS.has(path.split(".")[0]));
  if (illegal.length) throw new Error(`Reviewer assignment identity is immutable: ${illegal.join(", ")}`);
}

reviewerAssignmentSchema.pre("save", function (next) {
  if (!this.isNew && this.modifiedPaths().some((path) => IMMUTABLE_PATHS.has(path.split(".")[0]))) return next(new Error("Reviewer assignment identity is immutable"));
  next();
});
for (const hook of ["updateOne", "updateMany", "findOneAndUpdate"] as const) {
  reviewerAssignmentSchema.pre(hook, function (next) {
    try { assertLifecycleOnly(this.getUpdate()); next(); } catch (error) { next(error as Error); }
  });
}

export const AssessmentMarkingReviewerAssignment: Model<IAssessmentMarkingReviewerAssignment> =
  (models.AssessmentMarkingReviewerAssignment as Model<IAssessmentMarkingReviewerAssignment>) ||
  model<IAssessmentMarkingReviewerAssignment>("AssessmentMarkingReviewerAssignment", reviewerAssignmentSchema);
