import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import {
  normalizeSubscriptionStatus,
  type SubscriptionStatus,
} from "@/lib/platform-billing/subscription-pricing";

export type SchoolAccessMode =
  | "full"
  | "trial_limited"
  | "pilot_limited"
  | "grace"
  | "restricted_read_only"
  | "suspended";

type SubscriptionAccessShape = {
  status?: SubscriptionStatus | string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  trialEndsAt?: Date | null;
  pilotEndsAt?: Date | null;
  gracePeriodEndsAt?: Date | null;
  manualAccessModeOverride?: SchoolAccessMode | null;
};

function normalizeSchoolId(schoolId: string | mongoose.Types.ObjectId) {
  return typeof schoolId === "string"
    ? new mongoose.Types.ObjectId(schoolId)
    : schoolId;
}

function isPast(date?: Date | null, now = new Date()) {
  return date instanceof Date && date.getTime() < now.getTime();
}

export function resolveAccessModeFromSubscription(
  subscription?: SubscriptionAccessShape | null,
  now = new Date()
): SchoolAccessMode {
  if (!subscription) return "suspended";

  if (subscription.manualAccessModeOverride) {
    return subscription.manualAccessModeOverride;
  }

  const status = normalizeSubscriptionStatus(subscription.status);

  if (status === "active") {
    if (isPast(subscription.endsAt, now)) {
      return isPast(subscription.gracePeriodEndsAt, now)
        ? "restricted_read_only"
        : "grace";
    }

    return "full";
  }

  if (status === "trialing") {
    if (isPast(subscription.trialEndsAt || subscription.endsAt, now)) {
      return isPast(subscription.gracePeriodEndsAt, now)
        ? "restricted_read_only"
        : "grace";
    }

    return "trial_limited";
  }

  if (status === "pilot") {
    if (isPast(subscription.pilotEndsAt || subscription.endsAt, now)) {
      return isPast(subscription.gracePeriodEndsAt, now)
        ? "restricted_read_only"
        : "grace";
    }

    return "pilot_limited";
  }

  if (status === "grace" || status === "past_due") {
    return isPast(subscription.gracePeriodEndsAt, now)
      ? "restricted_read_only"
      : "grace";
  }

  if (status === "restricted_read_only" || status === "expired") {
    return "restricted_read_only";
  }

  return "suspended";
}

export async function resolveSchoolAccessMode(
  schoolId: string | mongoose.Types.ObjectId
): Promise<SchoolAccessMode> {
  await connectToDatabase();

  const subscription = await SchoolSubscription.findOne({
    schoolId: normalizeSchoolId(schoolId),
  })
    .select(
      "status startsAt endsAt trialEndsAt pilotEndsAt gracePeriodEndsAt manualAccessModeOverride"
    )
    .lean<SubscriptionAccessShape | null>();

  return resolveAccessModeFromSubscription(subscription);
}
