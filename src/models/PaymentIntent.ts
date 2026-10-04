// src/models/PaymentIntent.ts
import { Schema, model, models, Types } from "mongoose";

/**
 * `processing` is legacy: older webhook code wrote it as a lock without a
 * transaction. It is kept valid so historical records load and can be
 * repaired; new code must not write it.
 * `reconciliation_required` means the provider confirmed the charge but the
 * payment could not be posted (e.g. the invoice no longer exists, or the
 * charged amount/currency/reference does not match this intent). Money may
 * have moved, so it must never be treated as failed.
 */
export const PAYMENT_INTENT_STATUSES = [
  "initiated",
  "awaiting_webhook",
  "processing",
  "reconciliation_required",
  "succeeded",
  "failed",
  "cancelled",
  "expired",
] as const;

export type PaymentIntentStatus = (typeof PAYMENT_INTENT_STATUSES)[number];

export interface IPaymentIntent {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  invoiceId: Types.ObjectId; // Which invoice this payment is for

  // Intent details
  amountMinor: number; // Intended payment amount (pesewas)
  platformFeeMinor?: number;
  processorFeeMinor?: number;
  netSchoolAmountMinor?: number;
  parentPayableMinor?: number;
  payerMode?: "payer_pays" | "school_absorbs" | "waived";
  proposedAllocations?: Array<{
    invoiceLineItemId: Types.ObjectId;
    amountMinor: number;
  }>; // Proposed allocation (can be adjusted on completion)

  // Status tracking
  status: PaymentIntentStatus;

  // Gateway integration
  paymentMethod: "cash" | "bank_transfer" | "mobile_money" | "paystack" | "cheque" | "other";
  paystackReference?: string | null; // Paystack reference for this intent
  currency?: string; // ISO currency the provider charge was initialized in
  idempotencyKey: string; // Unique key to prevent duplicate processing

  // Metadata
  initiatedBy?: Types.ObjectId | null; // User who initiated (parent/admin)
  initiatedAt: Date;
  expiresAt?: Date | null; // For gateway payments

  // Result
  paymentId?: Types.ObjectId | null; // Links to Payment when succeeded
  failureReason?: string | null;

  // Posting / reconciliation tracking
  reconciliationReason?: string | null;
  reconciliationDetails?: Record<string, unknown> | null;
  reconciliationRequiredAt?: Date | null;
  lastPostingError?: string | null;
  lastPostingAttemptAt?: Date | null;
  postingAttempts?: number;

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
    platformFeeMinor: { type: Number, default: 0 },
    processorFeeMinor: { type: Number, default: 0 },
    netSchoolAmountMinor: { type: Number, default: 0 },
    parentPayableMinor: { type: Number, default: 0 },
    payerMode: {
      type: String,
      enum: ["payer_pays", "school_absorbs", "waived"],
      default: "school_absorbs",
    },
    proposedAllocations: [
      {
        invoiceLineItemId: { type: Schema.Types.ObjectId, ref: "InvoiceLineItem" },
        amountMinor: { type: Number },
      },
    ],
    status: {
      type: String,
      enum: PAYMENT_INTENT_STATUSES,
      default: "initiated",
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "mobile_money", "paystack", "cheque", "other"],
      required: true,
    },
    paystackReference: { type: String, default: null, trim: true },
    currency: { type: String, default: "GHS", uppercase: true, trim: true },
    idempotencyKey: { type: String, required: true },
    initiatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    initiatedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, default: null },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", default: null },
    failureReason: { type: String, default: null, trim: true },
    reconciliationReason: { type: String, default: null, trim: true },
    reconciliationDetails: { type: Schema.Types.Mixed, default: null },
    reconciliationRequiredAt: { type: Date, default: null },
    lastPostingError: { type: String, default: null, trim: true },
    lastPostingAttemptAt: { type: Date, default: null },
    postingAttempts: { type: Number, default: 0 },
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
