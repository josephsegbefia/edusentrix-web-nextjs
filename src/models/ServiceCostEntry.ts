import { Schema, model, models, Types, type Model } from "mongoose";
import type { PlatformBillingProvider } from "@/lib/platform-billing/providers";

export type ServiceCostAllocationMethod = "shared" | "direct" | "n_a";
export type ServiceCostSourceType = "manual" | "provider_sync" | "invoice_import";

export interface IServiceCostEntry {
  _id: Types.ObjectId;
  provider: PlatformBillingProvider;
  category: string;
  description?: string | null;
  amountMinor: number;
  currency: string;
  allocationMethod: ServiceCostAllocationMethod;
  sourceType: ServiceCostSourceType;
  periodStart: Date;
  periodEnd: Date;
  notes?: string | null;
  createdBy?: Types.ObjectId | null;
  createdByEmail?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const serviceCostEntrySchema = new Schema<IServiceCostEntry>(
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
    category: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
    amountMinor: { type: Number, required: true },
    currency: { type: String, required: true, default: "GHS", trim: true },
    allocationMethod: {
      type: String,
      enum: ["shared", "direct", "n_a"],
      required: true,
      default: "shared",
    },
    sourceType: {
      type: String,
      enum: ["manual", "provider_sync", "invoice_import"],
      required: true,
      default: "manual",
    },
    periodStart: { type: Date, required: true, index: true },
    periodEnd: { type: Date, required: true, index: true },
    notes: { type: String, default: null, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdByEmail: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

serviceCostEntrySchema.index({ provider: 1, periodStart: -1, periodEnd: -1 });
serviceCostEntrySchema.index({ category: 1, periodStart: -1 });

export const ServiceCostEntry: Model<IServiceCostEntry> =
  (models.ServiceCostEntry as Model<IServiceCostEntry>) ||
  model<IServiceCostEntry>("ServiceCostEntry", serviceCostEntrySchema);
