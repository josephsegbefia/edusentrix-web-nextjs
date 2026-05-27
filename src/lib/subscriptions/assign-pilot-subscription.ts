/**
 * assignPilotSubscription
 *
 * Called automatically when a new school is created from the platform console.
 * Creates a SchoolSubscription in "pilot" status with sensible defaults.
 *
 * If the canonical Pilot tier exists in SubscriptionTier, it is linked.
 * If not, the subscription is still created with tierCode = "pilot" and
 * basePriceMinor = 0 (to be updated when the seed is run).
 *
 * Default pilot period: 30 days from creation.
 * Default pilot grace: 7 days after pilotEndsAt.
 *
 * Spec §5.1 + §15.
 */

import mongoose from "mongoose";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { SubscriptionTier } from "@/models/SubscriptionTier";
import { PLAN_CODES } from "@/lib/subscriptions/plan-codes";
import { recordSubscriptionEvent } from "./record-event";

type AssignPilotSubscriptionInput = {
  schoolId: mongoose.Types.ObjectId;
  actorEmail?: string | null;
  /** Pilot duration in days. Default 30. */
  pilotDays?: number;
  /** Grace period in days after pilot ends. Default 7. */
  graceDays?: number;
};

export async function assignPilotSubscription(input: AssignPilotSubscriptionInput): Promise<void> {
  const { schoolId, actorEmail, pilotDays = 30, graceDays = 7 } = input;

  // Check if a subscription already exists (idempotent guard)
  const existing = await SchoolSubscription.findOne({ schoolId });
  if (existing) return;

  // Attempt to find the seeded Pilot tier
  const pilotTier = await SubscriptionTier.findOne({ code: PLAN_CODES.PILOT }).lean<{
    _id: mongoose.Types.ObjectId;
    name?: string;
    version?: number;
    priceMinor?: number;
  } | null>();

  const now = new Date();
  const pilotEndsAt = new Date(now.getTime() + pilotDays * 24 * 60 * 60 * 1000);
  const gracePeriodEndsAt = new Date(pilotEndsAt.getTime() + graceDays * 24 * 60 * 60 * 1000);

  const sub = await SchoolSubscription.create({
    schoolId,
    tierId: pilotTier?._id ?? null,
    tierCode: PLAN_CODES.PILOT,
    tierName: pilotTier?.name ?? "EduSentrix Pilot",
    tierVersion: pilotTier?.version ?? null,
    status: "pilot",
    lifecycleMode: "pilot",
    billingCadence: "term",
    startsAt: now,
    endsAt: null,
    pilotStartsAt: now,
    pilotEndsAt,
    gracePeriodEndsAt,
    basePriceMinor: 0,
    manualPriceOverrideMinor: null,
    discountMode: "none",
    discountValue: null,
    effectivePriceMinor: 0,
    manualAccessModeOverride: null,
    updatedByEmail: actorEmail ?? null,
  });

  await recordSubscriptionEvent({
    schoolId,
    subscriptionId: sub._id,
    eventType: "subscription_assigned",
    actorEmail: actorEmail ?? null,
    summary: `Pilot subscription automatically assigned on school creation. Pilot period: ${pilotDays} days. Grace: ${graceDays} days.`,
    metadata: {
      pilotDays,
      graceDays,
      pilotEndsAt: pilotEndsAt.toISOString(),
      gracePeriodEndsAt: gracePeriodEndsAt.toISOString(),
      tierId: pilotTier ? String(pilotTier._id) : null,
    },
  });
}
