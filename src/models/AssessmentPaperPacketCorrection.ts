import { Schema, model, models, type Model, type Types } from "mongoose";

export const ASSESSMENT_PACKET_CORRECTION_STATUSES = ["pending", "approved", "rejected"] as const;
export type AssessmentPacketCorrectionStatus = (typeof ASSESSMENT_PACKET_CORRECTION_STATUSES)[number];

export interface IAssessmentPaperPacketCorrection {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  assessmentDeliveryVersionId: Types.ObjectId;
  assessmentPaperPacketId: Types.ObjectId;
  assignmentId: Types.ObjectId;
  originalStudentId: Types.ObjectId;
  proposedStudentId: Types.ObjectId;
  reason: string;
  status: AssessmentPacketCorrectionStatus;
  correctionIdempotencyKey: string;
  requestedBy: Types.ObjectId;
  requestedAt: Date;
  reviewedBy: Types.ObjectId | null;
  reviewedAt: Date | null;
  decisionReason: string | null;
  resultingAssignmentId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const correctionSchema = new Schema<IAssessmentPaperPacketCorrection>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    assessmentDeliveryVersionId: { type: Schema.Types.ObjectId, ref: "AssessmentDeliveryVersion", required: true, index: true },
    assessmentPaperPacketId: { type: Schema.Types.ObjectId, ref: "AssessmentPaperPacket", required: true, index: true },
    assignmentId: { type: Schema.Types.ObjectId, ref: "AssessmentPaperPacketAssignment", required: true, index: true },
    originalStudentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    proposedStudentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    reason: { type: String, required: true, trim: true, minlength: 3, maxlength: 2000 },
    status: { type: String, enum: [...ASSESSMENT_PACKET_CORRECTION_STATUSES], required: true, default: "pending", index: true },
    correctionIdempotencyKey: { type: String, required: true, trim: true, maxlength: 240 },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    requestedAt: { type: Date, required: true, default: () => new Date() },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    decisionReason: { type: String, trim: true, maxlength: 2000, default: null },
    resultingAssignmentId: { type: Schema.Types.ObjectId, ref: "AssessmentPaperPacketAssignment", default: null },
  },
  { timestamps: true }
);

correctionSchema.index({ schoolId: 1, correctionIdempotencyKey: 1 }, { unique: true, name: "assess_packet_correction_idempotency_unique" });
correctionSchema.index(
  { schoolId: 1, assignmentId: 1, status: 1 },
  { unique: true, name: "assess_packet_correction_pending_unique", partialFilterExpression: { status: "pending" } }
);
correctionSchema.index({ schoolId: 1, assessmentDeliveryVersionId: 1, status: 1, requestedAt: -1 });

const IMMUTABLE_PATHS = new Set([
  "schoolId", "assessmentDeliveryVersionId", "assessmentPaperPacketId", "assignmentId", "originalStudentId",
  "proposedStudentId", "reason", "correctionIdempotencyKey", "requestedBy", "requestedAt", "createdAt",
]);
function assertMutable(update: unknown) {
  const paths = new Set<string>();
  for (const [key, value] of Object.entries((update ?? {}) as Record<string, unknown>)) {
    if (key.startsWith("$")) {
      if (value && typeof value === "object") Object.keys(value as Record<string, unknown>).forEach((path) => paths.add(path));
    } else paths.add(key);
  }
  const illegal = [...paths].filter((path) => IMMUTABLE_PATHS.has(path.split(".")[0]));
  if (illegal.length) throw new Error(`Correction request history is immutable: ${illegal.join(", ")}`);
}
correctionSchema.pre("save", function (next) {
  if (!this.isNew && this.modifiedPaths().some((path) => IMMUTABLE_PATHS.has(path.split(".")[0]))) return next(new Error("Correction request history is immutable"));
  next();
});
for (const hook of ["updateOne", "updateMany", "findOneAndUpdate"] as const) {
  correctionSchema.pre(hook, function (next) {
    try { assertMutable(this.getUpdate()); next(); } catch (error) { next(error as Error); }
  });
}

export const AssessmentPaperPacketCorrection: Model<IAssessmentPaperPacketCorrection> =
  (models.AssessmentPaperPacketCorrection as Model<IAssessmentPaperPacketCorrection>) ||
  model<IAssessmentPaperPacketCorrection>("AssessmentPaperPacketCorrection", correctionSchema);

