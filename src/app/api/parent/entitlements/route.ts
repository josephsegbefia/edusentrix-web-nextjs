import { NextResponse } from "next/server";
import { requireParent } from "@/lib/auth/requireParent";
import { getSchoolSubscriptionSnapshot } from "@/lib/billing/entitlements";

const parentFeatureMap = {
  "parent.dashboard": "core_school_ops",
  "parent.wards": "students",
  "parent.academics": "reports",
  "parent.attendance": "core_school_ops",
  "parent.fees": "fees",
  "parent.payments": "parent_payments",
  "parent.paymentHistory": "parent_payments",
  "parent.reports": "reports",
  "parent.calendar": "core_school_ops",
  "parent.messages": "community",
  "parent.notifications": "community",
  "parent.lessons": "lesson_notes",
  "parent.library": "core_school_ops",
  "parent.meetings": "community",
  "parent.store": "parent_payments",
  "parent.supplyLists": "core_school_ops",
  "parent.documents": "students",
  "parent.polls": "community",
  "parent.actionCenter": "core_school_ops",
} as const;

export async function GET() {
  try {
    const ctx = await requireParent();
    const snapshot = await getSchoolSubscriptionSnapshot(ctx.schoolId);
    const features: Record<string, boolean> = {};

    for (const [parentKey, subscriptionKey] of Object.entries(parentFeatureMap)) {
      features[parentKey] = snapshot ? snapshot.hasFeature(subscriptionKey) : true;
    }

    for (const alwaysEnabled of [
      "parent.dashboard",
      "parent.wards",
      "parent.attendance",
      "parent.calendar",
      "parent.notifications",
      "parent.actionCenter",
    ]) {
      features[alwaysEnabled] = true;
    }

    return NextResponse.json({
      success: true,
      data: {
        features,
        schoolName: snapshot?.schoolName ?? null,
        planName: snapshot?.subscription.tierName ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Failed to load entitlements";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
