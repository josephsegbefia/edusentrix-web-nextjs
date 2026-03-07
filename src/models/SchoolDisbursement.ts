import { Schema, model, models, Types, type Model } from "mongoose";

export type SchoolDisbursementRecipientType = "teacher" | "vendor";
export type SchoolDisbursementStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";
export type SchoolDisbursementRail = "manual" | "paystack";
export type SchoolDisbursementMethod = "bank" | "mobile_money";

export interface ISchoolDisbursement {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  recipientType: SchoolDisbursementRecipientType;
  teacherId?: Types.ObjectId | null;
  vendorId?: Types.ObjectId | null;
  schoolExpenseId?: Types.ObjectId | null;
  recipientName: string;
  purpose: string;
  destination: {
    method: SchoolDisbursementMethod;
    accountName: string;
    accountNumber: string;
    bankName?: string | null;
    bankCode?: string | null;
    providerName?: string | null;
    notes?: string | null;
  };
  amountMinor: number;
  platformFeeMinor: number;
  processorFeeMinor: number;
  totalDebitMinor: number;
  currency: string;
  status: SchoolDisbursementStatus;
  paymentRail: SchoolDisbursementRail;
  reference: string;
  notes?: string | null;
  createdBy: Types.ObjectId;
  approval: {
    required: boolean;
    status: "not_required" | "pending" | "approved" | "rejected";
    requestedAt?: Date | null;
    requestedBy?: Types.ObjectId | null;
    approvedAt?: Date | null;
    approvedBy?: Types.ObjectId | null;
    rejectedAt?: Date | null;
    rejectedBy?: Types.ObjectId | null;
    note?: string | null;
  };
  processedAt?: Date | null;
  gateway?: {
    recipientCode?: string | null;
    transferCode?: string | null;
    transferId?: string | null;
    transferStatus?: string | null;
    response?: Record<string, unknown> | null;
    lastError?: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

const schoolDisbursementSchema = new Schema<ISchoolDisbursement>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    recipientType: {
      type: String,
      enum: ["teacher", "vendor"],
      required: true,
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
      index: true,
    },
    schoolExpenseId: {
      type: Schema.Types.ObjectId,
      ref: "SchoolExpense",
      default: null,
      index: true,
    },
    recipientName: { type: String, required: true, trim: true },
    purpose: { type: String, required: true, trim: true },
    destination: {
      method: {
        type: String,
        enum: ["bank", "mobile_money"],
        required: true,
      },
      accountName: { type: String, required: true, trim: true },
      accountNumber: { type: String, required: true, trim: true },
      bankName: { type: String, default: null, trim: true },
      bankCode: { type: String, default: null, trim: true },
      providerName: { type: String, default: null, trim: true },
      notes: { type: String, default: null, trim: true },
    },
    amountMinor: { type: Number, required: true, min: 1 },
    platformFeeMinor: { type: Number, required: true, default: 0, min: 0 },
    processorFeeMinor: { type: Number, required: true, default: 0, min: 0 },
    totalDebitMinor: { type: Number, required: true, default: 0, min: 1 },
    currency: { type: String, required: true, default: "GHS", trim: true },
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed", "cancelled"],
      required: true,
      default: "queued",
      index: true,
    },
    paymentRail: {
      type: String,
      enum: ["manual", "paystack"],
      required: true,
      default: "manual",
    },
    reference: { type: String, required: true, trim: true },
    notes: { type: String, default: null, trim: true },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    approval: {
      required: { type: Boolean, required: true, default: false },
      status: {
        type: String,
        enum: ["not_required", "pending", "approved", "rejected"],
        required: true,
        default: "not_required",
        index: true,
      },
      requestedAt: { type: Date, default: null },
      requestedBy: {
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
      rejectedAt: { type: Date, default: null },
      rejectedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      note: { type: String, default: null, trim: true },
    },
    processedAt: { type: Date, default: null },
    gateway: {
      recipientCode: { type: String, default: null, trim: true },
      transferCode: { type: String, default: null, trim: true },
      transferId: { type: String, default: null, trim: true },
      transferStatus: { type: String, default: null, trim: true },
      response: { type: Schema.Types.Mixed, default: null },
      lastError: { type: String, default: null, trim: true },
    },
  },
  { timestamps: true }
);

schoolDisbursementSchema.index({ schoolId: 1, createdAt: -1 });
schoolDisbursementSchema.index({ schoolId: 1, status: 1, createdAt: -1 });
schoolDisbursementSchema.index({ schoolId: 1, reference: 1 }, { unique: true });
schoolDisbursementSchema.index({
  schoolId: 1,
  paymentRail: 1,
  "approval.status": 1,
  status: 1,
  createdAt: -1,
});

export const SchoolDisbursement: Model<ISchoolDisbursement> =
  (models.SchoolDisbursement as Model<ISchoolDisbursement>) ||
  model<ISchoolDisbursement>("SchoolDisbursement", schoolDisbursementSchema);
