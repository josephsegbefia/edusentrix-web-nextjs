import { Schema, model, models, Types, type Model } from "mongoose";
import type { PlatformBillingProvider } from "@/lib/platform-billing/providers";

export type ProviderSyncRunStatus = "running" | "completed" | "failed";
export type ProviderSyncTriggerMode = "manual" | "scheduled";

export interface IProviderSyncRun {
  _id: Types.ObjectId;
  provider: PlatformBillingProvider;
  status: ProviderSyncRunStatus;
  triggerMode: ProviderSyncTriggerMode;
  periodStart: Date;
  periodEnd: Date;
  metricsUpserted: number;
  costEntriesUpserted: number;
  triggeredBy?: Types.ObjectId | null;
  triggeredByEmail?: string | null;
  summary?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
  startedAt: Date;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const providerSyncRunSchema = new Schema<IProviderSyncRun>(
  {
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
    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      required: true,
      default: "running",
      index: true,
    },
    triggerMode: {
      type: String,
      enum: ["manual", "scheduled"],
      required: true,
      default: "manual",
    },
    periodStart: { type: Date, required: true, index: true },
    periodEnd: { type: Date, required: true, index: true },
    metricsUpserted: { type: Number, required: true, default: 0 },
    costEntriesUpserted: { type: Number, required: true, default: 0 },
    triggeredBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    triggeredByEmail: { type: String, default: null, trim: true },
    summary: { type: String, default: null, trim: true },
    errorMessage: { type: String, default: null, trim: true },
    metadata: { type: Schema.Types.Mixed, default: null },
    startedAt: { type: Date, required: true, default: () => new Date() },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

providerSyncRunSchema.index({ provider: 1, createdAt: -1 });
providerSyncRunSchema.index({ status: 1, createdAt: -1 });

export const ProviderSyncRun: Model<IProviderSyncRun> =
  (models.ProviderSyncRun as Model<IProviderSyncRun>) ||
  model<IProviderSyncRun>("ProviderSyncRun", providerSyncRunSchema);
