import { Schema, model, models, Types, type Model } from "mongoose";

export type LearnStudentAccountStatus =
  | "pending_first_login"
  | "active"
  | "locked"
  | "disabled";

export interface ILearnStudentAccount {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  username: string;
  passwordHash: string;
  status: LearnStudentAccountStatus;
  mustChangePassword: boolean;
  lastLoginAt?: Date | null;
  passwordChangedAt?: Date | null;
  credentialsDeliveredAt?: Date | null;
  credentialsDeliveredToUserId?: Types.ObjectId | null;
  createdBy?: Types.ObjectId | null;
  disabledAt?: Date | null;
  disabledBy?: Types.ObjectId | null;
  disabledReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const learnStudentAccountSchema = new Schema<ILearnStudentAccount>(
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
    username: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    status: {
      type: String,
      enum: ["pending_first_login", "active", "locked", "disabled"],
      default: "pending_first_login",
      required: true,
      index: true,
    },
    mustChangePassword: { type: Boolean, default: true, required: true },
    lastLoginAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
    credentialsDeliveredAt: { type: Date, default: null },
    credentialsDeliveredToUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    disabledAt: { type: Date, default: null },
    disabledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    disabledReason: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

learnStudentAccountSchema.index({ schoolId: 1, studentId: 1 }, { unique: true });
learnStudentAccountSchema.index({ schoolId: 1, status: 1 });

export const LearnStudentAccount: Model<ILearnStudentAccount> =
  (models.LearnStudentAccount as Model<ILearnStudentAccount>) ||
  model<ILearnStudentAccount>("LearnStudentAccount", learnStudentAccountSchema);
