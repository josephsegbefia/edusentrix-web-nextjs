import { Schema, model, models, Types } from "mongoose";

export interface ISubject {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  name: string;
  code?: string | null;
  isActive: boolean;
  /** Demo tenant ID - only set for demo environment data */
  demoTenantId?: string | null;
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
    // Demo tenant ID for demo environment isolation
    demoTenantId: { type: String, default: null, index: true, sparse: true },
  },
  { timestamps: true }
);

// Avoid duplicates by name per school (case-insensitive)
subjectSchema.index(
  { schoolId: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

export const Subject =
  models.Subject || model<ISubject>("Subject", subjectSchema);
