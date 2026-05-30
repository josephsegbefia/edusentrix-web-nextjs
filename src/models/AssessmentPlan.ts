import { Schema, model, models, Types, type Model } from "mongoose";
import type {
  AssessmentPlanStatus,
  ComponentRule,
  MinimumCompletionRule,
} from "@/types/academics/assessment-engine";
import {
  ASSESSMENT_PLAN_STATUSES,
  componentRuleSchema,
  minimumCompletionRuleSchema,
} from "@/models/academics/assessment-engine-schemas";

export interface IAssessmentPlan {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  name: string;
  academicPeriodId: Types.ObjectId;
  gradingPolicyId: Types.ObjectId;
  appliesToGradeId: Types.ObjectId;
  appliesToClassGroupIds: Types.ObjectId[];
  curriculumCode?: string | null;
  status: AssessmentPlanStatus;
  componentRules: ComponentRule[];
  teacherCanCreateReportItems: boolean;
  teacherCanMarkItemsAsReportContributing: boolean;
  allowOfflineMarks: boolean;
  allowAppAssignmentImport: boolean;
  allowCsvImport: boolean;
  minimumCompletionRules: MinimumCompletionRule[];
  createdBy?: Types.ObjectId | null;
  approvedBy?: Types.ObjectId | null;
  approvedAt?: Date | null;
  lockedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const assessmentPlanSchema = new Schema<IAssessmentPlan>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      required: true,
      index: true,
    },
    gradingPolicyId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicGradingPolicy",
      required: true,
      index: true,
    },
    appliesToGradeId: {
      type: Schema.Types.ObjectId,
      ref: "Grade",
      required: true,
      index: true,
    },
    appliesToClassGroupIds: {
      type: [Schema.Types.ObjectId],
      ref: "ClassGroup",
      default: [],
    },
    curriculumCode: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: [...ASSESSMENT_PLAN_STATUSES],
      required: true,
      default: "draft",
      index: true,
    },
    componentRules: { type: [componentRuleSchema], default: [] },
    teacherCanCreateReportItems: { type: Boolean, default: true },
    teacherCanMarkItemsAsReportContributing: { type: Boolean, default: true },
    allowOfflineMarks: { type: Boolean, default: true },
    allowAppAssignmentImport: { type: Boolean, default: true },
    allowCsvImport: { type: Boolean, default: false },
    minimumCompletionRules: {
      type: [minimumCompletionRuleSchema],
      default: [],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    lockedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

assessmentPlanSchema.index(
  { schoolId: 1, academicPeriodId: 1, status: 1 },
  { name: "ae_assessment_plan_by_school_period_status" }
);

assessmentPlanSchema.index(
  { schoolId: 1, appliesToGradeId: 1, academicPeriodId: 1 },
  { name: "ae_assessment_plan_by_school_grade_period" }
);

assessmentPlanSchema.index(
  { schoolId: 1, appliesToClassGroupIds: 1, academicPeriodId: 1, status: 1 },
  { name: "ae_assessment_plan_by_school_class_period_status" }
);

export const AssessmentPlan: Model<IAssessmentPlan> =
  (models.AssessmentPlan as Model<IAssessmentPlan>) ||
  model<IAssessmentPlan>("AssessmentPlan", assessmentPlanSchema);
