import "server-only";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import {
  getSchoolSubscriptionSnapshot,
  type SubscriptionSnapshot,
} from "@/lib/billing/entitlements";
import type { SubscriptionFeatureKey } from "@/lib/billing/feature-access";

export async function requireFeatureForSchool(
  schoolId: string | mongoose.Types.ObjectId,
  featureKey: SubscriptionFeatureKey
): Promise<SubscriptionSnapshot> {
  const snapshot = await getSchoolSubscriptionSnapshot(schoolId);

  if (!snapshot) {
    throw NextResponse.json(
      { success: false, error: "Subscription not found." },
      { status: 404 }
    );
  }

  if (snapshot.subscription.status === "suspended") {
    throw NextResponse.json(
      {
        success: false,
        error:
          "This school subscription is suspended. Access to this feature is blocked until reactivated.",
      },
      { status: 403 }
    );
  }

  if (snapshot.subscription.status === "cancelled") {
    throw NextResponse.json(
      {
        success: false,
        error:
          "This school subscription is cancelled. Access to this feature is blocked until a plan is reactivated.",
      },
      { status: 403 }
    );
  }

  if (!snapshot.hasFeature(featureKey)) {
    throw NextResponse.json(
      {
        success: false,
        error: `Your current subscription does not include ${featureKey}.`,
      },
      { status: 403 }
    );
  }

  return snapshot;
}
