/**
 * Generic cache for AI-generated insights across different scopes.
 * Used for: academic (student+term), staff_attendance (date), roles_duties (tab).
 * Insights are only regenerated when dataFingerprint changes or user requests regenerate.
 */
import { Schema, model, models, Types, type Model } from "mongoose";

export type AICachedInsightScope = "academic" | "staff_attendance" | "roles_duties";

export interface IAICachedInsight {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  scope: AICachedInsightScope;
  scopeKey: string; // e.g. "studentId:termId", "YYYY-MM-DD", "student-roles"
  dataFingerprint: string; // hash of input data; if it changes, cache is stale
  insights: Record<string, unknown>; // JSON payload
  generatedAt: Date;
  generatedBy?: Types.ObjectId;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  modelUsed?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const aiCachedInsightSchema = new Schema<IAICachedInsight>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    scope: {
      type: String,
      enum: ["academic", "staff_attendance", "roles_duties"],
      required: true,
      index: true,
    },
    scopeKey: {
      type: String,
      required: true,
      index: true,
    },
    dataFingerprint: {
      type: String,
      required: true,
    },
    insights: {
      type: Schema.Types.Mixed,
      required: true,
    },
    generatedAt: { type: Date, default: Date.now },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    tokenUsage: {
      type: {
        promptTokens: Number,
        completionTokens: Number,
        totalTokens: Number,
      },
      default: null,
    },
    modelUsed: { type: String, default: null },
  },
  { timestamps: true }
);

aiCachedInsightSchema.index(
  { schoolId: 1, scope: 1, scopeKey: 1 },
  { unique: true, name: "unique_school_scope_key" }
);

export const AICachedInsight: Model<IAICachedInsight> =
  (models.AICachedInsight as Model<IAICachedInsight>) ||
  model<IAICachedInsight>("AICachedInsight", aiCachedInsightSchema);
