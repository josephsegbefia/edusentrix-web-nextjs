import { Schema, model, models, Types, type Model } from "mongoose";
import type {
  AssessmentEngineAssessmentType,
  AssessmentItemStatus,
  AssessmentItemVisibility,
  AssessmentSourceType,
  MissingScorePolicy,
} from "@/types/academics/assessment-engine";
import {
  ASSESSMENT_ENGINE_ASSESSMENT_TYPES,
  ASSESSMENT_ITEM_STATUSES,
  ASSESSMENT_ITEM_VISIBILITIES,
  ASSESSMENT_SOURCE_TYPES,
  MISSING_SCORE_POLICIES,
} from "@/models/academics/assessment-engine-schemas";

export interface IAssessmentItem {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  assessmentPlanId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  gradeId: Types.ObjectId;
  subjectId: Types.ObjectId;
  subjectOfferingId?: Types.ObjectId | null;
  teacherId: Types.ObjectId;
  title: string;
  description?: string | null;
  assessmentType: AssessmentEngineAssessmentType | string;
  sourceType: AssessmentSourceType;
  sourceRefType?: string | null;
  sourceRefId?: Types.ObjectId | null;
  maxScore: number;
  dateAssigned?: Date | null;
  dateDue?: Date | null;
  assessedAt?: Date | null;
  componentKey?: string | null;
  contributesToReport: boolean;
  contributionLockedByRule: boolean;
  missingPolicy?: MissingScorePolicy;
  visibility: AssessmentItemVisibility;
  status: AssessmentItemStatus;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const assessmentItemSchema = new Schema<IAssessmentItem>(
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
    subjectOfferingId: {
      type: Schema.Types.ObjectId,
      ref: "SubjectOffering",
      default: null,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, default: null, maxlength: 2000 },
    assessmentType: {
      type: String,
      enum: [...ASSESSMENT_ENGINE_ASSESSMENT_TYPES],
      required: true,
    },
    sourceType: {
      type: String,
      enum: [...ASSESSMENT_SOURCE_TYPES],
      required: true,
      default: "manual",
    },
    sourceRefType: { type: String, default: null },
    sourceRefId: { type: Schema.Types.ObjectId, default: null },
    maxScore: { type: Number, required: true, min: 0 },
    dateAssigned: { type: Date, default: null },
    dateDue: { type: Date, default: null },
    assessedAt: { type: Date, default: null },
    componentKey: { type: String, default: null, trim: true },
    contributesToReport: { type: Boolean, required: true, default: false },
    contributionLockedByRule: { type: Boolean, required: true, default: false },
    missingPolicy: {
      type: String,
      enum: [...MISSING_SCORE_POLICIES],
      default: "exclude_from_average",
    },
    visibility: {
      type: String,
      enum: [...ASSESSMENT_ITEM_VISIBILITIES],
      required: true,
      default: "teacher_only",
    },
    status: {
      type: String,
      enum: [...ASSESSMENT_ITEM_STATUSES],
      required: true,
      default: "draft",
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

assessmentItemSchema.index(
  {
    schoolId: 1,
    assessmentPlanId: 1,
    classGroupId: 1,
    subjectId: 1,
  },
  { name: "ae_assessment_item_by_plan_class_subject" }
);

assessmentItemSchema.index(
  {
    schoolId: 1,
    academicPeriodId: 1,
    classGroupId: 1,
    subjectId: 1,
    status: 1,
  },
  { name: "ae_assessment_item_by_period_class_subject_status" }
);

export const AssessmentItem: Model<IAssessmentItem> =
  (models.AssessmentItem as Model<IAssessmentItem>) ||
  model<IAssessmentItem>("AssessmentItem", assessmentItemSchema);
