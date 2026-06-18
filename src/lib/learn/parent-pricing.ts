import "server-only";

import type { Types } from "mongoose";
import { getOrCreateLearnPlatformSettings } from "@/lib/learn/platform-settings";
import { SubscriptionAddOn } from "@/models/SubscriptionAddOn";

export type ParentLearnPrice = {
  pricePerStudentPerTermMinor: number;
  currency: "GHS";
  source: "school_learn_seat_addon" | "platform_learn_settings";
};

export async function resolveParentLearnPriceForSchool(
  schoolId: Types.ObjectId,
): Promise<ParentLearnPrice> {
  const [settings, schoolSeatPrice] = await Promise.all([
    getOrCreateLearnPlatformSettings(),
    SubscriptionAddOn.findOne({
      schoolId,
      addonType: "learn_seats",
      status: "credited",
      priceMinor: { $gt: 0 },
    })
      .sort({ creditedAt: -1, createdAt: -1 })
      .select("priceMinor")
      .lean<{ priceMinor?: number | null } | null>(),
  ]);

  if (schoolSeatPrice?.priceMinor && schoolSeatPrice.priceMinor > 0) {
    return {
      pricePerStudentPerTermMinor: Math.round(Number(schoolSeatPrice.priceMinor)),
      currency: settings.currency || "GHS",
      source: "school_learn_seat_addon",
    };
  }

  return {
    pricePerStudentPerTermMinor: Math.max(
      0,
      Math.round(Number(settings.pricePerStudentPerTermMinor || 0)),
    ),
    currency: settings.currency || "GHS",
    source: "platform_learn_settings",
  };
}
