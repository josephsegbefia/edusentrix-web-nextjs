import { NextResponse } from "next/server";
import { requireParent } from "@/lib/auth/requireParent";
import { getSchoolSubscriptionSnapshot } from "@/lib/billing/entitlements";

const parentFeatureKeys = [
  "parent.dashboard",
  "parent.wards",
  "parent.academics",
  "parent.attendance",
  "parent.fees",
  "parent.payments",
  "parent.paymentHistory",
  "parent.reports",
  "parent.calendar",
  "parent.messages",
  "parent.notifications",
  "parent.lessons",
  "parent.library",
  "parent.meetings",
  "parent.store",
  "parent.supplyLists",
  "parent.documents",
  "parent.polls",
  "parent.actionCenter",
] as const;

export async function GET() {
  try {
    const ctx = await requireParent();
    const snapshot = await getSchoolSubscriptionSnapshot(ctx.schoolId);
    const features = Object.fromEntries(
      parentFeatureKeys.map((key) => [key, true])
    ) as Record<(typeof parentFeatureKeys)[number], boolean>;

    return NextResponse.json({
      success: true,
      data: {
        features,
        schoolName: snapshot?.schoolName ?? null,
        planName: null,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Failed to load entitlements";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
