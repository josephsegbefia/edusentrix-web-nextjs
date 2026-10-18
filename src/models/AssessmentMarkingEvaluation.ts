import { Schema, model, models, type Model, type Types } from "mongoose";

export const ASSESSMENT_MARKING_EVALUATION_STATUSES = ["assigned", "in_progress", "submitted", "returned", "approved"] as const;
export type AssessmentMarkingEvaluationStatus = (typeof ASSESSMENT_MARKING_EVALUATION_STATUSES)[number];

export interface IAssessmentMarkingScoreEntry {
  questionId: string;
  sectionId: string | null;
  questionOrder: number;
  maximumMarks: number;
  criteriaDigest: string;
  score: number | null;
  feedback: string | null;
}

export interface IAssessmentMarkingEvaluation {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  markingAssignmentId: Types.ObjectId;
  assessmentDefinitionVersionId: Types.ObjectId;
  assessmentDeliveryVersionId: Types.ObjectId;
  packetAssignmentId: Types.ObjectId;
  studentId: Types.ObjectId;
  markerUserId: Types.ObjectId;
  status: AssessmentMarkingEvaluationStatus;
  blindMarking: boolean;
  draftVersion: number;
  questionScores: IAssessmentMarkingScoreEntry[];
  totalMarks: number | null;
  unmarkedQuestionCount: number;
  lastSavedAt: Date | null;
  submittedRevision: number | null;
  submittedAt: Date | null;
  returnedAt: Date | null;
  returnReason: string | null;
  reviewedBy: Types.ObjectId | null;
  reviewedAt: Date | null;
  reviewDecision: "approved" | "returned" | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const scoreSchema = new Schema<IAssessmentMarkingScoreEntry>(
  {
    questionId: { type: String, required: true, trim: true, maxlength: 160 },
    sectionId: { type: String, default: null, maxlength: 160 },
    questionOrder: { type: Number, required: true, min: 0 },
    maximumMarks: { type: Number, required: true, min: 0 },
    criteriaDigest: { type: String, required: true, length: 64 },
    score: { type: Number, default: null, min: 0 },
    feedback: { type: String, default: null, maxlength: 4000 },
  },
  { _id: false }
);

const evaluationSchema = new Schema<IAssessmentMarkingEvaluation>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    markingAssignmentId: { type: Schema.Types.ObjectId, ref: "AssessmentMarkingAssignment", required: true, unique: true },
    assessmentDefinitionVersionId: { type: Schema.Types.ObjectId, ref: "AssessmentDefinitionVersion", required: true, index: true },
    assessmentDeliveryVersionId: { type: Schema.Types.ObjectId, ref: "AssessmentDeliveryVersion", required: true, index: true },
    packetAssignmentId: { type: Schema.Types.ObjectId, ref: "AssessmentPaperPacketAssignment", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    markerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: [...ASSESSMENT_MARKING_EVALUATION_STATUSES], required: true, default: "assigned", index: true },
    blindMarking: { type: Boolean, required: true, default: false },
    draftVersion: { type: Number, required: true, min: 0, default: 0 },
    questionScores: { type: [scoreSchema], default: [] },
    totalMarks: { type: Number, default: null, min: 0 },
    unmarkedQuestionCount: { type: Number, required: true, min: 0, default: 0 },
    lastSavedAt: { type: Date, default: null },
    submittedRevision: { type: Number, default: null, min: 1 },
    submittedAt: { type: Date, default: null },
    returnedAt: { type: Date, default: null },
    returnReason: { type: String, default: null, maxlength: 2000 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewDecision: { type: String, enum: ["approved", "returned"], default: null },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

evaluationSchema.index({ schoolId: 1, markerUserId: 1, status: 1, updatedAt: -1 });
evaluationSchema.index({ schoolId: 1, status: 1, updatedAt: -1 });

const IMMUTABLE_PATHS = new Set([
  "schoolId", "markingAssignmentId", "assessmentDefinitionVersionId", "assessmentDeliveryVersionId",
  "packetAssignmentId", "studentId", "markerUserId", "blindMarking", "createdAt",
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

evaluationSchema.pre("save", function (next) {
  if (!this.isNew && this.modifiedPaths().some((path) => IMMUTABLE_PATHS.has(path.split(".")[0]))) return next(new Error("Marking evaluation identity is immutable"));
  if (!this.isNew && this.status === "approved" && this.modifiedPaths().some((path) => ["questionScores", "totalMarks", "unmarkedQuestionCount"].includes(path.split(".")[0]))) return next(new Error("Approved marking scores are immutable"));
  next();
});
evaluationSchema.pre("save", async function (next) {
  if (this.isNew || !this.isModified("status")) return next();
  const model = this.constructor as Model<IAssessmentMarkingEvaluation>;
  const query = model.findById(this._id).select("status");
  const existing = await (this.$session() ? query.session(this.$session()!) : query).lean<{ status: AssessmentMarkingEvaluationStatus } | null>();
  if (existing?.status === "approved") return next(new Error("Approved marking evaluations cannot be reopened"));
  next();
});
for (const hook of ["updateOne", "updateMany", "findOneAndUpdate"] as const) {
  evaluationSchema.pre(hook, function (next) {
    const illegal = [...changedPaths(this.getUpdate())].filter((path) => IMMUTABLE_PATHS.has(path.split(".")[0]));
    if (illegal.length) return next(new Error(`Marking evaluation identity is immutable: ${illegal.join(", ")}`));
    next();
  });
}
evaluationSchema.pre("findOneAndUpdate", async function (next) {
  const paths = changedPaths(this.getUpdate());
  if (![...paths].some((path: string) => ["status", "questionScores", "totalMarks", "unmarkedQuestionCount"].includes(path.split(".")[0]))) return next();
  const existing = await this.model.findOne(this.getQuery()).select("status").lean<{ status: AssessmentMarkingEvaluationStatus } | null>();
  if (existing?.status === "approved") return next(new Error("Approved marking evaluations cannot be changed"));
  next();
});

export const AssessmentMarkingEvaluation: Model<IAssessmentMarkingEvaluation> =
  (models.AssessmentMarkingEvaluation as Model<IAssessmentMarkingEvaluation>) ||
  model<IAssessmentMarkingEvaluation>("AssessmentMarkingEvaluation", evaluationSchema);
