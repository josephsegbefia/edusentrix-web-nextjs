import mongoose from "mongoose";
import { computeSubscriptionPricing } from "@/lib/platform-billing/subscription-pricing";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { SubscriptionCheckoutIntent } from "@/models/SubscriptionCheckoutIntent";
import { SubscriptionEvent } from "@/models/SubscriptionEvent";
import { SubscriptionTier } from "@/models/SubscriptionTier";

export async function applySuccessfulSubscriptionCheckoutIntent(input: {
  checkoutIntentId?: mongoose.Types.ObjectId | string | null;
  paystackReference?: string | null;
  paidAt?: Date | null;
}) {
  const query =
    input.checkoutIntentId && mongoose.Types.ObjectId.isValid(String(input.checkoutIntentId))
      ? { _id: new mongoose.Types.ObjectId(String(input.checkoutIntentId)) }
      : input.paystackReference
        ? { paystackReference: input.paystackReference }
        : null;

  if (!query) {
    return null;
  }

  const intent = await SubscriptionCheckoutIntent.findOne(query);
  if (!intent) {
    return null;
  }

  if (intent.status === "succeeded" && intent.subscriptionId) {
    const subscription = await SchoolSubscription.findById(intent.subscriptionId);
    return subscription ? { intent, subscription } : null;
  }

  const [tier, existingSubscription] = await Promise.all([
    SubscriptionTier.findById(intent.targetTierId).select("code name priceMinor"),
    SchoolSubscription.findOne({ schoolId: intent.schoolId }),
  ]);

  if (!tier) {
    intent.status = "failed";
    intent.failureReason = "Requested subscription tier no longer exists.";
    await intent.save();
    return null;
  }

  const discountMode = existingSubscription?.discountMode || "none";
  const discountValue =
    discountMode === "none" ? null : existingSubscription?.discountValue ?? null;
  const pricing = computeSubscriptionPricing({
    basePriceMinor: tier.priceMinor,
    manualPriceOverrideMinor: null,
    discountMode,
    discountValue,
  });

  const previousStatus = existingSubscription?.status || "draft";
  const subscription = await SchoolSubscription.findOneAndUpdate(
    { schoolId: intent.schoolId },
    {
      $set: {
        tierId: tier._id,
        tierCode: tier.code,
        tierName: tier.name,
        status: "active",
        basePriceMinor: tier.priceMinor,
        manualPriceOverrideMinor: null,
        discountMode,
        discountValue,
        effectivePriceMinor: pricing.finalPriceMinor,
        pilotEndsAt: null,
        updatedBy: intent.requestedBy || null,
        updatedByEmail: intent.requestedByEmail || null,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  await SubscriptionEvent.create({
    schoolId: intent.schoolId,
    subscriptionId: subscription._id,
    eventType: existingSubscription
      ? previousStatus === "suspended" || previousStatus === "cancelled"
        ? "subscription_reactivated"
        : "subscription_updated"
      : "subscription_assigned",
    actorId: intent.requestedBy || null,
    actorEmail: intent.requestedByEmail || null,
    summary: `Subscription checkout completed for ${tier.name}.`,
    metadata: {
      tierId: String(tier._id),
      tierCode: tier.code,
      paystackReference: input.paystackReference || intent.paystackReference || null,
      paidAt: input.paidAt?.toISOString?.() || null,
      preservedDiscountMode: discountMode,
      preservedDiscountValue: discountValue,
    },
  });

  intent.subscriptionId = subscription._id;
  intent.status = "succeeded";
  intent.appliedAt = input.paidAt || new Date();
  intent.failureReason = null;
  if (input.paystackReference) {
    intent.paystackReference = input.paystackReference;
  }
  await intent.save();

  return { intent, subscription };
}
