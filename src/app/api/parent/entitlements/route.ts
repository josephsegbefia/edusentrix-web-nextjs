/**
 * GET /api/parent/entitlements
 *
 * Returns a compact entitlement snapshot scoped to the parent's school.
 * Includes the features and access mode relevant to the parent role.
 * The web backend is the authority — mobile/companion apps must call this.
 *
 * §17.3, §25.14
 */

import { NextResponse } from "next/server";
import { requireParent } from "@/lib/auth/requireParent";
import { resolveSchoolEntitlements } from "@/lib/subscriptions/resolve-school-entitlements";
import { FEATURE_KEYS } from "@/lib/subscriptions/feature-keys";
import { roleCanReadFeature } from "@/lib/subscriptions/role-entitlement-rules";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireParent({ mode: "api" });
    const schoolId = String(ctx.schoolId);

    const snapshot = await resolveSchoolEntitlements(schoolId);
    if (!snapshot) {
      return NextResponse.json({ success: false, error: "School not found." }, { status: 404 });
    }

    // Parent-relevant feature subset
    const parentFeatureKeys = [
      FEATURE_KEYS.FINANCE_PAYMENTS,
      FEATURE_KEYS.FINANCE_PARENT_PAYMENTS,
      FEATURE_KEYS.ADMISSIONS,
      FEATURE_KEYS.ADMISSION_FEES,
      FEATURE_KEYS.COMMUNICATION_NOTICES,
      FEATURE_KEYS.COMMUNICATION_MESSAGING,
      FEATURE_KEYS.LEARN_STUDENT_ACCESS,
      FEATURE_KEYS.MEETINGS_VIDEO,
    ] as const;

    const featureAccess: Record<string, boolean> = {};
    for (const key of parentFeatureKeys) {
      featureAccess[key] = snapshot.hasFeature(key) && roleCanReadFeature("parent", key);
    }

    return NextResponse.json({
      success: true,
      data: {
        schoolId: snapshot.schoolId,
        subscription: {
          status: snapshot.subscription.status,
          accessMode: snapshot.subscription.accessMode,
          planCode: snapshot.subscription.planCode,
          planName: snapshot.subscription.planName,
          endsAt: snapshot.subscription.endsAt,
          gracePeriodEndsAt: snapshot.subscription.gracePeriodEndsAt,
        },
        featureAccess,
        // Payment charge summary so the mobile app can display fees honestly
        transactionChargeSummary: snapshot.transactionChargeSummary,
        paymentReady: snapshot.paymentReady,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json(
      { success: false, error: "Failed to resolve parent entitlements." },
      { status: 500 }
    );
  }
}
