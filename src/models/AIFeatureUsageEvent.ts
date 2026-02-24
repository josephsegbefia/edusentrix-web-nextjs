import { Schema, model, models, Types, type Model } from "mongoose";
import type { AIFeatureKey } from "@/models/AIFeatureCache";

export interface IAIFeatureUsageEvent {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  feature: AIFeatureKey;
  scopeType: "school" | "student";
  scopeId?: Types.ObjectId | null;
  variantKey: string;
  generatedBy?: Types.ObjectId | null;
  modelUsed?: string | null;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const aiFeatureUsageEventSchema = new Schema<IAIFeatureUsageEvent>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    feature: {
      type: String,
      enum: ["fees_account_brief", "fees_reminder_template"],
      required: true,
      index: true,
    },
    scopeType: {
      type: String,
      enum: ["school", "student"],
      required: true,
      default: "school",
      index: true,
    },
    scopeId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    variantKey: {
      type: String,
      required: true,
      default: "default",
      trim: true,
    },
    generatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    modelUsed: {
      type: String,
      default: null,
      trim: true,
    },
    tokenUsage: {
      type: {
        promptTokens: { type: Number, required: true, min: 0 },
        completionTokens: { type: Number, required: true, min: 0 },
        totalTokens: { type: Number, required: true, min: 0 },
      },
      required: true,
    },
  },
  { timestamps: true }
);

aiFeatureUsageEventSchema.index(
  { schoolId: 1, createdAt: -1 },
  { name: "usage_events_by_school_day" }
);

aiFeatureUsageEventSchema.index(
  { schoolId: 1, feature: 1, createdAt: -1 },
  { name: "usage_events_by_feature_day" }
);

export const AIFeatureUsageEvent: Model<IAIFeatureUsageEvent> =
  (models.AIFeatureUsageEvent as Model<IAIFeatureUsageEvent>) ||
  model<IAIFeatureUsageEvent>("AIFeatureUsageEvent", aiFeatureUsageEventSchema);
