// src/models/SchoolExpense.ts
// School expenses with approval workflow and ledger integration

import { Schema, model, models, Types } from "mongoose";

// ========================
// Enums
// ========================

export type ExpenseStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "paid"
  | "cancelled";

export type ExpensePaymentMethod =
  | "cash"
  | "mobile_money"
  | "bank_transfer"
  | "cheque"
  | "card"
  | "other";

export type ExpenseCostCenter =
  | "admin"
  | "academics"
  | "maintenance"
  | "transport"
  | "ict"
  | "events"
  | "welfare"
  | "other";

// ========================
// Interfaces
// ========================

export interface IExpenseReceipt {
  url: string;
  type: "image" | "pdf";
  name?: string | null;
  uploadedAt: Date;
  uploadedBy: Types.ObjectId;
}

export interface ISchoolExpense {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;

  // Identification
  expenseNumber: string; // EXP-YYYY-00001

  // Status workflow
  status: ExpenseStatus;

  // Core details
  title: string;
  description?: string | null;
  categoryId: Types.ObjectId;
  vendorId?: Types.ObjectId | null;

  // Amount
  amountMinor: number; // Amount in minor units (pesewas)
  currency: string;

  // When the expense occurred
  expenseDate: Date;

  // Payment details (filled when marking as paid)
  paymentMethod?: ExpensePaymentMethod | null;
  paymentReference?: string | null; // Cheque number, transfer ref, etc.
  paidAt?: Date | null;
  paidBy?: Types.ObjectId | null;

  // Receipts/Evidence
  receipts: IExpenseReceipt[];

  // Costing/Reporting
  costCenter?: ExpenseCostCenter | null;
  academicPeriodId?: Types.ObjectId | null;

  // Workflow timestamps and users
  submittedAt?: Date | null;
  submittedBy?: Types.ObjectId | null;

  approvedAt?: Date | null;
  approvedBy?: Types.ObjectId | null;
  approvalNote?: string | null;

  rejectedAt?: Date | null;
  rejectedBy?: Types.ObjectId | null;
  rejectionReason?: string | null;

  cancelledAt?: Date | null;
  cancelledBy?: Types.ObjectId | null;
  cancellationReason?: string | null;

  // Audit locking
  lockedAt?: Date | null;
  lockReason?: "approved" | "paid" | null;

  // Ledger linkage
  financialTransactionId?: Types.ObjectId | null;

  // Metadata
  notes?: string | null;
  tags?: string[];
  createdBy: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

// ========================
// Schema
// ========================

const schoolExpenseSchema = new Schema<ISchoolExpense>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },

    // Identification
    expenseNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    // Status workflow
    status: {
      type: String,
      enum: ["draft", "submitted", "approved", "rejected", "paid", "cancelled"],
      default: "draft",
      required: true,
      index: true,
    },

    // Core details
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "ExpenseCategory",
      required: true,
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
      index: true,
    },

    // Amount
    amountMinor: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      default: "GHS",
      required: true,
      uppercase: true,
      trim: true,
    },

    // When the expense occurred
    expenseDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // Payment details
    paymentMethod: {
      type: String,
      enum: ["cash", "mobile_money", "bank_transfer", "cheque", "card", "other"],
      default: null,
    },
    paymentReference: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    paidBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Receipts
    receipts: [
      {
        url: { type: String, required: true },
        type: { type: String, enum: ["image", "pdf"], default: "image" },
        name: { type: String, default: null, trim: true },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
      },
    ],

    // Costing
    costCenter: {
      type: String,
      enum: ["admin", "academics", "maintenance", "transport", "ict", "events", "welfare", "other"],
      default: null,
    },
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      default: null,
    },

    // Workflow - Submission
    submittedAt: { type: Date, default: null },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },

    // Workflow - Approval
    approvedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvalNote: { type: String, default: null, trim: true, maxlength: 500 },

    // Workflow - Rejection
    rejectedAt: { type: Date, default: null },
    rejectedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    rejectionReason: { type: String, default: null, trim: true, maxlength: 500 },

    // Workflow - Cancellation
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    cancellationReason: { type: String, default: null, trim: true, maxlength: 500 },

    // Audit locking
    lockedAt: { type: Date, default: null },
    lockReason: {
      type: String,
      enum: ["approved", "paid"],
      default: null,
    },

    // Ledger linkage
    financialTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "FinancialTransaction",
      default: null,
    },

    // Metadata
    notes: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },
    tags: [{ type: String, trim: true }],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// ========================
// Indexes
// ========================

// Unique expense number per school
schoolExpenseSchema.index({ schoolId: 1, expenseNumber: 1 }, { unique: true });

// Common queries
schoolExpenseSchema.index({ schoolId: 1, status: 1, expenseDate: -1 });
schoolExpenseSchema.index({ schoolId: 1, categoryId: 1, expenseDate: -1 });
schoolExpenseSchema.index({ schoolId: 1, vendorId: 1, expenseDate: -1 });
schoolExpenseSchema.index({ schoolId: 1, expenseDate: -1 });
schoolExpenseSchema.index({ schoolId: 1, costCenter: 1, expenseDate: -1 });
schoolExpenseSchema.index({ schoolId: 1, academicPeriodId: 1 });

// Text search
schoolExpenseSchema.index({ title: "text", description: "text" });

// ========================
// Static methods
// ========================

schoolExpenseSchema.statics.generateExpenseNumber = async function (
  schoolId: Types.ObjectId
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `EXP-${year}-`;

  // Find the highest expense number for this year
  const lastExpense = await this.findOne({
    schoolId,
    expenseNumber: { $regex: `^${prefix}` },
  })
    .sort({ expenseNumber: -1 })
    .select("expenseNumber")
    .lean();

  let nextNumber = 1;
  if (lastExpense?.expenseNumber) {
    const lastNum = parseInt(lastExpense.expenseNumber.replace(prefix, ""), 10);
    if (!isNaN(lastNum)) {
      nextNumber = lastNum + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(5, "0")}`;
};

// ========================
// Instance methods
// ========================

schoolExpenseSchema.methods.isEditable = function (): boolean {
  return this.status === "draft" || this.status === "rejected";
};

schoolExpenseSchema.methods.canSubmit = function (): boolean {
  return this.status === "draft" || this.status === "rejected";
};

schoolExpenseSchema.methods.canApprove = function (): boolean {
  return this.status === "submitted";
};

schoolExpenseSchema.methods.canReject = function (): boolean {
  return this.status === "submitted";
};

schoolExpenseSchema.methods.canMarkPaid = function (): boolean {
  return this.status === "approved";
};

schoolExpenseSchema.methods.canCancel = function (): boolean {
  return ["draft", "submitted", "rejected"].includes(this.status);
};

// ========================
// Export
// ========================

export interface ISchoolExpenseModel {
  generateExpenseNumber(schoolId: Types.ObjectId): Promise<string>;
}

export const SchoolExpense =
  models.SchoolExpense ||
  model<ISchoolExpense>("SchoolExpense", schoolExpenseSchema);
