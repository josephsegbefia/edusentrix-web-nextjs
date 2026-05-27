/**
 * UsageBalance — per-school, per-period balance for metered features.
 *
 * Tracks included quantity (from plan), purchased add-ons, adjustments, and used amounts.
 * Remaining = includedQuantity + purchasedQuantity + adjustedQuantity - usedQuantity.
 *
 * Spec §11.5.
 */

import { Schema, model, models, Types, type Model } from "mongoose";

export type UsageBalanceType =
  | "leo_credits"
  | "meeting_participant_minutes"
  | "storage_bytes"
  | "learn_seats"
  | "sms_credits"
  | "whatsapp_credits";

export interface IUsageBalance {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  /** e.g. "2025-T2", "2025-annual", "2025-06" — caller defines granularity */
  periodKey: string;
  academicYearId?: Types.ObjectId | null;
  academicTermId?: Types.ObjectId | null;
  balanceType: UsageBalanceType;
  /** Credits included by the plan at the start of the period. */
  includedQuantity: number;
  /** Credits purchased via add-on packages. */
  purchasedQuantity: number;
  /** Credits consumed. Monotonically increasing — never decremented. */
  usedQuantity: number;
  /** Platform-admin manual adjustment (positive = top-up, negative = correction). */
  adjustedQuantity: number;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const usageBalanceSchema = new Schema<IUsageBalance>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    periodKey: { type: String, required: true, trim: true },
    academicYearId: { type: Schema.Types.ObjectId, ref: "AcademicYear", default: null },
    academicTermId: { type: Schema.Types.ObjectId, ref: "AcademicTerm", default: null },
    balanceType: {
      type: String,
      enum: [
        "leo_credits",
        "meeting_participant_minutes",
        "storage_bytes",
        "learn_seats",
        "sms_credits",
        "whatsapp_credits",
      ],
      required: true,
    },
    includedQuantity: { type: Number, required: true, default: 0, min: 0 },
    purchasedQuantity: { type: Number, required: true, default: 0, min: 0 },
    usedQuantity: { type: Number, required: true, default: 0, min: 0 },
    adjustedQuantity: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

usageBalanceSchema.index({ schoolId: 1, periodKey: 1, balanceType: 1 }, { unique: true });
usageBalanceSchema.index({ schoolId: 1, balanceType: 1 });
usageBalanceSchema.index({ expiresAt: 1 });

export const UsageBalance: Model<IUsageBalance> =
  (models.UsageBalance as Model<IUsageBalance>) ||
  model<IUsageBalance>("UsageBalance", usageBalanceSchema);

/** Computed remaining quantity for a balance record. */
export function computeRemaining(balance: Pick<IUsageBalance, "includedQuantity" | "purchasedQuantity" | "usedQuantity" | "adjustedQuantity">): number {
  return (
    balance.includedQuantity +
    balance.purchasedQuantity +
    balance.adjustedQuantity -
    balance.usedQuantity
  );
}
