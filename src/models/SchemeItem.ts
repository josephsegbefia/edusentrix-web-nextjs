import { Schema, model, models, type Model, type Types } from "mongoose";

export type SchemeItemStatus = "draft" | "ready" | "dropped";

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
  sequence: number;
  title: string;
  learningObjective?: string | null;
  notes?: string | null;
  curriculumNodeIds: Types.ObjectId[];
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
    sequence: { type: Number, min: 0, default: 0 },
    title: { type: String, required: true, trim: true, maxlength: 260 },
    learningObjective: { type: String, trim: true, maxlength: 5000, default: null },
    notes: { type: String, trim: true, maxlength: 5000, default: null },
    curriculumNodeIds: [{ type: Schema.Types.ObjectId, ref: "CurriculumNode" }],
    suggestedLessonTemplateType: { type: String, trim: true, maxlength: 120, default: null },
    suggestedDurationMinutes: { type: Number, min: 10, max: 360, default: null },
    status: {
      type: String,
      enum: ["draft", "ready", "dropped"],
      default: "draft",
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
