import { Schema, model, models, type Model, type Types } from "mongoose";

export const ASSESSMENT_PACKET_ASSIGNMENT_STATUSES = ["active", "replaced"] as const;
export type AssessmentPacketAssignmentStatus = (typeof ASSESSMENT_PACKET_ASSIGNMENT_STATUSES)[number];

export interface IAssessmentPaperPacketAssignment {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  assessmentDeliveryVersionId: Types.ObjectId;
  assessmentPaperPacketId: Types.ObjectId;
  studentId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  gradeId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  status: AssessmentPacketAssignmentStatus;
  assignmentIdempotencyKey: string;
  assignedBy: Types.ObjectId;
  assignedAt: Date;
  replacedByCorrectionId: Types.ObjectId | null;
  replacedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const assignmentSchema = new Schema<IAssessmentPaperPacketAssignment>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    assessmentDeliveryVersionId: { type: Schema.Types.ObjectId, ref: "AssessmentDeliveryVersion", required: true, index: true },
    assessmentPaperPacketId: { type: Schema.Types.ObjectId, ref: "AssessmentPaperPacket", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    academicPeriodId: { type: Schema.Types.ObjectId, ref: "AcademicPeriod", required: true },
    gradeId: { type: Schema.Types.ObjectId, ref: "Grade", required: true },
    classGroupId: { type: Schema.Types.ObjectId, ref: "ClassGroup", required: true },
    status: { type: String, enum: [...ASSESSMENT_PACKET_ASSIGNMENT_STATUSES], required: true, default: "active", index: true },
    assignmentIdempotencyKey: { type: String, required: true, trim: true, maxlength: 240 },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedAt: { type: Date, required: true, default: () => new Date() },
    replacedByCorrectionId: { type: Schema.Types.ObjectId, ref: "AssessmentPaperPacketCorrection", default: null },
    replacedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

assignmentSchema.index(
  { schoolId: 1, assessmentPaperPacketId: 1, status: 1 },
  { unique: true, name: "assess_packet_assignment_active_packet_unique", partialFilterExpression: { status: "active" } }
);
assignmentSchema.index(
  { schoolId: 1, assessmentDeliveryVersionId: 1, studentId: 1, status: 1 },
  { unique: true, name: "assess_packet_assignment_active_student_unique", partialFilterExpression: { status: "active" } }
);
assignmentSchema.index({ schoolId: 1, assignmentIdempotencyKey: 1 }, { unique: true, name: "assess_packet_assignment_idempotency_unique" });
assignmentSchema.index({ schoolId: 1, assessmentDeliveryVersionId: 1, status: 1, assignedAt: -1 });

const IMMUTABLE_PATHS = new Set([
  "schoolId", "assessmentDeliveryVersionId", "assessmentPaperPacketId", "studentId",
  "academicPeriodId", "gradeId", "classGroupId", "assignmentIdempotencyKey", "assignedBy", "assignedAt", "createdAt",
]);

function changedPaths(update: Record<string, unknown>) {
  const paths = new Set<string>();
  for (const [key, value] of Object.entries(update)) {
    if (key.startsWith("$")) {
      if (value && typeof value === "object") Object.keys(value as Record<string, unknown>).forEach((path) => paths.add(path));
    } else paths.add(key);
  }
  return paths;
}

function assertMutable(update: unknown) {
  const paths = changedPaths((update ?? {}) as Record<string, unknown>);
  const illegal = [...paths].filter((path) => IMMUTABLE_PATHS.has(path.split(".")[0]));
  if (illegal.length) throw new Error(`Packet assignment identity is immutable: ${illegal.join(", ")}`);
}

assignmentSchema.pre("save", function (next) {
  if (!this.isNew && this.modifiedPaths().some((path) => IMMUTABLE_PATHS.has(path.split(".")[0]))) {
    return next(new Error("Packet assignment identity is immutable"));
  }
  next();
});
for (const hook of ["updateOne", "updateMany", "findOneAndUpdate"] as const) {
  assignmentSchema.pre(hook, function (next) {
    try { assertMutable(this.getUpdate()); next(); } catch (error) { next(error as Error); }
  });
}

export const AssessmentPaperPacketAssignment: Model<IAssessmentPaperPacketAssignment> =
  (models.AssessmentPaperPacketAssignment as Model<IAssessmentPaperPacketAssignment>) ||
  model<IAssessmentPaperPacketAssignment>("AssessmentPaperPacketAssignment", assignmentSchema);

