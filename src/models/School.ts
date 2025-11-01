import { Schema, model, models, Types } from "mongoose";

export type SchoolType = "Basic" | "Secondary";

export interface ISchoolBank {
  bankName?: string;
  branchName?: string;
  // For Paystack we actually need the bank 'code' (not branch sort code);
  // We store it here but keep legacy 'sortCode' naming if your UI already uses it.
  sortCode?: string;
  accountName?: string;
  accountNumber?: string;
}

export interface ISchoolBilling {
  status: "idle" | "provisioning" | "provisioned" | "failed";
  paystack?: {
    subaccountCode?: string | null;
    subaccountId?: number | null;
    lastError?: string | null;
  };
}

export interface ISchool {
  _id: Types.ObjectId;
  name: string;
  type: SchoolType;
  address?: string;
  city?: string;
  region?: string;
  bank?: ISchoolBank;
  billing?: ISchoolBilling;
  currentPeriodId?: Types.ObjectId | null;
  status: "pending" | "active";
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const schoolSchema = new Schema<ISchool>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["Basic", "Secondary"], required: true },
    address: String,
    city: String,
    region: String,
    bank: {
      bankName: String,
      branchName: String,
      sortCode: { type: String, match: /^\d{3,6}$/ }, // Ghana bank 'code' is often 3 digits
      accountName: String,
      accountNumber: String,
    },
    billing: {
      status: {
        type: String,
        enum: ["idle", "provisioning", "provisioned", "failed"],
        default: "idle",
      },
      paystack: {
        subaccountCode: { type: String, default: null },
        subaccountId: { type: Number, default: null },
        lastError: { type: String, default: null },
      },
    },
    currentPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      default: null,
    },
    status: { type: String, enum: ["pending", "active"], default: "pending" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

schoolSchema.index({ name: 1, type: 1 });

export const School = models.School || model<ISchool>("School", schoolSchema);
