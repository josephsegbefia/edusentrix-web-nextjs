import { Schema, model, models, Types, type Model } from "mongoose";

export type SupplyProgramAudienceMode =
  | "whole_school"
  | "grades"
  | "class_groups"
  | "students";

export type SupplyProgramStatus = "draft" | "published" | "archived";

export interface ISupplyProgram {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  name: string;
  description?: string | null;
  /** Display label e.g. "Term 2 · 2025/26" */
  periodLabel?: string | null;
  validFrom?: Date | null;
  validTo?: Date | null;
  purchaseByDate?: Date | null;
  status: SupplyProgramStatus;
  audienceMode: SupplyProgramAudienceMode;
  /** Grade / class group / student ids depending on audienceMode; empty for whole_school */
  audienceIds: Types.ObjectId[];
  publishedAt?: Date | null;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const supplyProgramSchema = new Schema<ISupplyProgram>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    periodLabel: { type: String, default: null, trim: true },
    validFrom: { type: Date, default: null },
    validTo: { type: Date, default: null },
    purchaseByDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    audienceMode: {
      type: String,
      enum: ["whole_school", "grades", "class_groups", "students"],
      required: true,
    },
    audienceIds: [{ type: Schema.Types.ObjectId, default: [] }],
    publishedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

supplyProgramSchema.index({ schoolId: 1, status: 1, updatedAt: -1 });

export const SupplyProgram: Model<ISupplyProgram> =
  (models.SupplyProgram as Model<ISupplyProgram>) ||
  model<ISupplyProgram>("SupplyProgram", supplyProgramSchema);
