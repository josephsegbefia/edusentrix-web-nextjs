// src/models/ExpenseCategory.ts
// Categories for organizing school expenses

import { Schema, model, models, Types } from "mongoose";

export interface IExpenseCategory {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  name: string;
  code?: string | null;
  parentId?: Types.ObjectId | null; // For subcategories
  description?: string | null;
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const expenseCategorySchema = new Schema<IExpenseCategory>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    code: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "ExpenseCategory",
      default: null,
    },
    description: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes
expenseCategorySchema.index({ schoolId: 1, name: 1 }, { unique: true });
expenseCategorySchema.index({ schoolId: 1, isActive: 1 });
expenseCategorySchema.index({ schoolId: 1, parentId: 1 });

// Default categories for seeding
export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Utilities", code: "UTIL", description: "Electricity, water, gas bills" },
  { name: "Repairs & Maintenance", code: "MAINT", description: "Building and equipment repairs" },
  { name: "Fuel & Transport", code: "FUEL", description: "Vehicle fuel and transport costs" },
  { name: "Stationery & Printing", code: "STAT", description: "Office supplies and printing" },
  { name: "ICT & Internet", code: "ICT", description: "Internet, software, IT equipment" },
  { name: "Events & Functions", code: "EVNT", description: "School events and ceremonies" },
  { name: "Staff Welfare", code: "STAF", description: "Staff refreshments and welfare" },
  { name: "Cleaning & Sanitation", code: "CLEAN", description: "Cleaning supplies and services" },
  { name: "Security", code: "SEC", description: "Security services and equipment" },
  { name: "Miscellaneous", code: "MISC", description: "Other uncategorized expenses" },
];

export const ExpenseCategory =
  models.ExpenseCategory ||
  model<IExpenseCategory>("ExpenseCategory", expenseCategorySchema);
