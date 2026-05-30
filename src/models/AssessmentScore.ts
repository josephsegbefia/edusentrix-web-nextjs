import { Schema, model, models, Types, type Model } from "mongoose";
import type { AssessmentScoreStatus } from "@/types/academics/assessment-engine";
import { ASSESSMENT_SCORE_STATUSES } from "@/models/academics/assessment-engine-schemas";

export interface IAssessmentScore {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  assessmentItemId: Types.ObjectId;
  assessmentPlanId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  subjectId: Types.ObjectId;
  studentId: Types.ObjectId;
  teacherId: Types.ObjectId;
  score: number | null;
  maxScoreSnapshot: number;
  percentage: number | null;
  status: AssessmentScoreStatus;
  remarks?: string | null;
  gradedAt?: Date | null;
  recordedBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  sourceSubmissionId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const assessmentScoreSchema = new Schema<IAssessmentScore>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      required: true,
      index: true,
    },
    assessmentItemId: {
      type: Schema.Types.ObjectId,
      ref: "AssessmentItem",
      required: true,
      index: true,
    },
    assessmentPlanId: {
      type: Schema.Types.ObjectId,
      ref: "AssessmentPlan",
      required: true,
      index: true,
    },
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    score: { type: Number, default: null, min: 0 },
    maxScoreSnapshot: { type: Number, required: true, min: 0 },
    percentage: { type: Number, default: null, min: 0, max: 100 },
    status: {
      type: String,
      enum: [...ASSESSMENT_SCORE_STATUSES],
      required: true,
      default: "draft",
      index: true,
    },
    remarks: { type: String, default: null, maxlength: 1000 },
    gradedAt: { type: Date, default: null },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    sourceSubmissionId: {
      type: Schema.Types.ObjectId,
      ref: "Submission",
      default: null,
    },
  },
  { timestamps: true }
);

assessmentScoreSchema.index(
  { assessmentItemId: 1, studentId: 1 },
  { unique: true, name: "ae_assessment_score_unique_item_student" }
);

assessmentScoreSchema.index(
  {
    schoolId: 1,
    assessmentPlanId: 1,
    classGroupId: 1,
    subjectId: 1,
    studentId: 1,
  },
  { name: "ae_assessment_score_by_plan_class_subject_student" }
);

export const AssessmentScore: Model<IAssessmentScore> =
  (models.AssessmentScore as Model<IAssessmentScore>) ||
  model<IAssessmentScore>("AssessmentScore", assessmentScoreSchema);
