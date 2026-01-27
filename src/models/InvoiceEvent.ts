// src/models/InvoiceEvent.ts
import { Schema, model, models, Types } from "mongoose";

export interface IInvoiceEvent {
  _id: Types.ObjectId;
  invoiceId: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;

  eventType:
    | "created"
    | "issued"
    | "line_item_added"
    | "line_item_adjusted"
    | "payment_recorded"
    | "allocation_updated"
    | "overdue_marked"
    | "cancelled"
    | "refunded"
    | "credit_applied"
    | "adjustment_added";

  // Event details
  description: string; // Human-readable description
  metadata?: object | null; // Additional event-specific data

  // Actor
  performedBy?: Types.ObjectId | null; // User who performed the action

  // Related entities
  relatedPaymentId?: Types.ObjectId | null;
  relatedLineItemId?: Types.ObjectId | null;
  relatedAdjustmentId?: Types.ObjectId | null;

  createdAt: Date;
}

const invoiceEventSchema = new Schema<IInvoiceEvent>(
  {
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      index: true,
    },
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
    eventType: {
      type: String,
      enum: [
        "created",
        "issued",
        "line_item_added",
        "line_item_adjusted",
        "payment_recorded",
        "allocation_updated",
        "overdue_marked",
        "cancelled",
        "refunded",
        "credit_applied",
        "adjustment_added",
      ],
      required: true,
    },
    description: { type: String, required: true, trim: true },
    metadata: { type: Schema.Types.Mixed, default: null },
    performedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    relatedPaymentId: { type: Schema.Types.ObjectId, ref: "Payment", default: null },
    relatedLineItemId: {
      type: Schema.Types.ObjectId,
      ref: "InvoiceLineItem",
      default: null,
    },
    relatedAdjustmentId: {
      type: Schema.Types.ObjectId,
      ref: "InvoiceLineItem",
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Indexes
invoiceEventSchema.index({ invoiceId: 1, createdAt: 1 });
invoiceEventSchema.index({ schoolId: 1, eventType: 1 });
invoiceEventSchema.index({ studentId: 1, createdAt: 1 });

export const InvoiceEvent =
  models.InvoiceEvent || model<IInvoiceEvent>("InvoiceEvent", invoiceEventSchema);
