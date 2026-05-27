/**
 * usage-tracker.ts
 *
 * Records and deducts metered usage (Leo AI credits, storage bytes, etc.)
 * against the school's UsageBalance documents.
 *
 * All writes are conditional on SUBSCRIPTION_USAGE_GATES_ENABLED=true.
 * While that flag is false, tracking is logged but balances are not deducted.
 * This avoids retroactively charging schools during the build phase.
 */

import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { UsageBalance, type UsageBalanceType } from "@/models/UsageBalance";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { recordSubscriptionEvent } from "./record-event";

const USAGE_GATES_ENABLED =
  process.env.SUBSCRIPTION_USAGE_GATES_ENABLED === "true";

export type TrackUsageParams = {
  schoolId: string | mongoose.Types.ObjectId;
  type: UsageBalanceType;
  /** How much to deduct. Positive = consume. */
  amount: number;
  /** Optional description for the audit trail. */
  description?: string;
  /** Optional reference (e.g. lessonNoteId, examPaperId). */
  referenceId?: string;
  referenceType?: string;
};

export type UsageCheckResult =
  | { allowed: true; remaining: number }
  | { allowed: false; reason: string; remaining: number };

/**
 * Check remaining balance for a metered type without deducting.
 */
export async function checkUsageBalance(
  schoolId: string | mongoose.Types.ObjectId,
  type: UsageBalanceType
): Promise<{ hasBalance: boolean; remaining: number; limit: number | null }> {
  if (!USAGE_GATES_ENABLED) {
    return { hasBalance: true, remaining: Infinity, limit: null };
  }

  await connectToDatabase();

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  const sub = await SchoolSubscription.findOne({ schoolId: schoolIdObj })
    .select("_id")
    .lean<{ _id: mongoose.Types.ObjectId }>();

  if (!sub) return { hasBalance: true, remaining: Infinity, limit: null };

  const balance = await UsageBalance.findOne({
    schoolId: schoolIdObj,
    subscriptionId: sub._id,
    balanceType: type,
  }).lean<{
    includedQuantity: number;
    purchasedQuantity: number;
    usedQuantity: number;
    adjustedQuantity: number;
  }>();

  if (!balance) return { hasBalance: true, remaining: Infinity, limit: null };

  const total = balance.includedQuantity + balance.purchasedQuantity + balance.adjustedQuantity;
  const remaining = Math.max(0, total - balance.usedQuantity);

  return { hasBalance: remaining > 0, remaining, limit: total };
}

/**
 * Deduct usage from a balance.
 *
 * - While SUBSCRIPTION_USAGE_GATES_ENABLED=false: logs but does NOT deduct.
 * - If balance record doesn't exist: treats as unlimited (no deduction).
 * - Returns the remaining balance after deduction (or Infinity if unlimited).
 */
export async function trackSubscriptionUsage({
  schoolId,
  type,
  amount,
  description,
  referenceId,
  referenceType,
}: TrackUsageParams): Promise<{ success: true; remaining: number }> {
  if (!USAGE_GATES_ENABLED) {
    // Log intent but don't charge
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[usage-tracker] SKIPPED (gates off): ${type} -= ${amount} for school ${schoolId}`
      );
    }
    return { success: true, remaining: Infinity };
  }

  await connectToDatabase();

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  const sub = await SchoolSubscription.findOne({ schoolId: schoolIdObj })
    .select("_id")
    .lean<{ _id: mongoose.Types.ObjectId }>();

  if (!sub) return { success: true, remaining: Infinity };

  const balance = await UsageBalance.findOneAndUpdate(
    { schoolId: schoolIdObj, subscriptionId: sub._id, balanceType: type },
    { $inc: { usedQuantity: amount } },
    { new: true }
  ).lean<{
    includedQuantity: number;
    purchasedQuantity: number;
    usedQuantity: number;
    adjustedQuantity: number;
  }>();

  if (!balance) return { success: true, remaining: Infinity };

  const total = balance.includedQuantity + balance.purchasedQuantity + balance.adjustedQuantity;
  const remaining = Math.max(0, total - balance.usedQuantity);

  // Audit event via central helper (respects SUBSCRIPTION_AUDIT_LOGS_ENABLED)
  if (USAGE_GATES_ENABLED) {
    await recordSubscriptionEvent({
      schoolId: schoolIdObj,
      subscriptionId: sub._id,
      eventType: "usage_event",
      summary: description ?? `${type} consumed (${amount}).`,
      metadata: {
        balanceType: type,
        amount,
        remainingAfter: remaining,
        referenceId: referenceId ?? null,
        referenceType: referenceType ?? null,
      },
    });
  }

  return { success: true, remaining };
}

// ---------------------------------------------------------------------------
// Reserve / Finalize / Refund pattern (spec §11.6)
// ---------------------------------------------------------------------------

/**
 * Reservation token returned by reserveUsageCredits.
 * Callers MUST call finalizeUsageCredits or refundUsageCredits
 * to avoid permanent credit hold.
 */
export type UsageReservation = {
  reservationId: string;
  schoolId: string;
  type: UsageBalanceType;
  reservedAmount: number;
  subscriptionId: string | null;
  createdAt: Date;
};

/**
 * Reserve credits before a costly async operation (e.g. AI generation, meeting start).
 *
 * Atomically pre-deducts `amount` from usedQuantity to prevent concurrent
 * over-consumption. Returns a reservation token that must be finalized/refunded.
 *
 * While gates are off, returns a no-op reservation.
 */
export async function reserveUsageCredits(
  schoolId: string | mongoose.Types.ObjectId,
  type: UsageBalanceType,
  amount: number,
  description?: string
): Promise<{ ok: boolean; reservation: UsageReservation | null; reason?: string }> {
  if (!USAGE_GATES_ENABLED) {
    return {
      ok: true,
      reservation: {
        reservationId: `noop_${Date.now()}`,
        schoolId: String(schoolId),
        type,
        reservedAmount: amount,
        subscriptionId: null,
        createdAt: new Date(),
      },
    };
  }

  // First check balance
  const check = await checkUsageBalance(schoolId, type);
  if (!check.hasBalance || check.remaining < amount) {
    return {
      ok: false,
      reservation: null,
      reason: `Insufficient ${type.replace(/_/g, " ")}. Remaining: ${check.remaining}.`,
    };
  }

  await connectToDatabase();
  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  const sub = await SchoolSubscription.findOne({ schoolId: schoolIdObj }).select("_id").lean<{ _id: mongoose.Types.ObjectId }>();

  // Atomically deduct (reserve)
  await UsageBalance.findOneAndUpdate(
    { schoolId: schoolIdObj, subscriptionId: sub?._id, balanceType: type },
    { $inc: { usedQuantity: amount } }
  );

  const reservation: UsageReservation = {
    reservationId: `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    schoolId: String(schoolId),
    type,
    reservedAmount: amount,
    subscriptionId: sub ? String(sub._id) : null,
    createdAt: new Date(),
  };

  await recordSubscriptionEvent({
    schoolId: schoolIdObj,
    subscriptionId: sub?._id ?? null,
    eventType: "usage_event",
    summary: description ?? `${type} reserved (${amount}).`,
    metadata: { balanceType: type, amount, phase: "reserved", reservationId: reservation.reservationId },
  });

  return { ok: true, reservation };
}

/**
 * Finalize a reservation. Confirms the credit deduction (no-op since reserve
 * already deducted, but logs confirmation).
 */
export async function finalizeUsageCredits(
  reservation: UsageReservation,
  actualAmount?: number
): Promise<void> {
  if (!USAGE_GATES_ENABLED) return;

  const diff = actualAmount !== undefined ? reservation.reservedAmount - actualAmount : 0;

  // If actual < reserved, refund the difference
  if (diff > 0 && reservation.subscriptionId) {
    await connectToDatabase();
    const schoolIdObj = new mongoose.Types.ObjectId(reservation.schoolId);
    await UsageBalance.findOneAndUpdate(
      {
        schoolId: schoolIdObj,
        subscriptionId: new mongoose.Types.ObjectId(reservation.subscriptionId),
        balanceType: reservation.type,
      },
      { $inc: { usedQuantity: -diff } }
    );
  }

  await recordSubscriptionEvent({
    schoolId: reservation.schoolId,
    subscriptionId: reservation.subscriptionId,
    eventType: "usage_event",
    summary: `${reservation.type} finalized (${actualAmount ?? reservation.reservedAmount} used).`,
    metadata: {
      balanceType: reservation.type,
      amount: actualAmount ?? reservation.reservedAmount,
      phase: "finalized",
      reservationId: reservation.reservationId,
      diff: diff > 0 ? diff : 0,
    },
  });
}

/**
 * Refund a reservation. Called if the operation failed — returns credits to
 * the balance.
 */
export async function refundUsageCredits(
  reservation: UsageReservation,
  reason?: string
): Promise<void> {
  if (!USAGE_GATES_ENABLED || !reservation.subscriptionId) return;

  await connectToDatabase();
  const schoolIdObj = new mongoose.Types.ObjectId(reservation.schoolId);

  await UsageBalance.findOneAndUpdate(
    {
      schoolId: schoolIdObj,
      subscriptionId: new mongoose.Types.ObjectId(reservation.subscriptionId),
      balanceType: reservation.type,
    },
    { $inc: { usedQuantity: -reservation.reservedAmount } }
  );

  await recordSubscriptionEvent({
    schoolId: reservation.schoolId,
    subscriptionId: reservation.subscriptionId,
    eventType: "usage_event",
    summary: `${reservation.type} refunded (${reservation.reservedAmount} returned). ${reason ?? ""}`.trim(),
    metadata: {
      balanceType: reservation.type,
      amount: reservation.reservedAmount,
      phase: "refunded",
      reservationId: reservation.reservationId,
      reason: reason ?? null,
    },
  });
}

/**
 * Enforce usage gate before a metered operation.
 * Returns GuardResult-compatible shape.
 */
export async function requireUsageBalance(
  schoolId: string | mongoose.Types.ObjectId,
  type: UsageBalanceType,
  amount = 1
): Promise<UsageCheckResult> {
  if (!USAGE_GATES_ENABLED) {
    return { allowed: true, remaining: Infinity };
  }

  const check = await checkUsageBalance(schoolId, type);

  if (!check.hasBalance || check.remaining < amount) {
    const typeLabels: Record<UsageBalanceType, string> = {
      leo_credits: "Leo AI credits",
      meeting_participant_minutes: "meeting minutes",
      storage_bytes: "storage",
      learn_seats: "EduSentrix Learn seats",
      sms_credits: "SMS credits",
      whatsapp_credits: "WhatsApp credits",
    };
    return {
      allowed: false,
      reason: `Your school has insufficient ${typeLabels[type] ?? type}. Please contact EduSentrix to top up.`,
      remaining: check.remaining,
    };
  }

  return { allowed: true, remaining: check.remaining };
}
