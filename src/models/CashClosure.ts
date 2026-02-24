// src/models/CashClosure.ts
import { Schema, model, models, Types } from "mongoose";

export interface ICashClosure {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  closureDate: string; // YYYY-MM-DD (school local date)
  expectedCashMinor: number;
  recordedCashMinor: number;
  varianceMinor: number;
  varianceResolved: boolean;
  varianceResolutionNote?: string | null;
  closedBy?: Types.ObjectId | null;
  status: "closed";
  createdAt: Date;
  updatedAt: Date;
}

const cashClosureSchema = new Schema<ICashClosure>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    closureDate: { type: String, required: true, index: true },
    expectedCashMinor: { type: Number, required: true, default: 0 },
    recordedCashMinor: { type: Number, required: true, default: 0 },
    varianceMinor: { type: Number, required: true, default: 0 },
    varianceResolved: { type: Boolean, required: true, default: false },
    varianceResolutionNote: { type: String, default: null, trim: true },
    closedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    status: {
      type: String,
      enum: ["closed"],
      required: true,
      default: "closed",
      index: true,
    },
  },
  { timestamps: true }
);

cashClosureSchema.index({ schoolId: 1, closureDate: 1 }, { unique: true });
cashClosureSchema.index({ schoolId: 1, createdAt: -1 });

export const CashClosure =
  models.CashClosure || model<ICashClosure>("CashClosure", cashClosureSchema);
