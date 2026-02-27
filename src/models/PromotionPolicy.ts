// src/models/PromotionPolicy.ts
// PROMO-BE-001: Promotion policy model per PROMOTION_SERVICE_SPEC §8.1
import { Schema, model, models, Types, type Model } from "mongoose";

export type PromotionPolicyCriteriaKey =
  | "attendance_percent"
  | "overall_average"
  | "subjects_passed_percent"
  | "fee_outstanding_minor"
  | "discipline_flags";

export interface IPromotionPolicyCriteria {
  key: PromotionPolicyCriteriaKey;
  operator: ">=" | "<=" | ">" | "<" | "=";
  value: number;
  weight?: number;
  required?: boolean;
}

export interface IPromotionPolicy {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  name: string;
  version: number;
  isActive: boolean;
  appliesTo: { stage?: string; gradeIds?: Types.ObjectId[] };
  criteria: IPromotionPolicyCriteria[];
  logic: "all_required_pass" | "weighted_score";
  thresholds: {
    promote: number;
    holdForReview?: number;
  };
  tieBreaker: "manual_review" | "attendance" | "overall_average";
  attendanceComputation: { treatExcusedAsPresent: boolean };
  financeHold: { enabled: boolean; maxOutstandingMinor: number };
  manualOverrideRules: { requireReason: boolean; requireApprover: boolean };
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const criteriaSchema = new Schema<IPromotionPolicyCriteria>(
  {
    key: {
      type: String,
      enum: [
        "attendance_percent",
        "overall_average",
        "subjects_passed_percent",
        "fee_outstanding_minor",
        "discipline_flags",
      ],
      required: true,
    },
    operator: {
      type: String,
      enum: [">=", "<=", ">", "<", "="],
      required: true,
    },
    value: { type: Number, required: true },
    weight: { type: Number, default: undefined },
    required: { type: Boolean, default: false },
  },
  { _id: false }
);

const promotionPolicySchema = new Schema<IPromotionPolicy>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    version: { type: Number, required: true, default: 1 },
    isActive: { type: Boolean, default: false },
    appliesTo: {
      stage: { type: String, default: undefined },
      gradeIds: [{ type: Schema.Types.ObjectId, ref: "Grade" }],
    },
    criteria: [criteriaSchema],
    logic: {
      type: String,
      enum: ["all_required_pass", "weighted_score"],
      required: true,
    },
    thresholds: {
      promote: { type: Number, required: true },
      holdForReview: { type: Number, default: undefined },
    },
    tieBreaker: {
      type: String,
      enum: ["manual_review", "attendance", "overall_average"],
      required: true,
    },
    attendanceComputation: {
      treatExcusedAsPresent: { type: Boolean, required: true },
    },
    financeHold: {
      enabled: { type: Boolean, required: true },
      maxOutstandingMinor: { type: Number, required: true },
    },
    manualOverrideRules: {
      requireReason: { type: Boolean, required: true },
      requireApprover: { type: Boolean, required: true },
    },
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

promotionPolicySchema.index({ schoolId: 1, isActive: 1 });
promotionPolicySchema.index({ schoolId: 1, version: -1 });

export const PromotionPolicy: Model<IPromotionPolicy> =
  (models.PromotionPolicy as Model<IPromotionPolicy>) ||
  model<IPromotionPolicy>("PromotionPolicy", promotionPolicySchema);
