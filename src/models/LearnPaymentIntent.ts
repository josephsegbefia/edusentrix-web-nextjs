import { Schema, model, models, Types, type Model } from "mongoose";

export type LearnPaymentIntentStatus =
  | "initiated"
  | "awaiting_webhook"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "expired";

export interface ILearnPaymentIntent {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  parentUserId: Types.ObjectId;
  accountId?: Types.ObjectId | null;
  accessId?: Types.ObjectId | null;
  academicPeriodId?: Types.ObjectId | null;
  amountMinor: number;
  currency: "GHS";
  status: LearnPaymentIntentStatus;
  paymentMethod: "paystack";
  paystackReference?: string | null;
  idempotencyKey: string;
  initiatedAt: Date;
  expiresAt?: Date | null;
  succeededAt?: Date | null;
  failureReason?: string | null;
  gatewayMetadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const learnPaymentIntentSchema = new Schema<ILearnPaymentIntent>(
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
    parentUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "LearnStudentAccount",
      default: null,
    },
    accessId: { type: Schema.Types.ObjectId, ref: "LearnAccess", default: null },
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      default: null,
      index: true,
    },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["GHS"], default: "GHS", required: true },
    status: {
      type: String,
      enum: [
        "initiated",
        "awaiting_webhook",
        "succeeded",
        "failed",
        "cancelled",
        "expired",
      ],
      default: "initiated",
      required: true,
      index: true,
    },
    paymentMethod: { type: String, enum: ["paystack"], default: "paystack" },
    paystackReference: { type: String, default: null, trim: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true },
    initiatedAt: { type: Date, required: true, default: () => new Date() },
    expiresAt: { type: Date, default: null },
    succeededAt: { type: Date, default: null },
    failureReason: { type: String, default: null, trim: true },
    gatewayMetadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

learnPaymentIntentSchema.index({ schoolId: 1, status: 1, createdAt: -1 });
learnPaymentIntentSchema.index({ parentUserId: 1, studentId: 1, createdAt: -1 });

export const LearnPaymentIntent: Model<ILearnPaymentIntent> =
  (models.LearnPaymentIntent as Model<ILearnPaymentIntent>) ||
  model<ILearnPaymentIntent>("LearnPaymentIntent", learnPaymentIntentSchema);
