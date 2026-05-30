import { Schema, model, models, Types, type Model } from "mongoose";
import type { ExamSessionStatus, ExamType } from "@/types/academics/exam-scheduling-engine";
import {
  examSessionStatusEnum,
  examTypeEnum,
} from "@/models/academics/exam-scheduling-engine-schemas";

export interface IExamSession {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  academicYearId?: Types.ObjectId | null;
  academicPeriodId: Types.ObjectId;
  name: string;
  code?: string | null;
  examType: ExamType;
  startDate: Date;
  endDate: Date;
  appliesToGradeIds?: Types.ObjectId[];
  appliesToClassGroupIds?: Types.ObjectId[];
  appliesToSubjectIds?: Types.ObjectId[];
  status: ExamSessionStatus;
  policyId?: Types.ObjectId | null;
  assessmentPlanId?: Types.ObjectId | null;
  gradingPolicyId?: Types.ObjectId | null;
  allowParentStudentVisibility: boolean;
  publishedAt?: Date | null;
  publishedBy?: Types.ObjectId | null;
  lockedAt?: Date | null;
  lockedBy?: Types.ObjectId | null;
  notes?: string | null;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const examSessionSchema = new Schema<IExamSession>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    academicYearId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicYear",
      default: null,
      index: true,
    },
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 300 },
    code: { type: String, default: null, trim: true, maxlength: 80 },
    examType: {
      type: String,
      enum: examTypeEnum,
      required: true,
      index: true,
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    appliesToGradeIds: {
      type: [Schema.Types.ObjectId],
      ref: "Grade",
      default: [],
    },
    appliesToClassGroupIds: {
      type: [Schema.Types.ObjectId],
      ref: "ClassGroup",
      default: [],
    },
    appliesToSubjectIds: {
      type: [Schema.Types.ObjectId],
      ref: "Subject",
      default: [],
    },
    status: {
      type: String,
      enum: examSessionStatusEnum,
      required: true,
      default: "draft",
      index: true,
    },
    policyId: {
      type: Schema.Types.ObjectId,
      ref: "ExamPolicy",
      default: null,
      index: true,
    },
    assessmentPlanId: {
      type: Schema.Types.ObjectId,
      ref: "AssessmentPlan",
      default: null,
      index: true,
    },
    gradingPolicyId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicGradingPolicy",
      default: null,
      index: true,
    },
    allowParentStudentVisibility: { type: Boolean, required: true, default: true },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    notes: { type: String, default: null, trim: true, maxlength: 5000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

examSessionSchema.index(
  { schoolId: 1, academicPeriodId: 1 },
  { name: "exam_session_by_school_period" }
);

examSessionSchema.index(
  { schoolId: 1, status: 1 },
  { name: "exam_session_by_school_status" }
);

examSessionSchema.index(
  { schoolId: 1, startDate: 1, endDate: 1 },
  { name: "exam_session_by_school_date_range" }
);

examSessionSchema.pre("validate", function validateExamSessionDates() {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate("endDate", "End date must be on or after start date.");
  }
});

export const ExamSession: Model<IExamSession> =
  (models.ExamSession as Model<IExamSession>) ||
  model<IExamSession>("ExamSession", examSessionSchema);
