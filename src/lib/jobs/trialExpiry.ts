import { connectToDatabase } from "@/db/connectToDatabase";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { SubscriptionEvent } from "@/models/SubscriptionEvent";

export async function runTrialExpiryJob(input?: { now?: Date }) {
  const now = input?.now || new Date();
  await connectToDatabase();

  const rows = await SchoolSubscription.find({
    status: "trial",
    pilotEndsAt: { $ne: null, $lte: now },
  }).select("_id schoolId tierCode tierName pilotEndsAt");

  let expiredTrials = 0;

  for (const subscription of rows) {
    subscription.status = "suspended";
    subscription.updatedBy = null;
    subscription.updatedByEmail = "system:trial-expiry";
    await subscription.save();

    await SubscriptionEvent.create({
      schoolId: subscription.schoolId,
      subscriptionId: subscription._id,
      eventType: "subscription_suspended",
      actorId: null,
      actorEmail: "system:trial-expiry",
      summary: `Trial period expired for ${subscription.tierName || subscription.tierCode || "the assigned tier"}.`,
      metadata: {
        reason: "trial_expired",
        pilotEndsAt: subscription.pilotEndsAt?.toISOString?.() || null,
        processedAt: now.toISOString(),
      },
    });

    expiredTrials += 1;
  }

  return {
    expiredTrials,
    processedAt: now.toISOString(),
  };
}
