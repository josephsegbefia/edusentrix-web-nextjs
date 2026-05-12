import { connectToDatabase } from "@/db/connectToDatabase";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { SubscriptionEvent } from "@/models/SubscriptionEvent";

const DEFAULT_GRACE_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addGrace(now: Date) {
  return new Date(now.getTime() + DEFAULT_GRACE_DAYS * MS_PER_DAY);
}

export async function runTrialExpiryJob(input?: { now?: Date }) {
  const now = input?.now || new Date();
  await connectToDatabase();

  const endingRows = await SchoolSubscription.find({
    $or: [
      { status: { $in: ["trial", "trialing"] }, trialEndsAt: { $ne: null, $lte: now } },
      { status: "trial", pilotEndsAt: { $ne: null, $lte: now } },
      { status: "pilot", pilotEndsAt: { $ne: null, $lte: now } },
      { status: { $in: ["active", "past_due"] }, endsAt: { $ne: null, $lte: now } },
    ],
  }).select(
    "_id schoolId tierCode tierName status endsAt trialEndsAt pilotEndsAt gracePeriodEndsAt"
  );

  const graceRows = await SchoolSubscription.find({
    status: "grace",
    gracePeriodEndsAt: { $ne: null, $lte: now },
  }).select("_id schoolId tierCode tierName status gracePeriodEndsAt");

  let movedToGrace = 0;
  let movedToReadOnly = 0;

  for (const subscription of endingRows) {
    if (subscription.status === "grace") continue;
    const previousStatus = subscription.status;
    subscription.status = "grace";
    subscription.gracePeriodEndsAt = subscription.gracePeriodEndsAt || addGrace(now);
    subscription.updatedBy = null;
    subscription.updatedByEmail = "system:trial-expiry";
    await subscription.save();

    await SubscriptionEvent.create({
      schoolId: subscription.schoolId,
      subscriptionId: subscription._id,
      eventType: "subscription_updated",
      actorId: null,
      actorEmail: "system:trial-expiry",
      summary: `Subscription moved to grace for ${subscription.tierName || subscription.tierCode || "the assigned tier"}.`,
      metadata: {
        reason: "subscription_period_ended",
        previousStatus,
        endsAt: subscription.endsAt?.toISOString?.() || null,
        trialEndsAt: subscription.trialEndsAt?.toISOString?.() || null,
        pilotEndsAt: subscription.pilotEndsAt?.toISOString?.() || null,
        gracePeriodEndsAt:
          subscription.gracePeriodEndsAt?.toISOString?.() || null,
        processedAt: now.toISOString(),
      },
    });

    movedToGrace += 1;
  }

  for (const subscription of graceRows) {
    subscription.status = "restricted_read_only";
    subscription.updatedBy = null;
    subscription.updatedByEmail = "system:trial-expiry";
    await subscription.save();

    await SubscriptionEvent.create({
      schoolId: subscription.schoolId,
      subscriptionId: subscription._id,
      eventType: "subscription_updated",
      actorId: null,
      actorEmail: "system:trial-expiry",
      summary: `Grace period ended for ${subscription.tierName || subscription.tierCode || "the assigned tier"}.`,
      metadata: {
        reason: "grace_period_ended",
        previousStatus: "grace",
        gracePeriodEndsAt:
          subscription.gracePeriodEndsAt?.toISOString?.() || null,
        processedAt: now.toISOString(),
      },
    });

    movedToReadOnly += 1;
  }

  return {
    movedToGrace,
    movedToReadOnly,
    processedAt: now.toISOString(),
  };
}
