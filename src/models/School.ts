import { Schema, model, models, Types } from "mongoose";

export type SchoolType = "Basic" | "Secondary";

export interface ISchool {
  _id: Types.ObjectId;
  name: string;
  type: SchoolType;
  address?: string;
  city?: string;
  region?: string;
  bank?: {
    bankName?: string;
    branchName?: string;
    sortCode?: string; // 6 digits
    accountName?: string;
    accountNumber?: string;
  };
  status: "pending" | "active";
  createdBy?: Types.ObjectId | null; // User who created/approved
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
      sortCode: { type: String, match: /^\d{6}$/ },
      accountName: String,
      accountNumber: String,
    },
    status: { type: String, enum: ["pending", "active"], default: "pending" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

schoolSchema.index({ name: 1, type: 1 });

export const School = models.School || model<ISchool>("School", schoolSchema);
