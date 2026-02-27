// src/models/PromotionExecutionLog.ts
// PROMO-BE-001: Promotion execution log model per PROMOTION_SERVICE_SPEC §8.4
import { Schema, model, models, Types, type Model } from "mongoose";

export type PromotionExecutionLogAction =
  | "preview_started"
  | "preview_completed"
  | "approved"
  | "finalize_started"
  | "student_applied"
  | "finalize_completed"
  | "finalize_failed"
  | "rollback_started"
  | "rollback_completed"
  | "rollback_failed";

export interface IPromotionExecutionLog {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  cycleId: Types.ObjectId;
  action: PromotionExecutionLogAction;
  actorId: Types.ObjectId;
  details: Record<string, unknown>;
  createdAt: Date;
}

const promotionExecutionLogSchema = new Schema<IPromotionExecutionLog>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    cycleId: {
      type: Schema.Types.ObjectId,
      ref: "PromotionCycle",
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: [
        "preview_started",
        "preview_completed",
        "approved",
        "finalize_started",
        "student_applied",
        "finalize_completed",
        "finalize_failed",
        "rollback_started",
        "rollback_completed",
        "rollback_failed",
      ],
      required: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    details: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

promotionExecutionLogSchema.index({ cycleId: 1, createdAt: -1 });
promotionExecutionLogSchema.index({ schoolId: 1, cycleId: 1 });

export const PromotionExecutionLog: Model<IPromotionExecutionLog> =
  (models.PromotionExecutionLog as Model<IPromotionExecutionLog>) ||
  model<IPromotionExecutionLog>(
    "PromotionExecutionLog",
    promotionExecutionLogSchema
  );
