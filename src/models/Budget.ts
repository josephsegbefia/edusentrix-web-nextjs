// src/models/Budget.ts
// Budget tracking for expense categories

import mongoose, { Schema, Document, Types, Model } from "mongoose";

// ========================
// Types
// ========================

export type BudgetPeriodType = "monthly" | "quarterly" | "termly" | "yearly";

export interface IBudgetLineItem {
  categoryId: Types.ObjectId; // Reference to ExpenseCategory
  categoryName: string; // Denormalized for display
  budgetedAmountMinor: number;
  notes?: string | null;
}

export interface IBudget extends Document {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  name: string;
  periodType: BudgetPeriodType;
  startDate: Date;
  endDate: Date;
  academicPeriodId?: Types.ObjectId | null;
  currency: string;
  totalBudgetedMinor: number;
  lineItems: IBudgetLineItem[];
  status: "draft" | "active" | "closed";
  notes?: string | null;
  createdBy: Types.ObjectId;
  approvedBy?: Types.ObjectId | null;
  approvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ========================
// Schema
// ========================

const BudgetLineItemSchema = new Schema<IBudgetLineItem>(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: "ExpenseCategory", required: true },
    categoryName: { type: String, required: true },
    budgetedAmountMinor: { type: Number, required: true, min: 0 },
    notes: { type: String, default: null },
  },
  { _id: false }
);

const BudgetSchema = new Schema<IBudget>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    periodType: {
      type: String,
      enum: ["monthly", "quarterly", "termly", "yearly"],
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    academicPeriodId: { type: Schema.Types.ObjectId, ref: "AcademicPeriod", default: null },
    currency: { type: String, default: "GHS" },
    totalBudgetedMinor: { type: Number, default: 0 },
    lineItems: { type: [BudgetLineItemSchema], default: [] },
    status: {
      type: String,
      enum: ["draft", "active", "closed"],
      default: "draft",
    },
    notes: { type: String, default: null, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ========================
// Indexes
// ========================

BudgetSchema.index({ schoolId: 1, status: 1 });
BudgetSchema.index({ schoolId: 1, startDate: 1, endDate: 1 });
BudgetSchema.index({ schoolId: 1, academicPeriodId: 1 });

// ========================
// Pre-save Hook
// ========================

BudgetSchema.pre("save", function (next) {
  // Calculate total budgeted from line items
  this.totalBudgetedMinor = this.lineItems.reduce(
    (sum, item) => sum + item.budgetedAmountMinor,
    0
  );
  next();
});

// ========================
// Model
// ========================

export const Budget: Model<IBudget> =
  mongoose.models.Budget || mongoose.model<IBudget>("Budget", BudgetSchema);
