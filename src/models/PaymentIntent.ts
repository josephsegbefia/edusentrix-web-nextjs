// src/models/PaymentIntent.ts
import { Schema, model, models, Types } from "mongoose";

export interface IPaymentIntent {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  invoiceId: Types.ObjectId; // Which invoice this payment is for

  // Intent details
  amountMinor: number; // Intended payment amount (pesewas)
  proposedAllocations?: Array<{
    invoiceLineItemId: Types.ObjectId;
    amountMinor: number;
  }>; // Proposed allocation (can be adjusted on completion)

  // Status tracking
  status: "initiated" | "awaiting_webhook" | "succeeded" | "failed" | "cancelled" | "expired";

  // Gateway integration
  paymentMethod: "cash" | "bank_transfer" | "mobile_money" | "paystack" | "cheque" | "other";
  paystackReference?: string | null; // Paystack reference for this intent
  idempotencyKey: string; // Unique key to prevent duplicate processing

  // Metadata
  initiatedBy?: Types.ObjectId | null; // User who initiated (parent/admin)
  initiatedAt: Date;
  expiresAt?: Date | null; // For gateway payments

  // Result
  paymentId?: Types.ObjectId | null; // Links to Payment when succeeded
  failureReason?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

const paymentIntentSchema = new Schema<IPaymentIntent>(
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
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      index: true,
    },
    amountMinor: { type: Number, required: true },
    proposedAllocations: [
      {
        invoiceLineItemId: { type: Schema.Types.ObjectId, ref: "InvoiceLineItem" },
        amountMinor: { type: Number },
      },
    ],
    status: {
      type: String,
      enum: ["initiated", "awaiting_webhook", "succeeded", "failed", "cancelled", "expired"],
      default: "initiated",
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "mobile_money", "paystack", "cheque", "other"],
      required: true,
    },
    paystackReference: { type: String, default: null, trim: true },
    idempotencyKey: { type: String, required: true, unique: true },
    initiatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    initiatedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, default: null },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", default: null },
    failureReason: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

// Indexes
paymentIntentSchema.index({ schoolId: 1, invoiceId: 1 });
paymentIntentSchema.index({ idempotencyKey: 1 }, { unique: true });
paymentIntentSchema.index({ paystackReference: 1 });
paymentIntentSchema.index({ status: 1, expiresAt: 1 }); // For cleanup

export const PaymentIntent =
  models.PaymentIntent || model<IPaymentIntent>("PaymentIntent", paymentIntentSchema);
