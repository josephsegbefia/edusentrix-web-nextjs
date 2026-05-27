import "server-only";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import {
  getSchoolSubscriptionSnapshot,
  type SubscriptionSnapshot,
} from "@/lib/billing/entitlements";
import type { SubscriptionFeatureKey } from "@/lib/billing/feature-access";

/** No subscription feature gating — returns school snapshot when present. */
export async function requireFeatureForSchool(
  schoolId: string | mongoose.Types.ObjectId,
  _featureKey: SubscriptionFeatureKey
): Promise<SubscriptionSnapshot> {
  const snapshot = await getSchoolSubscriptionSnapshot(schoolId);

  if (!snapshot) {
    throw NextResponse.json(
      { success: false, error: "School not found." },
      { status: 404 }
    );
  }

  return snapshot;
}
