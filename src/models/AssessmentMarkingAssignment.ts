import { Schema, model, models, type Model, type Types } from "mongoose";

export const ASSESSMENT_MARKING_ASSIGNMENT_STATUSES = ["active", "reassigned", "closed"] as const;
export type AssessmentMarkingAssignmentStatus = (typeof ASSESSMENT_MARKING_ASSIGNMENT_STATUSES)[number];

export interface IAssessmentMarkingAssignment {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  assessmentDefinitionVersionId: Types.ObjectId;
  assessmentDeliveryVersionId: Types.ObjectId;
  assessmentPaperPacketId: Types.ObjectId;
  packetAssignmentId: Types.ObjectId;
  studentId: Types.ObjectId;
  markerUserId: Types.ObjectId;
  markerTeacherId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  assignedAt: Date;
  status: AssessmentMarkingAssignmentStatus;
  blindMarking: boolean;
  idempotencyKey: string;
  reassignedAt: Date | null;
  reassignedBy: Types.ObjectId | null;
  reassignReason: string | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const assignmentSchema = new Schema<IAssessmentMarkingAssignment>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    assessmentDefinitionVersionId: { type: Schema.Types.ObjectId, ref: "AssessmentDefinitionVersion", required: true, index: true },
    assessmentDeliveryVersionId: { type: Schema.Types.ObjectId, ref: "AssessmentDeliveryVersion", required: true, index: true },
    assessmentPaperPacketId: { type: Schema.Types.ObjectId, ref: "AssessmentPaperPacket", required: true, index: true },
    packetAssignmentId: { type: Schema.Types.ObjectId, ref: "AssessmentPaperPacketAssignment", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    markerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    markerTeacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedAt: { type: Date, required: true, default: () => new Date() },
    status: { type: String, enum: [...ASSESSMENT_MARKING_ASSIGNMENT_STATUSES], required: true, default: "active", index: true },
    blindMarking: { type: Boolean, required: true, default: false },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 240 },
    reassignedAt: { type: Date, default: null },
    reassignedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reassignReason: { type: String, trim: true, maxlength: 2000, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

assignmentSchema.index(
  { schoolId: 1, packetAssignmentId: 1, status: 1 },
  { unique: true, name: "assess_marking_assignment_active_script_unique", partialFilterExpression: { status: "active" } }
);
assignmentSchema.index({ schoolId: 1, idempotencyKey: 1 }, { unique: true, name: "assess_marking_assignment_idempotency_unique" });
assignmentSchema.index({ schoolId: 1, markerUserId: 1, status: 1, updatedAt: -1 });
assignmentSchema.index({ schoolId: 1, assessmentDeliveryVersionId: 1, status: 1, updatedAt: -1 });

const IMMUTABLE_PATHS = new Set([
  "schoolId", "assessmentDefinitionVersionId", "assessmentDeliveryVersionId", "assessmentPaperPacketId",
  "packetAssignmentId", "studentId", "markerUserId", "markerTeacherId", "assignedBy", "assignedAt",
  "blindMarking", "idempotencyKey", "createdAt",
]);

function changedPaths(update: unknown) {
  const paths = new Set<string>();
  for (const [key, value] of Object.entries((update ?? {}) as Record<string, unknown>)) {
    if (key.startsWith("$")) {
      if (value && typeof value === "object") Object.keys(value as Record<string, unknown>).forEach((path) => paths.add(path));
    } else paths.add(key);
  }
  return paths;
}

function assertLifecycleOnly(update: unknown) {
  const illegal = [...changedPaths(update)].filter((path) => IMMUTABLE_PATHS.has(path.split(".")[0]));
  if (illegal.length) throw new Error(`Marking assignment identity is immutable: ${illegal.join(", ")}`);
}

assignmentSchema.pre("save", function (next) {
  if (!this.isNew && this.modifiedPaths().some((path) => IMMUTABLE_PATHS.has(path.split(".")[0]))) {
    return next(new Error("Marking assignment identity is immutable"));
  }
  next();
});

for (const hook of ["updateOne", "updateMany", "findOneAndUpdate"] as const) {
  assignmentSchema.pre(hook, function (next) {
    try { assertLifecycleOnly(this.getUpdate()); next(); } catch (error) { next(error as Error); }
  });
}

export const AssessmentMarkingAssignment: Model<IAssessmentMarkingAssignment> =
  (models.AssessmentMarkingAssignment as Model<IAssessmentMarkingAssignment>) ||
  model<IAssessmentMarkingAssignment>("AssessmentMarkingAssignment", assignmentSchema);
