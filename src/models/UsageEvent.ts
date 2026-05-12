import { Schema, model, models, Types, type Model } from "mongoose";
import type { PlatformBillingProvider } from "@/lib/platform-billing/providers";
import type {
  UsageAllocationMethod,
  UsageMetricSourceType,
} from "@/models/UsageMetric";

export type UsageEventCategory =
  | "ai"
  | "storage"
  | "video"
  | "notification"
  | "payment"
  | "app_usage"
  | "invitation"
  | "export"
  | "other";

export interface IUsageEvent {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  provider: PlatformBillingProvider;
  category: UsageEventCategory;
  metricKey: string;
  quantity: number;
  unitLabel: string;
  unitCostMinor: number;
  estimatedCostMinor: number;
  allocationMethod: UsageAllocationMethod;
  sourceType: UsageMetricSourceType;
  actorId?: Types.ObjectId | null;
  actorEmail?: string | null;
  entityType?: string | null;
  entityId?: Types.ObjectId | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  metadata?: Record<string, unknown> | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const usageEventSchema = new Schema<IUsageEvent>(
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
    category: {
      type: String,
      enum: [
        "ai",
        "storage",
        "video",
        "notification",
        "payment",
        "app_usage",
        "invitation",
        "export",
        "other",
      ],
      required: true,
      default: "other",
      index: true,
    },
    metricKey: { type: String, required: true, trim: true, index: true },
    quantity: { type: Number, required: true, min: 0 },
    unitLabel: { type: String, required: true, trim: true },
    unitCostMinor: { type: Number, required: true, default: 0, min: 0 },
    estimatedCostMinor: { type: Number, required: true, default: 0, min: 0 },
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
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorEmail: { type: String, default: null, trim: true },
    entityType: { type: String, default: null, trim: true },
    entityId: { type: Schema.Types.ObjectId, default: null },
    periodStart: { type: Date, default: null, index: true },
    periodEnd: { type: Date, default: null, index: true },
    metadata: { type: Schema.Types.Mixed, default: null },
    notes: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

usageEventSchema.index({ schoolId: 1, createdAt: -1 });
usageEventSchema.index({ schoolId: 1, category: 1, createdAt: -1 });
usageEventSchema.index({ schoolId: 1, metricKey: 1, createdAt: -1 });
usageEventSchema.index({ entityType: 1, entityId: 1 });

export const UsageEvent: Model<IUsageEvent> =
  (models.UsageEvent as Model<IUsageEvent>) ||
  model<IUsageEvent>("UsageEvent", usageEventSchema);
