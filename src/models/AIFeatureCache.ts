import mongoose, { Schema, model, models, Types, type Model } from "mongoose";

export type AIFeatureKey =
  | "fees_account_brief"
  | "fees_reminder_template";

export interface IAIFeatureCache {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  feature: AIFeatureKey;
  scopeType: "school" | "student";
  scopeId?: Types.ObjectId | null;
  variantKey: string;
  promptVersion: number;
  dataFingerprint: string;
  inputSnapshot?: Record<string, unknown> | null;
  output: Record<string, unknown>;
  status: "ready" | "stale" | "error";
  errorMessage?: string | null;
  generatedBy?: Types.ObjectId | null;
  generatedAt: Date;
  expiresAt?: Date | null;
  modelUsed?: string | null;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

const aiFeatureCacheSchema = new Schema<IAIFeatureCache>(
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
    promptVersion: { type: Number, required: true, default: 1 },
    dataFingerprint: { type: String, required: true, trim: true },
    inputSnapshot: { type: Schema.Types.Mixed, default: null },
    output: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["ready", "stale", "error"],
      required: true,
      default: "ready",
    },
    errorMessage: { type: String, default: null, trim: true },
    generatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    generatedAt: { type: Date, required: true, default: Date.now, index: true },
    expiresAt: { type: Date, default: null, index: true },
    modelUsed: { type: String, default: null, trim: true },
    tokenUsage: {
      type: {
        promptTokens: Number,
        completionTokens: Number,
        totalTokens: Number,
      },
      default: null,
    },
  },
  { timestamps: true }
);

aiFeatureCacheSchema.index(
  {
    schoolId: 1,
    feature: 1,
    scopeType: 1,
    scopeId: 1,
    variantKey: 1,
    promptVersion: 1,
  },
  {
    unique: true,
    name: "unique_feature_scope_variant",
  }
);

aiFeatureCacheSchema.index(
  { schoolId: 1, feature: 1, generatedAt: -1 },
  { name: "feature_usage_by_day" }
);

export const AIFeatureCache: Model<IAIFeatureCache> =
  (models.AIFeatureCache as Model<IAIFeatureCache>) ||
  model<IAIFeatureCache>("AIFeatureCache", aiFeatureCacheSchema);

// Keep explicit model registration for hot-reload safety.
void mongoose.models.AIFeatureCache;
