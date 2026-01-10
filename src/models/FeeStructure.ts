// src/models/FeeStructure.ts
import { Schema, model, models, Types } from "mongoose";

export interface IFeeStructure {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  name: string; // "Tuition Fee", "Library Fee", etc.
  code: string; // "TUITION", "LIBRARY", etc.
  description?: string | null;
  category: "tuition" | "library" | "sports" | "uniform" | "other";
  isActive: boolean;
  defaultAmountMinor?: number | null; // Optional default amount in minor units (pesewas)
  allowsInstallments: boolean; // Whether this fee type allows installments
  maxInstallments?: number | null; // Max number of installments allowed
  /** Demo tenant ID - only set for demo environment data */
  demoTenantId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const feeStructureSchema = new Schema<IFeeStructure>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, default: null, trim: true },
    category: {
      type: String,
      enum: ["tuition", "library", "sports", "uniform", "other"],
      required: true,
    },
    isActive: { type: Boolean, default: true },
    defaultAmountMinor: { type: Number, default: null },
    allowsInstallments: { type: Boolean, default: false },
    maxInstallments: { type: Number, default: null },
    // Demo tenant ID for demo environment isolation
    demoTenantId: { type: String, default: null, index: true, sparse: true },
  },
  { timestamps: true }
);

// Ensure code is unique per school
feeStructureSchema.index({ schoolId: 1, code: 1 }, { unique: true });

// Text search index
feeStructureSchema.index({ name: "text", code: "text", description: "text" });

export const FeeStructure =
  models.FeeStructure || model<IFeeStructure>("FeeStructure", feeStructureSchema);
