// src/models/PromotionDecision.ts
// PROMO-BE-001: Promotion decision model per PROMOTION_SERVICE_SPEC §8.3
import { Schema, model, models, Types, type Model } from "mongoose";

export type PromotionOutcome = "promote" | "repeat" | "graduate" | "hold";
export type PromotionDecisionSource = "engine" | "manual_override";

export interface IPromotionDecisionEvidence {
  attendancePercent?: number | null;
  overallAverage?: number | null;
  subjectsPassedPercent?: number | null;
  feeOutstandingMinor?: number | null;
  disciplineFlags?: number | null;
}

export interface IPromotionDecision {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  cycleId: Types.ObjectId;
  studentId: Types.ObjectId;
  fromGradeId: Types.ObjectId;
  fromClassGroupId: Types.ObjectId;
  targetGradeId?: Types.ObjectId | null;
  targetClassGroupId?: Types.ObjectId | null;
  recommendedOutcome: PromotionOutcome;
  finalOutcome: PromotionOutcome;
  source: PromotionDecisionSource;
  reasonCodes: string[];
  reasonText?: string | null;
  evidence: IPromotionDecisionEvidence;
  conflicts: string[];
  isApplied: boolean;
  appliedAt?: Date | null;
  version: number;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const evidenceSchema = new Schema<IPromotionDecisionEvidence>(
  {
    attendancePercent: { type: Number, default: null },
    overallAverage: { type: Number, default: null },
    subjectsPassedPercent: { type: Number, default: null },
    feeOutstandingMinor: { type: Number, default: null },
    disciplineFlags: { type: Number, default: null },
  },
  { _id: false }
);

const promotionDecisionSchema = new Schema<IPromotionDecision>(
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
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    fromGradeId: {
      type: Schema.Types.ObjectId,
      ref: "Grade",
      required: true,
    },
    fromClassGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
    },
    targetGradeId: { type: Schema.Types.ObjectId, ref: "Grade", default: null },
    targetClassGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      default: null,
    },
    recommendedOutcome: {
      type: String,
      enum: ["promote", "repeat", "graduate", "hold"],
      required: true,
    },
    finalOutcome: {
      type: String,
      enum: ["promote", "repeat", "graduate", "hold"],
      required: true,
    },
    source: {
      type: String,
      enum: ["engine", "manual_override"],
      required: true,
    },
    reasonCodes: [{ type: String }],
    reasonText: { type: String, default: null },
    evidence: { type: evidenceSchema, required: true },
    conflicts: [{ type: String }],
    isApplied: { type: Boolean, required: true, default: false },
    appliedAt: { type: Date, default: null },
    version: { type: Number, required: true, default: 1 },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

promotionDecisionSchema.index({ cycleId: 1, studentId: 1 }, { unique: true });
promotionDecisionSchema.index({ cycleId: 1, finalOutcome: 1 });
promotionDecisionSchema.index({ cycleId: 1, isApplied: 1 });
promotionDecisionSchema.index({ schoolId: 1, cycleId: 1, studentId: 1 });

export const PromotionDecision: Model<IPromotionDecision> =
  (models.PromotionDecision as Model<IPromotionDecision>) ||
  model<IPromotionDecision>("PromotionDecision", promotionDecisionSchema);
