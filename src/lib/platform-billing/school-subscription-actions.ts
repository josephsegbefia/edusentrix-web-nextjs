import mongoose from "mongoose";
import { computeSubscriptionPricing, type SubscriptionDiscountMode, type SubscriptionStatus } from "@/lib/platform-billing/subscription-pricing";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { SubscriptionEvent, type SubscriptionEventType } from "@/models/SubscriptionEvent";

function resolveStatusEventType(previousStatus: string, nextStatus: SubscriptionStatus): SubscriptionEventType {
  if (nextStatus === "cancelled") return "subscription_cancelled";
  if (nextStatus === "suspended") return "subscription_suspended";
  if (
    previousStatus === "suspended" &&
    (nextStatus === "active" || nextStatus === "trial")
  ) {
    return "subscription_reactivated";
  }
  return "subscription_updated";
}

export async function updateSchoolSubscriptionCommercialTerms(input: {
  schoolId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;
  actorEmail: string | null;
  manualPriceOverrideMinor?: number | null;
  discountMode?: SubscriptionDiscountMode;
  discountValue?: number | null;
  note?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
}) {
  const subscription = await SchoolSubscription.findOne({ schoolId: input.schoolId });
  if (!subscription) return null;

  const nextManualOverride =
    input.manualPriceOverrideMinor !== undefined
      ? input.manualPriceOverrideMinor
      : subscription.manualPriceOverrideMinor ?? null;
  const nextDiscountMode = input.discountMode || subscription.discountMode || "none";
  const nextDiscountValue =
    nextDiscountMode === "none"
      ? null
      : input.discountValue !== undefined
        ? input.discountValue
        : subscription.discountValue ?? null;
  const nextNote = input.note !== undefined ? input.note : subscription.note || null;

  const pricing = computeSubscriptionPricing({
    basePriceMinor: subscription.basePriceMinor,
    manualPriceOverrideMinor: nextManualOverride,
    discountMode: nextDiscountMode,
    discountValue: nextDiscountValue,
  });

  subscription.manualPriceOverrideMinor = nextManualOverride;
  subscription.discountMode = nextDiscountMode;
  subscription.discountValue = nextDiscountValue;
  subscription.effectivePriceMinor = pricing.finalPriceMinor;
  subscription.note = nextNote;
  subscription.updatedBy = input.actorId;
  subscription.updatedByEmail = input.actorEmail;
  await subscription.save();

  await SubscriptionEvent.create({
    schoolId: input.schoolId,
    subscriptionId: subscription._id,
    eventType: "subscription_updated",
    actorId: input.actorId,
    actorEmail: input.actorEmail,
    summary: input.summary,
    metadata: {
      manualPriceOverrideMinor: nextManualOverride,
      discountMode: nextDiscountMode,
      discountValue: nextDiscountValue,
      effectivePriceMinor: pricing.finalPriceMinor,
      ...(input.metadata || {}),
    },
  });

  return { subscription, pricing };
}

export async function updateSchoolSubscriptionStatus(input: {
  schoolId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;
  actorEmail: string | null;
  status: SubscriptionStatus;
  summary: string;
  metadata?: Record<string, unknown> | null;
}) {
  const subscription = await SchoolSubscription.findOne({ schoolId: input.schoolId });
  if (!subscription) return null;

  const previousStatus = subscription.status;
  subscription.status = input.status;
  subscription.updatedBy = input.actorId;
  subscription.updatedByEmail = input.actorEmail;
  await subscription.save();

  await SubscriptionEvent.create({
    schoolId: input.schoolId,
    subscriptionId: subscription._id,
    eventType: resolveStatusEventType(previousStatus, input.status),
    actorId: input.actorId,
    actorEmail: input.actorEmail,
    summary: input.summary,
    metadata: input.metadata || null,
  });

  return subscription;
}
