import { Schema, model, models, Types, type Model } from "mongoose";

export interface ISupplyProgramLine {
  _id: Types.ObjectId;
  programId: Types.ObjectId;
  storeProductId: Types.ObjectId;
  /** Optional — e.g. textbook tied to Mathematics */
  subjectId?: Types.ObjectId | null;
  required: boolean;
  /** Expected units per student (e.g. 2 exercise books) */
  quantity: number;
  sortOrder: number;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const supplyProgramLineSchema = new Schema<ISupplyProgramLine>(
  {
    programId: {
      type: Schema.Types.ObjectId,
      ref: "SupplyProgram",
      required: true,
      index: true,
    },
    storeProductId: {
      type: Schema.Types.ObjectId,
      ref: "StoreProduct",
      required: true,
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      default: null,
      index: true,
    },
    required: { type: Boolean, default: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    sortOrder: { type: Number, default: 0 },
    notes: { type: String, default: null },
  },
  { timestamps: true }
);

supplyProgramLineSchema.index({ programId: 1, sortOrder: 1 });

export const SupplyProgramLine: Model<ISupplyProgramLine> =
  (models.SupplyProgramLine as Model<ISupplyProgramLine>) ||
  model<ISupplyProgramLine>("SupplyProgramLine", supplyProgramLineSchema);
