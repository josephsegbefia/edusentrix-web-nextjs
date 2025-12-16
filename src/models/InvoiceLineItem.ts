// src/models/InvoiceLineItem.ts
import { Schema, model, models, Types } from "mongoose";

export interface IInvoiceLineItem {
  _id: Types.ObjectId;
  invoiceId: Types.ObjectId; // Parent invoice
  feeStructureId?: Types.ObjectId | null; // Reference to FeeStructure (nullable if deleted)

  // Fee details
  name: string; // "Tuition Fee - Term 1"
  description?: string | null;
  amountMinor: number; // Fee amount in minor units (pesewas)

  // Ordering
  displayOrder: number; // Order of importance (1 = most important)

  // Installment configuration
  allowsInstallments: boolean;
  numberOfInstallments?: number | null; // If installments allowed

  // Payment tracking (calculated, in minor units)
  amountPaidMinor: number; // Total paid toward this line item (pesewas)
  amountOutstandingMinor: number; // amountMinor - amountPaidMinor
  isFullyPaid: boolean; // Computed field

  // Status
  status: "pending" | "partially_paid" | "paid" | "overdue";

  // Adjustment tracking
  isAdjustment: boolean; // True if this is an adjustment line item
  adjustmentType?: "waiver" | "scholarship" | "correction" | "penalty" | "other" | null;
  adjustmentReason?: string | null; // Why this adjustment was made
  adjustedBy?: Types.ObjectId | null; // User who made the adjustment

  createdAt: Date;
  updatedAt: Date;
}

const invoiceLineItemSchema = new Schema<IInvoiceLineItem>(
  {
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      index: true,
    },
    feeStructureId: {
      type: Schema.Types.ObjectId,
      ref: "FeeStructure",
      default: null,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
    amountMinor: { type: Number, required: true },
    displayOrder: { type: Number, required: true },
    allowsInstallments: { type: Boolean, default: false },
    numberOfInstallments: { type: Number, default: null },
    amountPaidMinor: { type: Number, required: true, default: 0 },
    amountOutstandingMinor: { type: Number, required: true, default: 0 },
    isFullyPaid: { type: Boolean, required: true, default: false },
    status: {
      type: String,
      enum: ["pending", "partially_paid", "paid", "overdue"],
      default: "pending",
      required: true,
    },
    isAdjustment: { type: Boolean, default: false },
    adjustmentType: {
      type: String,
      enum: ["waiver", "scholarship", "correction", "penalty", "other"],
      default: null,
    },
    adjustmentReason: { type: String, default: null, trim: true },
    adjustedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// Indexes
invoiceLineItemSchema.index({ invoiceId: 1, displayOrder: 1 });
invoiceLineItemSchema.index({ invoiceId: 1, status: 1 });
invoiceLineItemSchema.index({ invoiceId: 1, isAdjustment: 1 });

export const InvoiceLineItem =
  models.InvoiceLineItem ||
  model<IInvoiceLineItem>("InvoiceLineItem", invoiceLineItemSchema);
