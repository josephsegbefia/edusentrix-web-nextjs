import { Schema, model, models, Types, type Model } from "mongoose";
import type { CurriculumCode } from "@/constants/curriculum-profiles";

export type SchoolType = "Basic" | "SHS";

export interface ISchool {
  _id: Types.ObjectId;
  name: string;
  logo?: string;
  type: SchoolType;
  curriculumCode: CurriculumCode;
  address?: string;
  email?: string;
  city?: string;
  region?: string;
  gesSchoolCode?: string | null;
  bank?: {
    bankName?: string;
    branchName?: string;
    sortCode?: string; // derived from Banks seed; not trusted from client
    accountName?: string;
    accountNumber?: string;
  };
  status: "pending" | "active" | "deactivated";
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
    logo: { type: String, default: null },
    type: { type: String, enum: ["Basic", "SHS"], required: true },
    curriculumCode: {
      type: String,
      enum: [
        "ghana_nacca",
        "cambridge",
        "ib_pyp",
        "ib_myp",
        "british_nc",
        "american",
        "hybrid",
      ],
      default: "ghana_nacca",
    },
    pendingCurriculumCode: {
      type: String,
      enum: [
        "ghana_nacca",
        "cambridge",
        "ib_pyp",
        "ib_myp",
        "british_nc",
        "american",
        "hybrid",
      ],
      default: null,
    },
    pendingCurriculumEffective: { type: String, default: null },
    address: String,
    email: String,
    city: String,
    region: String,
    gesSchoolCode: { type: String, default: null, trim: true },
    bank: {
      bankName: String,
      branchName: String,
      sortCode: { type: String, match: /^\d{6}$/ }, // set on server from Banks seed
      accountName: String,
      accountNumber: String,
    },
    status: {
      type: String,
      enum: ["pending", "active", "deactivated"],
      default: "pending",
    },
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

export const School: Model<ISchool> =
  (models.School as Model<ISchool>) ||
  model<ISchool>("School", schoolSchema);
