// src/models/PaymentAllocation.ts
import { Schema, model, models, Types } from "mongoose";

export interface IPaymentAllocation {
  _id: Types.ObjectId;
  paymentId: Types.ObjectId; // Parent payment
  invoiceLineItemId: Types.ObjectId; // Which line item this allocation is for

  amountMinor: number; // Amount allocated to this line item (pesewas)

  // Installment tracking (if applicable)
  installmentScheduleId?: Types.ObjectId | null; // Link to InstallmentSchedule
  installmentNumber?: number | null; // Which installment this payment covers (1, 2, 3, etc.)

  // Metadata
  notes?: string | null;

  createdAt: Date;
}

const paymentAllocationSchema = new Schema<IPaymentAllocation>(
  {
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      index: true,
    },
    invoiceLineItemId: {
      type: Schema.Types.ObjectId,
      ref: "InvoiceLineItem",
      required: true,
      index: true,
    },
    amountMinor: { type: Number, required: true },
    installmentScheduleId: {
      type: Schema.Types.ObjectId,
      ref: "InstallmentSchedule",
      default: null,
    },
    installmentNumber: { type: Number, default: null },
    notes: { type: String, default: null, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Indexes
paymentAllocationSchema.index({ paymentId: 1 });
paymentAllocationSchema.index({ invoiceLineItemId: 1 });
paymentAllocationSchema.index({ installmentScheduleId: 1 });
paymentAllocationSchema.index(
  {
    paymentId: 1,
    invoiceLineItemId: 1,
    installmentScheduleId: 1,
    installmentNumber: 1,
  },
  { unique: true }
);

export const PaymentAllocation =
  models.PaymentAllocation ||
  model<IPaymentAllocation>("PaymentAllocation", paymentAllocationSchema);
