import { Schema, model, models, type Model, type Types } from "mongoose";

export type SchemeItemStatus =
  | "not_started"
  | "in_progress"
  | "covered"
  | "skipped"
  | "moved"
  | "needs_review"
  | "draft"
  | "ready"
  | "dropped";

/** Planned-vs-taught coverage for a scheme row (see curriculum spec §10.5). */
export type SchemeItemCoverageStatus =
  | "not_started"
  | "in_progress"
  | "covered"
  | "skipped"
  | "moved"
  | "needs_review";

export interface ISchemeItem {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  schemeId: Types.ObjectId;
  weekNumber?: number | null;
  lessonOrder?: number | null;
  sequence: number;
  topic?: string | null;
  subtopic?: string | null;
  title?: string | null;
  strand?: string | null;
  subStrand?: string | null;
  contentStandard?: string | null;
  indicator?: string | null;
  learningObjectives?: string[];
  learningObjective?: string | null;
  coreCompetencies?: string[];
  teachingResources?: string[];
  teachingLearningActivities?: string | null;
  assessmentIdeas?: string[];
  notes?: string | null;
  rowType?: "teaching" | "revision" | "examination" | "holiday" | "other";
  sourceRowIndex?: number | null;
  parseConfidence?: number | null;
  weekEndingLabel?: string | null;
  curriculumNodeIds: Types.ObjectId[];
  plannedStartDate?: Date | null;
  plannedEndDate?: Date | null;
  suggestedLessonTemplateType?: string | null;
  suggestedDurationMinutes?: number | null;
  status: SchemeItemStatus;
  /** Defaults to `not_started` when missing on legacy documents. */
  coverageStatus?: SchemeItemCoverageStatus;
  coverageNote?: string | null;
  coverageUpdatedByUserId?: Types.ObjectId | null;
  coverageUpdatedAt?: Date | null;
  createdByUserId: Types.ObjectId;
  updatedByUserId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const schemeItemSchema = new Schema<ISchemeItem>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    schemeId: { type: Schema.Types.ObjectId, ref: "SchemeOfWork", required: true, index: true },
    weekNumber: { type: Number, min: 1, max: 53, default: null },
    lessonOrder: { type: Number, min: 1, default: null },
    sequence: { type: Number, min: 0, default: 0 },
    topic: { type: String, trim: true, maxlength: 260, default: null },
    subtopic: { type: String, trim: true, maxlength: 260, default: null },
    title: { type: String, trim: true, maxlength: 260, default: null },
    strand: { type: String, trim: true, maxlength: 260, default: null },
    subStrand: { type: String, trim: true, maxlength: 260, default: null },
    contentStandard: { type: String, trim: true, maxlength: 600, default: null },
    indicator: { type: String, trim: true, maxlength: 600, default: null },
    learningObjectives: [{ type: String, trim: true, maxlength: 1000 }],
    learningObjective: { type: String, trim: true, maxlength: 5000, default: null },
    coreCompetencies: [{ type: String, trim: true, maxlength: 500 }],
    teachingResources: [{ type: String, trim: true, maxlength: 500 }],
    teachingLearningActivities: { type: String, trim: true, maxlength: 8000, default: null },
    assessmentIdeas: [{ type: String, trim: true, maxlength: 1000 }],
    notes: { type: String, trim: true, maxlength: 5000, default: null },
    rowType: {
      type: String,
      enum: ["teaching", "revision", "examination", "holiday", "other"],
      default: "teaching",
      index: true,
    },
    sourceRowIndex: { type: Number, min: 0, default: null },
    parseConfidence: { type: Number, min: 0, max: 1, default: null },
    weekEndingLabel: { type: String, trim: true, maxlength: 120, default: null },
    curriculumNodeIds: [{ type: Schema.Types.ObjectId, ref: "CurriculumNode" }],
    plannedStartDate: { type: Date, default: null, index: true },
    plannedEndDate: { type: Date, default: null, index: true },
    suggestedLessonTemplateType: { type: String, trim: true, maxlength: 120, default: null },
    suggestedDurationMinutes: { type: Number, min: 10, max: 360, default: null },
    status: {
      type: String,
      enum: [
        "not_started",
        "in_progress",
        "covered",
        "skipped",
        "moved",
        "needs_review",
        "draft",
        "ready",
        "dropped",
      ],
      default: "not_started",
    },
    coverageStatus: {
      type: String,
      enum: [
        "not_started",
        "in_progress",
        "covered",
        "skipped",
        "moved",
        "needs_review",
      ],
      default: "not_started",
      index: true,
    },
    coverageNote: { type: String, trim: true, maxlength: 2000, default: null },
    coverageUpdatedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    coverageUpdatedAt: { type: Date, default: null },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

schemeItemSchema.index({ schoolId: 1, schemeId: 1, weekNumber: 1, sequence: 1 });

export const SchemeItem: Model<ISchemeItem> =
  (models.SchemeItem as Model<ISchemeItem>) || model<ISchemeItem>("SchemeItem", schemeItemSchema);
