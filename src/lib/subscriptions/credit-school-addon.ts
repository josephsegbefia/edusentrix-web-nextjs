import "server-only";

import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { SubscriptionAddOn, type AddOnType, type ISubscriptionAddOn } from "@/models/SubscriptionAddOn";
import { UsageBalance, type UsageBalanceType } from "@/models/UsageBalance";
import { recordSubscriptionEvent } from "@/lib/subscriptions/record-event";
import { isLearnSeatPerSeatPricing } from "@/lib/subscriptions/learn-seat-addon-pricing";

export { isLearnSeatPerSeatPricing, learnSeatReferenceTotalMinor } from "@/lib/subscriptions/learn-seat-addon-pricing";

const ADDON_TO_USAGE_TYPE: Partial<Record<AddOnType, UsageBalanceType>> = {
  leo_credits: "leo_credits",
  learn_seats: "learn_seats",
  meeting_minutes: "meeting_participant_minutes",
  storage_gb: "storage_bytes",
  sms_credits: "sms_credits",
  whatsapp_credits: "whatsapp_credits",
};

function quantityToCreditUnits(addonType: AddOnType, quantity: number): number {
  if (addonType === "storage_gb") return quantity * 1024 * 1024 * 1024;
  return quantity;
}

export async function creditSchoolAddOn(input: {
  schoolId: mongoose.Types.ObjectId;
  addon: Pick<ISubscriptionAddOn, "_id" | "addonType" | "quantity" | "subscriptionId">;
  actorEmail?: string | null;
}): Promise<{ credited: boolean; usageType?: UsageBalanceType }> {
  await connectToDatabase();

  const usageType = ADDON_TO_USAGE_TYPE[input.addon.addonType];
  if (!usageType) {
    return { credited: false };
  }

  const sub =
    input.addon.subscriptionId ??
    (
      await SchoolSubscription.findOne({ schoolId: input.schoolId })
        .select("_id")
        .lean<{ _id: mongoose.Types.ObjectId } | null>()
    )?._id;

  if (!sub) {
    return { credited: false };
  }

  const quantity = quantityToCreditUnits(input.addon.addonType, input.addon.quantity);

  await UsageBalance.findOneAndUpdate(
    {
      schoolId: input.schoolId,
      balanceType: usageType,
      periodKey: "school-lifetime",
    },
    {
      $inc: { purchasedQuantity: quantity },
      $setOnInsert: {
        schoolId: input.schoolId,
        balanceType: usageType,
        periodKey: "school-lifetime",
        includedQuantity: 0,
        usedQuantity: 0,
        adjustedQuantity: 0,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await recordSubscriptionEvent({
    schoolId: input.schoolId,
    subscriptionId: sub,
    eventType: "addon_credited",
    actorEmail: input.actorEmail ?? null,
    summary: `Add-on credited: ${input.addon.addonType} × ${input.addon.quantity}. Applied to usage balance.`,
    metadata: {
      addonId: String(input.addon._id),
      addonType: input.addon.addonType,
      quantity: input.addon.quantity,
      usageType,
    },
  });

  return { credited: true, usageType };
}

export async function markSchoolAddOnCredited(input: {
  addonId: mongoose.Types.ObjectId | string;
  schoolId: mongoose.Types.ObjectId;
  actorEmail?: string | null;
}): Promise<{ ok: true; addon: ISubscriptionAddOn } | { ok: false; error: string }> {
  await connectToDatabase();

  const addon = await SubscriptionAddOn.findOne({
    _id: input.addonId,
    schoolId: input.schoolId,
  });

  if (!addon) {
    return { ok: false, error: "Add-on not found." };
  }

  if (addon.status === "cancelled" || addon.status === "refunded") {
    return { ok: false, error: "Cannot credit a cancelled or refunded add-on." };
  }

  if (addon.status === "credited") {
    return { ok: true, addon };
  }

  const claimedAddon = await SubscriptionAddOn.findOneAndUpdate(
    {
      _id: addon._id,
      schoolId: input.schoolId,
      status: { $in: ["pending", "paid"] },
    },
    { $set: { status: "credited", creditedAt: new Date() } },
    { new: true },
  );

  if (!claimedAddon) {
    const latest = await SubscriptionAddOn.findOne({
      _id: input.addonId,
      schoolId: input.schoolId,
    });
    if (latest?.status === "credited") {
      return { ok: true, addon: latest };
    }
    return { ok: false, error: "Add-on could not be claimed for crediting." };
  }

  const credit = await creditSchoolAddOn({
    schoolId: input.schoolId,
    addon: claimedAddon,
    actorEmail: input.actorEmail,
  });

  if (!credit.credited) {
    await SubscriptionAddOn.updateOne(
      { _id: claimedAddon._id, schoolId: input.schoolId, status: "credited" },
      { $set: { status: addon.status, creditedAt: null } },
    );
    return { ok: false, error: "Could not apply add-on to school balance." };
  }

  return { ok: true, addon: claimedAddon };
}
