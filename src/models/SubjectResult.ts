import { Schema, model, models, Types, type Model } from "mongoose";
import type {
  SubjectResultComponentSnapshot,
  SubjectResultStatus,
} from "@/types/academics/assessment-engine";
import {
  SUBJECT_RESULT_STATUSES,
  subjectResultComponentSnapshotSchema,
} from "@/models/academics/assessment-engine-schemas";

export interface ISubjectResult {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  assessmentPlanId: Types.ObjectId;
  gradingPolicyId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  gradeId: Types.ObjectId;
  subjectId: Types.ObjectId;
  studentId: Types.ObjectId;
  teacherId: Types.ObjectId;
  components: SubjectResultComponentSnapshot[];
  finalScore: number;
  roundedFinalScore: number;
  gradeLabel: string;
  gradePoint?: number | null;
  descriptor?: string | null;
  isPassed: boolean;
  subjectPosition?: number | null;
  totalStudentsForSubject?: number | null;
  subjectRemark?: string | null;
  missingRequiredItems: string[];
  sourceAssessmentItemIds: Types.ObjectId[];
  calculationSnapshot?: Record<string, unknown>;
  status: SubjectResultStatus;
  submittedBy?: Types.ObjectId | null;
  submittedAt?: Date | null;
  returnedBy?: Types.ObjectId | null;
  returnedAt?: Date | null;
  returnReason?: string | null;
  approvedBy?: Types.ObjectId | null;
  approvedAt?: Date | null;
  lockedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const subjectResultSchema = new Schema<ISubjectResult>(
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
    assessmentPlanId: {
      type: Schema.Types.ObjectId,
      ref: "AssessmentPlan",
      required: true,
      index: true,
    },
    gradingPolicyId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicGradingPolicy",
      required: true,
      index: true,
    },
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
      index: true,
    },
    gradeId: {
      type: Schema.Types.ObjectId,
      ref: "Grade",
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
    components: {
      type: [subjectResultComponentSnapshotSchema],
      default: [],
    },
    finalScore: { type: Number, required: true, default: 0 },
    roundedFinalScore: { type: Number, required: true, default: 0 },
    gradeLabel: { type: String, required: true, default: "", trim: true },
    gradePoint: { type: Number, default: null },
    descriptor: { type: String, default: null },
    isPassed: { type: Boolean, required: true, default: false },
    subjectPosition: { type: Number, default: null, min: 1 },
    totalStudentsForSubject: { type: Number, default: null, min: 0 },
    subjectRemark: { type: String, default: null, maxlength: 2000 },
    missingRequiredItems: { type: [String], default: [] },
    sourceAssessmentItemIds: {
      type: [Schema.Types.ObjectId],
      ref: "AssessmentItem",
      default: [],
    },
    calculationSnapshot: { type: Schema.Types.Mixed, default: undefined },
    status: {
      type: String,
      enum: [...SUBJECT_RESULT_STATUSES],
      required: true,
      default: "draft",
      index: true,
    },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    submittedAt: { type: Date, default: null },
    returnedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    returnedAt: { type: Date, default: null },
    returnReason: { type: String, default: null, maxlength: 2000 },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    lockedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

subjectResultSchema.index(
  {
    schoolId: 1,
    academicPeriodId: 1,
    classGroupId: 1,
    subjectId: 1,
    studentId: 1,
  },
  { unique: true, name: "ae_subject_result_unique_student_subject_period" }
);

subjectResultSchema.index(
  { schoolId: 1, academicPeriodId: 1, status: 1 },
  { name: "ae_subject_result_by_school_period_status" }
);

subjectResultSchema.index(
  {
    schoolId: 1,
    classGroupId: 1,
    subjectId: 1,
    academicPeriodId: 1,
    status: 1,
  },
  { name: "ae_subject_result_by_class_subject_period_status" }
);

export const SubjectResult: Model<ISubjectResult> =
  (models.SubjectResult as Model<ISubjectResult>) ||
  model<ISubjectResult>("SubjectResult", subjectResultSchema);
