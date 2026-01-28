// src/models/Vendor.ts
// Vendors/Suppliers for expense tracking

import { Schema, model, models, Types } from "mongoose";

export interface IVendor {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  taxId?: string | null; // TIN or VAT number
  bankDetails?: {
    bankName?: string | null;
    accountNumber?: string | null;
    accountName?: string | null;
  } | null;
  notes?: string | null;
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const vendorSchema = new Schema<IVendor>(
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
      maxlength: 200,
    },
    phone: {
      type: String,
      default: null,
      trim: true,
      maxlength: 20,
    },
    email: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
      maxlength: 100,
    },
    address: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },
    contactPerson: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },
    taxId: {
      type: String,
      default: null,
      trim: true,
      maxlength: 50,
    },
    bankDetails: {
      bankName: { type: String, default: null, trim: true, maxlength: 100 },
      accountNumber: { type: String, default: null, trim: true, maxlength: 50 },
      accountName: { type: String, default: null, trim: true, maxlength: 100 },
    },
    notes: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
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
vendorSchema.index({ schoolId: 1, name: 1 }, { unique: true });
vendorSchema.index({ schoolId: 1, isActive: 1 });
vendorSchema.index({ schoolId: 1, name: "text" });

export const Vendor = models.Vendor || model<IVendor>("Vendor", vendorSchema);
