import { Schema, model, models, Types, type Model } from "mongoose";
import type { PlatformBillingProvider } from "@/lib/platform-billing/providers";

export type UsageAllocationMethod = "direct" | "weighted" | "manual";
export type UsageMetricSourceType = "manual" | "provider_sync" | "system_estimate";

export interface IUsageMetric {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  provider: PlatformBillingProvider;
  metricKey: string;
  quantity: number;
  unitLabel: string;
  unitCostMinor: number;
  estimatedCostMinor: number;
  allocationMethod: UsageAllocationMethod;
  sourceType: UsageMetricSourceType;
  periodStart: Date;
  periodEnd: Date;
  notes?: string | null;
  updatedBy?: Types.ObjectId | null;
  updatedByEmail?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const usageMetricSchema = new Schema<IUsageMetric>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: [
        "clerk",
        "mongodb",
        "vercel",
        "openai",
        "uploadthing",
        "paystack",
        "email",
        "storage",
        "internal",
      ],
      required: true,
      index: true,
    },
    metricKey: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true },
    unitLabel: { type: String, required: true, trim: true },
    unitCostMinor: { type: Number, required: true, default: 0 },
    estimatedCostMinor: { type: Number, required: true, default: 0 },
    allocationMethod: {
      type: String,
      enum: ["direct", "weighted", "manual"],
      required: true,
      default: "manual",
    },
    sourceType: {
      type: String,
      enum: ["manual", "provider_sync", "system_estimate"],
      required: true,
      default: "manual",
    },
    periodStart: { type: Date, required: true, index: true },
    periodEnd: { type: Date, required: true, index: true },
    notes: { type: String, default: null, trim: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedByEmail: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

usageMetricSchema.index(
  {
    schoolId: 1,
    provider: 1,
    metricKey: 1,
    periodStart: 1,
    periodEnd: 1,
  },
  { unique: true }
);
usageMetricSchema.index({ schoolId: 1, periodStart: 1, periodEnd: 1 });

export const UsageMetric: Model<IUsageMetric> =
  (models.UsageMetric as Model<IUsageMetric>) ||
  model<IUsageMetric>("UsageMetric", usageMetricSchema);
