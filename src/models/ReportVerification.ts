import { Schema, model, models, Types } from "mongoose";

export type ReportVerificationStatus = "issued" | "revoked";
export type ReportVerificationType = "simple_snapshot";

export interface IReportVerification {
  _id: Types.ObjectId;
  verificationId: string;
  reportType: ReportVerificationType;
  status: ReportVerificationStatus;
  schoolId: Types.ObjectId;
  schoolName: string;
  issuedBy: Types.ObjectId;
  reportLabel: string;
  range: {
    startDate: Date;
    endDate: Date;
    source: string;
    periodLabel?: string | null;
  };
  meta: {
    categories: string[];
    version: number;
  };
  issuedAt: Date;
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const reportVerificationSchema = new Schema<IReportVerification>(
  {
    verificationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    reportType: {
      type: String,
      enum: ["simple_snapshot"],
      required: true,
      default: "simple_snapshot",
    },
    status: {
      type: String,
      enum: ["issued", "revoked"],
      required: true,
      default: "issued",
      index: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    schoolName: { type: String, required: true, trim: true },
    issuedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reportLabel: { type: String, required: true, trim: true },
    range: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      source: { type: String, default: "custom" },
      periodLabel: { type: String, default: null },
    },
    meta: {
      categories: { type: [String], default: [] },
      version: { type: Number, default: 1 },
    },
    issuedAt: { type: Date, default: Date.now, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

reportVerificationSchema.index({ schoolId: 1, issuedAt: -1 });
reportVerificationSchema.index({ verificationId: 1, status: 1 });

export const ReportVerification =
  models.ReportVerification ||
  model<IReportVerification>("ReportVerification", reportVerificationSchema);

