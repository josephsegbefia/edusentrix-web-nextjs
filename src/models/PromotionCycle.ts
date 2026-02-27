// src/models/PromotionCycle.ts
// PROMO-BE-001: Promotion cycle model per PROMOTION_SERVICE_SPEC §8.2
import { Schema, model, models, Types, type Model } from "mongoose";
import type { IPromotionPolicy } from "./PromotionPolicy";

export type PromotionCycleStatus =
  | "draft"
  | "preview_ready"
  | "review_in_progress"
  | "approved"
  | "finalizing"
  | "finalized"
  | "finalize_failed"
  | "cancelled"
  | "rolling_back"
  | "rolled_back"
  | "rollback_failed";

export interface IPromotionCycleProgress {
  phase: "preview" | "finalize" | "rollback";
  processed: number;
  total: number;
  batchSize: number;
  cursor?: string | null;
  startedAt?: Date | null;
  updatedAt?: Date | null;
}

export interface IPromotionCycle {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  sourceAcademicPeriodId: Types.ObjectId;
  targetAcademicPeriodId?: Types.ObjectId | null;
  sourceYearLabel: string;
  policySnapshot: IPromotionPolicy;
  status: PromotionCycleStatus;
  totals: {
    studentsEvaluated: number;
    promote: number;
    repeat: number;
    graduate: number;
    hold: number;
    overrides: number;
    errors: number;
  };
  progress?: IPromotionCycleProgress;
  idempotencyKey: string;
  lockVersion: number;
  approvedBy?: Types.ObjectId | null;
  approvedAt?: Date | null;
  finalizedBy?: Types.ObjectId | null;
  finalizedAt?: Date | null;
  rollbackOfCycleId?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const progressSchema = new Schema<IPromotionCycleProgress>(
  {
    phase: {
      type: String,
      enum: ["preview", "finalize", "rollback"],
      required: true,
    },
    processed: { type: Number, required: true },
    total: { type: Number, required: true },
    batchSize: { type: Number, required: true },
    cursor: { type: String, default: null },
    startedAt: { type: Date, default: null },
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

// Embedded policy snapshot - same shape as PromotionPolicy for cycle isolation
const policySnapshotSchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, required: true },
    schoolId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    version: { type: Number, required: true },
    isActive: { type: Boolean, required: true },
    appliesTo: Schema.Types.Mixed,
    criteria: [Schema.Types.Mixed],
    logic: { type: String, required: true },
    thresholds: Schema.Types.Mixed,
    tieBreaker: { type: String, required: true },
    attendanceComputation: Schema.Types.Mixed,
    financeHold: Schema.Types.Mixed,
    manualOverrideRules: Schema.Types.Mixed,
    createdBy: Schema.Types.ObjectId,
    updatedBy: Schema.Types.ObjectId,
    createdAt: Date,
    updatedAt: Date,
  },
  { _id: false }
);

const promotionCycleSchema = new Schema<IPromotionCycle>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    sourceAcademicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      required: true,
      index: true,
    },
    targetAcademicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      default: null,
    },
    sourceYearLabel: { type: String, required: true, trim: true },
    policySnapshot: { type: policySnapshotSchema, required: true },
    status: {
      type: String,
      enum: [
        "draft",
        "preview_ready",
        "review_in_progress",
        "approved",
        "finalizing",
        "finalized",
        "finalize_failed",
        "cancelled",
        "rolling_back",
        "rolled_back",
        "rollback_failed",
      ],
      default: "draft",
      index: true,
    },
    totals: {
      studentsEvaluated: { type: Number, required: true, default: 0 },
      promote: { type: Number, required: true, default: 0 },
      repeat: { type: Number, required: true, default: 0 },
      graduate: { type: Number, required: true, default: 0 },
      hold: { type: Number, required: true, default: 0 },
      overrides: { type: Number, required: true, default: 0 },
      errors: { type: Number, required: true, default: 0 },
    },
    progress: { type: progressSchema, default: undefined },
    idempotencyKey: { type: String, required: true, index: true },
    lockVersion: { type: Number, required: true, default: 0 },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    finalizedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    finalizedAt: { type: Date, default: null },
    rollbackOfCycleId: {
      type: Schema.Types.ObjectId,
      ref: "PromotionCycle",
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

promotionCycleSchema.index({ schoolId: 1, status: 1 });
promotionCycleSchema.index({ schoolId: 1, sourceAcademicPeriodId: 1 });
promotionCycleSchema.index({ schoolId: 1, createdAt: -1 });
promotionCycleSchema.index({ idempotencyKey: 1 }, { unique: true });

export const PromotionCycle: Model<IPromotionCycle> =
  (models.PromotionCycle as Model<IPromotionCycle>) ||
  model<IPromotionCycle>("PromotionCycle", promotionCycleSchema);
