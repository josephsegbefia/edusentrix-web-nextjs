import { Schema, model, models, Types, type Model } from "mongoose";

export interface IRubricCriterion {
  title: string;
  description?: string;
  maxScore: number;
  weight?: number;
}

export interface IRubric {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  title: string;
  description?: string;
  criteria: IRubricCriterion[];
  createdAt: Date;
  updatedAt: Date;
}

const RubricCriterionSchema = new Schema<IRubricCriterion>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    maxScore: { type: Number, required: true, min: 0 },
    weight: { type: Number, min: 0, max: 100 },
  },
  { _id: false }
);

const rubricSchema = new Schema<IRubric>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    criteria: { type: [RubricCriterionSchema], default: [] },
  },
  { timestamps: true }
);

rubricSchema.index({ schoolId: 1, teacherId: 1, createdAt: -1 });

export const Rubric: Model<IRubric> =
  (models.Rubric as Model<IRubric>) ||
  model<IRubric>("Rubric", rubricSchema);
