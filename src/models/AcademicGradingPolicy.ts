import { Schema, model, models, Types, type Model } from "mongoose";
import type { GradeBoundary, ScoreComponent } from "@/types/academics/assessment-engine";
import type {
  GradeLabelMode,
  GradingPolicyStatus,
  RoundingRule,
} from "@/types/academics/assessment-engine";
import {
  GRADE_LABEL_MODES,
  GRADING_POLICY_STATUSES,
  ROUNDING_RULES,
  gradeBoundarySchema,
  scoreComponentSchema,
} from "@/models/academics/assessment-engine-schemas";

export interface IAcademicGradingPolicy {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  name: string;
  description?: string | null;
  curriculumCode?: string | null;
  gradeLabelMode: GradeLabelMode;
  appliesToGradeIds: Types.ObjectId[];
  appliesToGradeBandCodes: string[];
  isDefault: boolean;
  status: GradingPolicyStatus;
  scoreComponents: ScoreComponent[];
  gradeBoundaries: GradeBoundary[];
  passMark: number;
  roundingRule: RoundingRule;
  showClassPosition: boolean;
  showSubjectPosition: boolean;
  showGradeKey: boolean;
  allowTeacherContributionSelection: boolean;
  requireAdminApprovalForPolicyChanges: boolean;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const academicGradingPolicySchema = new Schema<IAcademicGradingPolicy>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: null, maxlength: 2000 },
    curriculumCode: { type: String, default: null, trim: true, index: true },
    gradeLabelMode: {
      type: String,
      enum: [...GRADE_LABEL_MODES],
      required: true,
      default: "letters",
    },
    appliesToGradeIds: {
      type: [Schema.Types.ObjectId],
      ref: "Grade",
      default: [],
    },
    appliesToGradeBandCodes: { type: [String], default: [] },
    isDefault: { type: Boolean, default: false },
    status: {
      type: String,
      enum: [...GRADING_POLICY_STATUSES],
      required: true,
      default: "draft",
      index: true,
    },
    scoreComponents: { type: [scoreComponentSchema], default: [] },
    gradeBoundaries: { type: [gradeBoundarySchema], default: [] },
    passMark: { type: Number, required: true, default: 50, min: 0, max: 100 },
    roundingRule: {
      type: String,
      enum: [...ROUNDING_RULES],
      required: true,
      default: "one_decimal",
    },
    showClassPosition: { type: Boolean, default: true },
    showSubjectPosition: { type: Boolean, default: false },
    showGradeKey: { type: Boolean, default: true },
    allowTeacherContributionSelection: { type: Boolean, default: true },
    requireAdminApprovalForPolicyChanges: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

academicGradingPolicySchema.index(
  { schoolId: 1, name: 1 },
  { unique: true, name: "ae_grading_policy_unique_name_per_school" }
);

academicGradingPolicySchema.index(
  { schoolId: 1, status: 1 },
  { name: "ae_grading_policy_by_school_status" }
);

academicGradingPolicySchema.index(
  { schoolId: 1, curriculumCode: 1, isDefault: 1 },
  { name: "ae_grading_policy_by_school_curriculum_default" }
);

export const AcademicGradingPolicy: Model<IAcademicGradingPolicy> =
  (models.AcademicGradingPolicy as Model<IAcademicGradingPolicy>) ||
  model<IAcademicGradingPolicy>(
    "AcademicGradingPolicy",
    academicGradingPolicySchema
  );
