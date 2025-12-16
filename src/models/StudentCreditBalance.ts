// src/models/StudentCreditBalance.ts
import { Schema, model, models, Types } from "mongoose";

export interface ICreditEntry {
  type: "credit" | "debit" | "application";
  amountMinor: number;
  sourcePaymentId?: Types.ObjectId | null; // Payment that created credit
  appliedToInvoiceId?: Types.ObjectId | null; // Invoice where credit was applied
  appliedToLineItemId?: Types.ObjectId | null; // Line item where credit was applied
  reason: string;
  createdAt: Date;
}

export interface IStudentCreditBalance {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;

  // Credit balance (minor units)
  balanceMinor: number; // Current credit balance (pesewas)

  // Credit entries (ledger-style)
  entries: ICreditEntry[];

  createdAt: Date;
  updatedAt: Date;
}

const creditEntrySchema = new Schema<ICreditEntry>(
  {
    type: {
      type: String,
      enum: ["credit", "debit", "application"],
      required: true,
    },
    amountMinor: { type: Number, required: true },
    sourcePaymentId: { type: Schema.Types.ObjectId, ref: "Payment", default: null },
    appliedToInvoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", default: null },
    appliedToLineItemId: {
      type: Schema.Types.ObjectId,
      ref: "InvoiceLineItem",
      default: null,
    },
    reason: { type: String, required: true, trim: true },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const studentCreditBalanceSchema = new Schema<IStudentCreditBalance>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    balanceMinor: { type: Number, required: true, default: 0 },
    entries: [creditEntrySchema],
  },
  { timestamps: true }
);

// Unique constraint: one credit balance per student
studentCreditBalanceSchema.index({ schoolId: 1, studentId: 1 }, { unique: true });

export const StudentCreditBalance =
  models.StudentCreditBalance ||
  model<IStudentCreditBalance>("StudentCreditBalance", studentCreditBalanceSchema);
