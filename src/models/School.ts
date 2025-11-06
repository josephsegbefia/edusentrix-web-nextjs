import { Schema, model, models, Types } from "mongoose";
export type SchoolType = "Basic" | "Secondary";

export interface ISchool {
  _id: Types.ObjectId;
  name: string;
  type: SchoolType;
  address?: string;
  email?: string;
  city?: string;
  region?: string;
  bank?: {
    bankName?: string;
    branchName?: string;
    sortCode?: string; // derived from Banks seed; not trusted from client
    accountName?: string;
    accountNumber?: string;
  };
  status: "pending" | "active";
  createdBy?: Types.ObjectId | null;
  onboarding?: {
    finishedAt?: Date | null;
  };
  billing?: {
    status?: "unprovisioned" | "provisioned" | "failed";
    paystack?: {
      subaccountCode?: string | null;
      subaccountId?: string | null;
      lastError?: string | null;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const schoolSchema = new Schema<ISchool>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["Basic", "Secondary"], required: true },
    address: String,
    email: String,
    city: String,
    region: String,
    bank: {
      bankName: String,
      branchName: String,
      sortCode: { type: String, match: /^\d{6}$/ }, // set on server from Banks seed
      accountName: String,
      accountNumber: String,
    },
    status: { type: String, enum: ["pending", "active"], default: "pending" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    onboarding: {
      finishedAt: { type: Date, default: null },
    },
    billing: {
      status: {
        type: String,
        enum: ["unprovisioned", "provisioned", "failed"],
        default: "unprovisioned",
      },
      paystack: {
        subaccountCode: { type: String, default: null },
        subaccountId: { type: String, default: null },
        lastError: { type: String, default: null },
      },
    },
  },
  { timestamps: true }
);

schoolSchema.index({ name: 1, type: 1 });

export const School = models.School || model<ISchool>("School", schoolSchema);
