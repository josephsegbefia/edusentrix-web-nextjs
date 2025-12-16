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
  receiptNumber?: string | null; // "RCP-2024-001"
  notes?: string | null;
  attachments?: string[]; // Receipt images/document URLs

  // Status
  status: "pending" | "completed" | "failed" | "refunded" | "reversed";

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
    paymentDate: { type: Date, required: true, default: Date.now },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "mobile_money", "paystack", "cheque", "other"],
      required: true,
    },
    paystackReference: { type: String, default: null, trim: true },
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
    receiptNumber: { type: String, default: null, trim: true },
    notes: { type: String, default: null, trim: true },
    attachments: [{ type: String }],
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded", "reversed"],
      default: "completed",
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes
paymentSchema.index({ schoolId: 1, studentId: 1 });
paymentSchema.index({ schoolId: 1, invoiceId: 1 });
paymentSchema.index({ schoolId: 1, paymentDate: 1 });
paymentSchema.index({ paystackReference: 1 }, { unique: true, sparse: true });
paymentSchema.index({ reconciliationStatus: 1 });
paymentSchema.index({ gatewaySettlementId: 1 });

export const Payment =
  models.Payment || model<IPayment>("Payment", paymentSchema);
