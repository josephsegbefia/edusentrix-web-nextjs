// src/models/Grade.ts
import { Schema, model, models, Types, type Model } from "mongoose";

export interface IGrade {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  name: string; // e.g. "JHS 1"
  code?: string | null;
  stage?: string;
  order?: number; // sort order within the school
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const gradeSchema = new Schema<IGrade>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, default: null },
    stage: {
      type: String,
      default: "Basic",
    },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Unique grade name per school (case-insensitive)
gradeSchema.index(
  { schoolId: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

export const Grade: Model<IGrade> =
  (models.Grade as Model<IGrade>) || model<IGrade>("Grade", gradeSchema);
