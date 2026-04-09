import { Schema, model, models, Types } from "mongoose";

export interface IProvisioningJob {
  _id: Types.ObjectId;
  kind: "paystack_subaccount";
  schoolId: Types.ObjectId;
  payload: Record<string, unknown>;
  status: "pending" | "running" | "failed" | "done";
  attempts: number;
  lastError?: string | null;
  nextRunAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const provisioningJobSchema = new Schema<IProvisioningJob>(
  {
    kind: { type: String, enum: ["paystack_subaccount"], required: true },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    payload: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ["pending", "running", "failed", "done"],
      default: "pending",
    },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    nextRunAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    // Legacy collection from the old typo model name "ProvisioningJpb" → provisioningjpbs
    collection: "provisioningjpbs",
  }
);

export const ProvisioningJob =
  models.ProvisioningJob ||
  model<IProvisioningJob>("ProvisioningJob", provisioningJobSchema);
