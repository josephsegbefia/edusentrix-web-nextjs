// src/models/Invoice.ts
import { Schema, model, models, Types } from "mongoose";

export interface IInvoice {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  academicPeriodId: Types.ObjectId; // Links to AcademicPeriod
  invoiceNumber: string; // Unique: "INV-2024-001" or "INV-{year}-{studentId}-{term}"
  status: "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled";

  // Totals (calculated, stored in minor units)
  totalAmountMinor: number; // Sum of all line items (pesewas)
  totalPaidMinor: number; // Sum of all payments allocated (pesewas)
  totalOutstandingMinor: number; // totalAmountMinor - totalPaidMinor
  totalCreditAppliedMinor: number; // Credit applied from overpayments (pesewas)

  // Versioning (for adjustments)
  version: number; // Starts at 1, increments on adjustments
  previousVersionId?: Types.ObjectId | null; // Reference to previous version (if applicable)

  // Dates
  issueDate?: Date | null; // When invoice was issued (null if draft)
  dueDate: Date; // Payment due date
  paidDate?: Date | null; // When fully paid

  // Metadata
  notes?: string | null; // Internal notes
  terms?: string | null; // Payment terms

  /** Demo tenant ID - only set for demo environment data */
  demoTenantId?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<IInvoice>(
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
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      required: true,
      index: true,
    },
    invoiceNumber: { type: String, required: true, unique: true, trim: true },
    status: {
      type: String,
      enum: ["draft", "issued", "partially_paid", "paid", "overdue", "cancelled"],
      default: "draft",
      required: true,
      index: true,
    },
    totalAmountMinor: { type: Number, required: true, default: 0 },
    totalPaidMinor: { type: Number, required: true, default: 0 },
    totalOutstandingMinor: { type: Number, required: true, default: 0 },
    totalCreditAppliedMinor: { type: Number, required: true, default: 0 },
    version: { type: Number, required: true, default: 1 },
    previousVersionId: { type: Schema.Types.ObjectId, ref: "Invoice", default: null },
    issueDate: { type: Date, default: null },
    dueDate: { type: Date, required: true },
    paidDate: { type: Date, default: null },
    notes: { type: String, default: null, trim: true },
    terms: { type: String, default: null, trim: true },
    // Demo tenant ID for demo environment isolation
    demoTenantId: { type: String, default: null, index: true, sparse: true },
  },
  { timestamps: true }
);

// Unique constraint: one invoice per student per academic period
invoiceSchema.index({ schoolId: 1, studentId: 1, academicPeriodId: 1 }, { unique: true });

// Additional indexes
invoiceSchema.index({ schoolId: 1, status: 1 });
invoiceSchema.index({ schoolId: 1, dueDate: 1 });

export const Invoice =
  models.Invoice || model<IInvoice>("Invoice", invoiceSchema);
