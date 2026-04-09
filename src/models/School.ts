import { Schema, model, models, Types, type Model } from "mongoose";
import type { CurriculumCode } from "@/constants/curriculum-profiles";

export type SchoolType = "Basic" | "SHS";

export interface ISchool {
  _id: Types.ObjectId;
  name: string;
  logo?: string;
  type: SchoolType;
  curriculumCode: CurriculumCode;
  pendingCurriculumCode?: CurriculumCode | null;
  pendingCurriculumEffective?: string | null;
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
    paymentSetup?: {
      status?:
        | "not_started"
        | "awaiting_billing_owner"
        | "details_submitted"
        | "pending_provisioning"
        | "review_required"
        | "provisioned"
        | "failed";
      ownerUserId?: Types.ObjectId | null;
      ownerName?: string | null;
      ownerEmail?: string | null;
      ownerAssignedAt?: Date | null;
      ownerAssignedBy?: Types.ObjectId | null;
      delegateUserId?: Types.ObjectId | null;
      delegateName?: string | null;
      delegateEmail?: string | null;
      delegateAssignedAt?: Date | null;
      delegateAssignedBy?: Types.ObjectId | null;
      submittedAt?: Date | null;
      submittedBy?: Types.ObjectId | null;
      approvedAt?: Date | null;
      approvedBy?: Types.ObjectId | null;
      approvedByEmail?: string | null;
      reviewReason?: string | null;
      lastUpdatedAt?: Date | null;
      lastUpdatedBy?: Types.ObjectId | null;
    };
    paystack?: {
      subaccountCode?: string | null;
      subaccountId?: string | null;
      lastError?: string | null;
    };
    transactionFees?: {
      mode?: "platform_default" | "custom" | "disabled";
      percent?: number | null;
      capMinor?: number | null;
      notes?: string | null;
      updatedAt?: Date | null;
      updatedBy?: Types.ObjectId | null;
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
      paymentSetup: {
        status: {
          type: String,
          enum: [
            "not_started",
            "awaiting_billing_owner",
            "details_submitted",
            "pending_provisioning",
            "review_required",
            "provisioned",
            "failed",
          ],
          default: "not_started",
        },
        ownerUserId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        ownerName: { type: String, default: null, trim: true },
        ownerEmail: { type: String, default: null, trim: true, lowercase: true },
        ownerAssignedAt: { type: Date, default: null },
        ownerAssignedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        delegateUserId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        delegateName: { type: String, default: null, trim: true },
        delegateEmail: { type: String, default: null, trim: true, lowercase: true },
        delegateAssignedAt: { type: Date, default: null },
        delegateAssignedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        submittedAt: { type: Date, default: null },
        submittedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        approvedAt: { type: Date, default: null },
        approvedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        approvedByEmail: { type: String, default: null, trim: true, lowercase: true },
        reviewReason: { type: String, default: null, trim: true },
        lastUpdatedAt: { type: Date, default: null },
        lastUpdatedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
      },
      paystack: {
        subaccountCode: { type: String, default: null },
        subaccountId: { type: String, default: null },
        lastError: { type: String, default: null },
      },
      transactionFees: {
        mode: {
          type: String,
          enum: ["platform_default", "custom", "disabled"],
          default: "platform_default",
        },
        percent: { type: Number, default: null },
        capMinor: { type: Number, default: null },
        notes: { type: String, default: null, trim: true },
        updatedAt: { type: Date, default: null },
        updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      },
    },
  },
  { timestamps: true }
);

schoolSchema.index({ name: 1, type: 1 });

export const School: Model<ISchool> =
  (models.School as Model<ISchool>) ||
  model<ISchool>("School", schoolSchema);
