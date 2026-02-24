// src/models/PaymentAuditEvent.ts
import { Schema, model, models, Types } from "mongoose";

export type PaymentAuditEventType =
  | "payment_recorded"
  | "payment_duplicate_detected"
  | "payment_approved"
  | "payment_rejected"
  | "payment_reversed"
  | "reconciliation_updated"
  | "cash_closure_note";

export interface IPaymentAuditEvent {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  paymentId: Types.ObjectId;
  invoiceId?: Types.ObjectId | null;
  studentId?: Types.ObjectId | null;
  eventType: PaymentAuditEventType;
  title: string;
  description?: string | null;
  actorId?: Types.ObjectId | null;
  actorName?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

const paymentAuditEventSchema = new Schema<IPaymentAuditEvent>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      index: true,
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      default: null,
      index: true,
    },
    eventType: {
      type: String,
      enum: [
        "payment_recorded",
        "payment_duplicate_detected",
        "payment_approved",
        "payment_rejected",
        "payment_reversed",
        "reconciliation_updated",
        "cash_closure_note",
      ],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorName: { type: String, default: null, trim: true },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

paymentAuditEventSchema.index({ schoolId: 1, createdAt: -1 });
paymentAuditEventSchema.index({ paymentId: 1, createdAt: -1 });

export const PaymentAuditEvent =
  models.PaymentAuditEvent ||
  model<IPaymentAuditEvent>("PaymentAuditEvent", paymentAuditEventSchema);
