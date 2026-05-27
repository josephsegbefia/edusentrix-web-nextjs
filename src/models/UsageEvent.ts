/**
 * UsageEvent model — §11.6
 *
 * Immutable ledger of individual usage events (AI calls, meeting minutes,
 * storage writes, exports, etc.) for per-school cost attribution, audit,
 * and platform analytics. This is separate from SubscriptionEvent which
 * tracks lifecycle changes.
 */

import { Schema, model, models, Types, type Model } from "mongoose";

export type UsageEventCategory =
  | "ai"
  | "meeting"
  | "storage"
  | "payment"
  | "notification"
  | "export"
  | "other";

export interface IUsageEvent {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  userId?: Types.ObjectId | null;
  /** High-level category for dashboards and alerting. */
  category: UsageEventCategory;
  /** Canonical metric key matching a LIMIT_KEYS entry where applicable. */
  metricKey: string;
  /** Number of units consumed (credits, bytes, minutes, count). */
  quantity: number;
  /** Human-readable unit label, e.g. "credits", "bytes", "participant-minutes". */
  unitLabel: string;
  /** Links to a UsageBalance.balanceType when this event deducts from a balance. */
  balanceType?: string | null;
  /** Optional reference entity (lesson note, meeting, invoice, etc.). */
  entityType?: string | null;
  entityId?: Types.ObjectId | null;
  /** Provider that performed the action (e.g. "openai", "livekit", "uploadthing"). */
  provider?: string | null;
  /** Estimated platform cost in minor currency units (informational only). */
  estimatedCostMinor?: number | null;
  /** Whether this event was a reserve, finalize, or refund in the credit flow. */
  creditFlowStage?: "reserve" | "finalize" | "refund" | "direct" | null;
  /** Free-form metadata (action name, model version, file name, etc.). */
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

const usageEventSchema = new Schema<IUsageEvent>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    category: {
      type: String,
      enum: ["ai", "meeting", "storage", "payment", "notification", "export", "other"],
      required: true,
    },
    metricKey: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true },
    unitLabel: { type: String, required: true, trim: true },
    balanceType: { type: String, default: null, trim: true },
    entityType: { type: String, default: null, trim: true },
    entityId: { type: Schema.Types.ObjectId, default: null },
    provider: { type: String, default: null, trim: true },
    estimatedCostMinor: { type: Number, default: null },
    creditFlowStage: {
      type: String,
      enum: ["reserve", "finalize", "refund", "direct", null],
      default: null,
    },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Queries: per-school usage over a time range, by category or metric
usageEventSchema.index({ schoolId: 1, createdAt: -1 });
usageEventSchema.index({ schoolId: 1, category: 1, createdAt: -1 });
usageEventSchema.index({ schoolId: 1, metricKey: 1, createdAt: -1 });
usageEventSchema.index({ schoolId: 1, balanceType: 1, createdAt: -1 });
// Entity lookups
usageEventSchema.index({ entityType: 1, entityId: 1 });

export const UsageEvent: Model<IUsageEvent> =
  (models.UsageEvent as Model<IUsageEvent>) ||
  model<IUsageEvent>("UsageEvent", usageEventSchema);
