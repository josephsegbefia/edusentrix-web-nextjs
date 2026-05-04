// src/models/Payment.ts
import { Schema, model, models, Types } from "mongoose";

export interface IPayment {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  invoiceId: Types.ObjectId; // Which invoice this payment is for
  paymentIntentId?: Types.ObjectId | null; // Link to PaymentIntent if applicable

  // Payment details (minor units)
  amountMinor: number; // Total payment amount (pesewas)
  platformFeeMinor?: number;
  processorFeeMinor?: number;
  netSchoolAmountMinor?: number;
  paymentDate: Date;
  paymentMethod: "cash" | "bank_transfer" | "mobile_money" | "paystack" | "cheque" | "other";

  // Payment gateway (if applicable)
  paystackReference?: string | null;
  paystackTransactionId?: string | null;
  gatewaySettlementId?: Types.ObjectId | null; // Link to GatewaySettlement
  gatewayResponse?: object | null; // Full gateway response for audit

  // Reconciliation status
  reconciliationStatus:
    | "unmatched"
    | "gateway_verified"
    | "bank_matched"
    | "fully_reconciled"
    | "needs_review";
  gatewayVerifiedAt?: Date | null;
  bankMatchedAt?: Date | null;

  // Metadata
  receivedBy?: Types.ObjectId | null; // User who recorded the payment
  idempotencyKey?: string | null;
  /** Internal reference (auto-generated): RCP-24-000001, BNK-24-000002, etc. */
  internalReference?: string | null;
  receiptNumber?: string | null; // External: manual receipt number
  externalReference?: string | null; // External: bank/MoMo reference
  notes?: string | null;
  attachments?: string[]; // Receipt images/document URLs

  // Status
  status: "pending" | "completed" | "failed" | "refunded" | "reversed";

  // Approval workflow
  approvalStatus: "not_required" | "pending" | "approved" | "rejected";
  requestedAllocations?: Array<{
    invoiceLineItemId: Types.ObjectId;
    amountMinor: number;
    installmentScheduleId?: Types.ObjectId | null;
    installmentNumber?: number | null;
    notes?: string | null;
  }>;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  reviewNotes?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
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
    paymentIntentId: {
      type: Schema.Types.ObjectId,
      ref: "PaymentIntent",
      default: null,
    },
    amountMinor: { type: Number, required: true },
    platformFeeMinor: { type: Number, required: true, default: 0 },
    processorFeeMinor: { type: Number, required: true, default: 0 },
    netSchoolAmountMinor: { type: Number, required: true, default: 0 },
    paymentDate: { type: Date, required: true, default: Date.now },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "mobile_money", "paystack", "cheque", "other"],
      required: true,
    },
    paystackReference: { type: String, default: undefined, trim: true },
    paystackTransactionId: { type: String, default: null, trim: true },
    gatewaySettlementId: {
      type: Schema.Types.ObjectId,
      ref: "GatewaySettlement",
      default: null,
    },
    gatewayResponse: { type: Schema.Types.Mixed, default: null },
    reconciliationStatus: {
      type: String,
      enum: ["unmatched", "gateway_verified", "bank_matched", "fully_reconciled", "needs_review"],
      default: "unmatched",
      required: true,
    },
    gatewayVerifiedAt: { type: Date, default: null },
    bankMatchedAt: { type: Date, default: null },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    idempotencyKey: { type: String, default: null, trim: true },
    internalReference: { type: String, default: null, trim: true },
    receiptNumber: { type: String, default: null, trim: true },
    externalReference: { type: String, default: null, trim: true },
    notes: { type: String, default: null, trim: true },
    attachments: [{ type: String }],
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded", "reversed"],
      default: "completed",
      required: true,
    },
    approvalStatus: {
      type: String,
      enum: ["not_required", "pending", "approved", "rejected"],
      default: "not_required",
      required: true,
      index: true,
    },
    requestedAllocations: [
      {
        invoiceLineItemId: {
          type: Schema.Types.ObjectId,
          ref: "InvoiceLineItem",
          required: true,
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
    ],
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewNotes: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

// Indexes
paymentSchema.index({ schoolId: 1, studentId: 1 });
paymentSchema.index({ schoolId: 1, invoiceId: 1 });
paymentSchema.index({ schoolId: 1, paymentDate: 1 });
// Sparse unique index: only unique when paystackReference is not null
// Multiple null values are allowed
paymentSchema.index(
  { paystackReference: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { paystackReference: { $ne: null } },
  }
);
paymentSchema.index(
  { schoolId: 1, idempotencyKey: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { idempotencyKey: { $exists: true, $ne: null } },
  }
);
paymentSchema.index(
  { schoolId: 1, internalReference: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      internalReference: { $exists: true, $ne: null },
    },
  }
);
paymentSchema.index(
  { schoolId: 1, receiptNumber: 1 },
  {
    sparse: true,
    partialFilterExpression: { receiptNumber: { $exists: true, $ne: null } },
  }
);
paymentSchema.index(
  { schoolId: 1, externalReference: 1 },
  {
    sparse: true,
    partialFilterExpression: {
      externalReference: { $exists: true, $ne: null },
    },
  }
);
paymentSchema.index({ reconciliationStatus: 1 });
paymentSchema.index({ gatewaySettlementId: 1 });

export const Payment =
  models.Payment || model<IPayment>("Payment", paymentSchema);
