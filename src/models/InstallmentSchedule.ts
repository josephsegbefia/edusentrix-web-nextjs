// src/models/InstallmentSchedule.ts
import { Schema, model, models, Types } from "mongoose";
import { calculateInstallmentAmounts } from "@/lib/fees/money";

export interface IInstallmentSchedule {
  _id: Types.ObjectId;
  invoiceLineItemId: Types.ObjectId;

  installmentNumber: number; // 1, 2, 3, etc.
  dueDate: Date;
  amountMinor: number; // Amount for this installment (pesewas)
  amountPaidMinor: number; // How much has been paid toward this installment (pesewas)
  amountOutstandingMinor: number; // amountMinor - amountPaidMinor

  status: "pending" | "partially_paid" | "paid" | "overdue";

  // Reminder tracking
  reminderSentAt?: Date | null;
  overdueNotifiedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const installmentScheduleSchema = new Schema<IInstallmentSchedule>(
  {
    invoiceLineItemId: {
      type: Schema.Types.ObjectId,
      ref: "InvoiceLineItem",
      required: true,
      index: true,
    },
    installmentNumber: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    amountMinor: { type: Number, required: true },
    amountPaidMinor: { type: Number, required: true, default: 0 },
    amountOutstandingMinor: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "partially_paid", "paid", "overdue"],
      default: "pending",
      required: true,
    },
    reminderSentAt: { type: Date, default: null },
    overdueNotifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Unique constraint: one schedule per line item per installment number
installmentScheduleSchema.index(
  { invoiceLineItemId: 1, installmentNumber: 1 },
  { unique: true }
);

// Indexes for queries
installmentScheduleSchema.index({ dueDate: 1 }); // For "due this week" queries
installmentScheduleSchema.index({ status: 1, dueDate: 1 }); // For overdue queries

export const InstallmentSchedule =
  models.InstallmentSchedule ||
  model<IInstallmentSchedule>("InstallmentSchedule", installmentScheduleSchema);
