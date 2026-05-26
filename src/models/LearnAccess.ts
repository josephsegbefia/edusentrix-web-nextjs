import { Schema, model, models, Types, type Model } from "mongoose";

export type LearnAccessSource =
  | "parent_paid"
  | "platform_gift"
  | "school_sponsored"
  | "manual_grant";

export type LearnAccessStatus = "active" | "revoked" | "expired";

export interface ILearnAccess {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  accountId: Types.ObjectId;
  academicPeriodId?: Types.ObjectId | null;
  source: LearnAccessSource;
  status: LearnAccessStatus;
  startsAt: Date;
  expiresAt: Date;
  paymentIntentId?: Types.ObjectId | null;
  grantedBy?: Types.ObjectId | null;
  revokedAt?: Date | null;
  revokedBy?: Types.ObjectId | null;
  revokeReason?: string | null;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const learnAccessSchema = new Schema<ILearnAccess>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "LearnStudentAccount",
      required: true,
      index: true,
    },
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      default: null,
      index: true,
    },
    source: {
      type: String,
      enum: ["parent_paid", "platform_gift", "school_sponsored", "manual_grant"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "revoked", "expired"],
      default: "active",
      required: true,
      index: true,
    },
    startsAt: { type: Date, required: true, default: () => new Date() },
    expiresAt: { type: Date, required: true, index: true },
    paymentIntentId: {
      type: Schema.Types.ObjectId,
      ref: "LearnPaymentIntent",
      default: null,
    },
    grantedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    revokeReason: { type: String, default: null, trim: true },
    note: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

learnAccessSchema.index({ schoolId: 1, status: 1, expiresAt: 1 });
learnAccessSchema.index({ studentId: 1, status: 1, expiresAt: 1 });
learnAccessSchema.index(
  { studentId: 1, academicPeriodId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
  }
);

export const LearnAccess: Model<ILearnAccess> =
  (models.LearnAccess as Model<ILearnAccess>) ||
  model<ILearnAccess>("LearnAccess", learnAccessSchema);
