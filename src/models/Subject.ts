import { Schema, model, models, Types, type Model } from "mongoose";

export type SubjectCategory =
  | "core"
  | "elective"
  | "foundation"
  | "optional"
  | "learning_area"
  | "co_curricular"
  | "custom"
  | "transdisciplinary_theme"
  | "subject_group";

export interface ISubject {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  name: string;
  normalizedKey: string;
  code?: string | null;
  category?: SubjectCategory | null;
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
    normalizedKey: { type: String, required: true, trim: true, lowercase: true },
    code: { type: String, default: null },
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
      default: null,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

function normalizeSubjectKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

subjectSchema.pre("validate", function (next) {
  if (!this.normalizedKey && this.name) {
    this.normalizedKey = normalizeSubjectKey(this.name);
  }
  next();
});

// Avoid duplicates by name per school (case-insensitive)
subjectSchema.index(
  { schoolId: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);
subjectSchema.index(
  { schoolId: 1, normalizedKey: 1 },
  { unique: true, partialFilterExpression: { normalizedKey: { $type: "string" } } }
);

export const Subject: Model<ISubject> =
  (models.Subject as Model<ISubject>) ||
  model<ISubject>("Subject", subjectSchema);
