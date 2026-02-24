// src/models/GradingScale.ts
import { Schema, model, models, Types, type Model } from "mongoose";

export interface IGradeMapping {
  minPercentage: number;
  maxPercentage: number;
  letter: string;
  point: number;
  description?: string | null;
}

export interface IGradingScale {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  name: string;
  isDefault: boolean;
  gradeMappings: IGradeMapping[];
  caWeight: number;
  examWeight: number;
  passThreshold: number;
  performanceTiers?: {
    top: number;
    aboveAverage: number;
    average: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const gradeMappingSchema = new Schema<IGradeMapping>(
  {
    minPercentage: { type: Number, required: true },
    maxPercentage: { type: Number, required: true },
    letter: { type: String, required: true },
    point: { type: Number, required: true },
    description: { type: String, default: null },
  },
  { _id: false }
);

const gradingScaleSchema = new Schema<IGradingScale>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    gradeMappings: { type: [gradeMappingSchema], default: [] },
    caWeight: { type: Number, default: 0.3 },
    examWeight: { type: Number, default: 0.7 },
    passThreshold: { type: Number, default: 50 },
    performanceTiers: {
      top: { type: Number, default: 80 },
      aboveAverage: { type: Number, default: 65 },
      average: { type: Number, default: 50 },
    },
  },
  { timestamps: true }
);

gradingScaleSchema.index(
  { schoolId: 1, name: 1 },
  { unique: true, name: "unique_scale_per_school" }
);

gradingScaleSchema.index(
  { schoolId: 1, isDefault: 1 },
  { name: "by_school_default" }
);

export const GradingScale: Model<IGradingScale> =
  (models.GradingScale as Model<IGradingScale>) ||
  model<IGradingScale>("GradingScale", gradingScaleSchema);
