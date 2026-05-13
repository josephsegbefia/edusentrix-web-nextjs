import { Schema, model, models, Types, type Model } from "mongoose";
import type { SubjectCategory } from "./Subject";

export type CurriculumCode =
  | "ghana_nacca"
  | "cambridge"
  | "ib_pyp"
  | "ib_myp"
  | "british_nc"
  | "american"
  | "montessori"
  | "custom"
  | "hybrid";

export type SubjectOfferingStage =
  | "creche"
  | "nursery"
  | "kg"
  | "lower_primary"
  | "upper_primary"
  | "jhs"
  | "shs"
  | "cambridge_primary"
  | "cambridge_lower_secondary"
  | "british_key_stage_1"
  | "british_key_stage_2"
  | "british_key_stage_3"
  | "ib_pyp"
  | "ib_myp"
  | "american_elementary"
  | "american_middle"
  | "custom";

export type SubjectOfferingGradeBand =
  | "preschool"
  | "lower_primary"
  | "upper_primary"
  | "jhs"
  | "shs"
  | "custom";

export type LessonNoteTemplateVariant =
  | "early_years_activity_plan"
  | "nacca_primary"
  | "nacca_jhs"
  | "classic"
  | "custom";

export interface ISubjectOffering {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  subjectId: Types.ObjectId;
  curriculumCode: CurriculumCode;
  curriculumId?: Types.ObjectId | null;
  subjectFamily: string;
  displayName: string;
  shortName: string;
  code: string;
  stage: SubjectOfferingStage;
  gradeBand: SubjectOfferingGradeBand;
  gradeIds: Types.ObjectId[];
  category: SubjectCategory;
  lessonNoteTemplateVariant?: LessonNoteTemplateVariant | null;
  assessmentProfileId?: Types.ObjectId | null;
  reportCardGroup?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const subjectOfferingSchema = new Schema<ISubjectOffering>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
    curriculumCode: {
      type: String,
      enum: [
        "ghana_nacca",
        "cambridge",
        "ib_pyp",
        "ib_myp",
        "british_nc",
        "american",
        "montessori",
        "custom",
        "hybrid",
      ],
      required: true,
      index: true,
    },
    curriculumId: { type: Schema.Types.ObjectId, ref: "Curriculum", default: null, index: true },
    subjectFamily: { type: String, required: true, trim: true, maxlength: 160 },
    displayName: { type: String, required: true, trim: true, maxlength: 220 },
    shortName: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 80 },
    stage: {
      type: String,
      enum: [
        "creche",
        "nursery",
        "kg",
        "lower_primary",
        "upper_primary",
        "jhs",
        "shs",
        "cambridge_primary",
        "cambridge_lower_secondary",
        "british_key_stage_1",
        "british_key_stage_2",
        "british_key_stage_3",
        "ib_pyp",
        "ib_myp",
        "american_elementary",
        "american_middle",
        "custom",
      ],
      required: true,
      index: true,
    },
    gradeBand: {
      type: String,
      enum: ["preschool", "lower_primary", "upper_primary", "jhs", "shs", "custom"],
      required: true,
      index: true,
    },
    gradeIds: [{ type: Schema.Types.ObjectId, ref: "Grade", index: true }],
    category: {
      type: String,
      enum: [
        "core",
        "elective",
        "foundation",
        "optional",
        "learning_area",
        "co_curricular",
        "custom",
        "transdisciplinary_theme",
        "subject_group",
      ],
      default: "core",
      index: true,
    },
    lessonNoteTemplateVariant: {
      type: String,
      enum: ["early_years_activity_plan", "nacca_primary", "nacca_jhs", "classic", "custom"],
      default: "classic",
    },
    assessmentProfileId: { type: Schema.Types.ObjectId, ref: "AssessmentProfile", default: null },
    reportCardGroup: { type: String, trim: true, default: null },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

subjectOfferingSchema.index(
  { schoolId: 1, curriculumCode: 1, code: 1 },
  { unique: true }
);
subjectOfferingSchema.index({ schoolId: 1, subjectId: 1 });
subjectOfferingSchema.index({ schoolId: 1, stage: 1 });
subjectOfferingSchema.index({ schoolId: 1, gradeBand: 1 });
subjectOfferingSchema.index({ schoolId: 1, gradeIds: 1 });

export const SubjectOffering: Model<ISubjectOffering> =
  (models.SubjectOffering as Model<ISubjectOffering>) ||
  model<ISubjectOffering>("SubjectOffering", subjectOfferingSchema);
