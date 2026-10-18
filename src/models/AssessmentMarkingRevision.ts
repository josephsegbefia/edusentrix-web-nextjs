import { Schema, model, models, type Model, type Types } from "mongoose";
import type { IAssessmentMarkingScoreEntry } from "./AssessmentMarkingEvaluation";

export const ASSESSMENT_MARKING_REVISION_KINDS = ["submitted", "returned", "approved"] as const;
export type AssessmentMarkingRevisionKind = (typeof ASSESSMENT_MARKING_REVISION_KINDS)[number];

export interface IAssessmentMarkingRevision {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  markingAssignmentId: Types.ObjectId;
  markingEvaluationId: Types.ObjectId;
  revisionNumber: number;
  kind: AssessmentMarkingRevisionKind;
  questionScores: IAssessmentMarkingScoreEntry[];
  totalMarks: number | null;
  unmarkedQuestionCount: number;
  actorUserId: Types.ObjectId;
  reason: string | null;
  idempotencyKey: string;
  createdAt: Date;
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

const revisionSchema = new Schema<IAssessmentMarkingRevision>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    markingAssignmentId: { type: Schema.Types.ObjectId, ref: "AssessmentMarkingAssignment", required: true, index: true },
    markingEvaluationId: { type: Schema.Types.ObjectId, ref: "AssessmentMarkingEvaluation", required: true, index: true },
    revisionNumber: { type: Number, required: true, min: 1 },
    kind: { type: String, enum: [...ASSESSMENT_MARKING_REVISION_KINDS], required: true },
    questionScores: { type: [scoreSchema], required: true },
    totalMarks: { type: Number, default: null, min: 0 },
    unmarkedQuestionCount: { type: Number, required: true, min: 0 },
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, default: null, maxlength: 2000 },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 240 },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: false }
);

revisionSchema.index({ schoolId: 1, markingAssignmentId: 1, revisionNumber: 1 }, { unique: true, name: "assess_marking_revision_unique" });
revisionSchema.index({ schoolId: 1, markingAssignmentId: 1, idempotencyKey: 1 }, { unique: true, name: "assess_marking_revision_idempotency_unique" });

revisionSchema.pre("save", function (next) {
  if (!this.isNew) return next(new Error("Marking revisions are append-only"));
  next();
});
for (const hook of ["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany", "findOneAndDelete"] as const) {
  revisionSchema.pre(hook, function (next) { next(new Error("Marking revisions are append-only")); });
}

export const AssessmentMarkingRevision: Model<IAssessmentMarkingRevision> =
  (models.AssessmentMarkingRevision as Model<IAssessmentMarkingRevision>) ||
  model<IAssessmentMarkingRevision>("AssessmentMarkingRevision", revisionSchema);
