import { Schema, model, models, Types, type Model } from "mongoose";

export interface ISubject {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  name: string;
  code?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const subjectSchema = new Schema<ISubject>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Avoid duplicates by name per school (case-insensitive)
subjectSchema.index(
  { schoolId: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

export const Subject: Model<ISubject> =
  (models.Subject as Model<ISubject>) ||
  model<ISubject>("Subject", subjectSchema);
