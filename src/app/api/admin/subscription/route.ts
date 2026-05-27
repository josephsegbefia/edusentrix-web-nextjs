/**
 * GET /api/admin/subscription
 *
 * Returns the current school's subscription snapshot for the school admin
 * billing/subscription page. Read-only — school admins cannot modify their subscription.
 */

import { NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { resolveSchoolEntitlements } from "@/lib/subscriptions/resolve-school-entitlements";

export async function GET() {
  const { schoolId } = await requireSchoolAdmin();

  const snapshot = await resolveSchoolEntitlements(schoolId);

  if (!snapshot) {
    return NextResponse.json(
      { success: false, error: "School not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      schoolId: snapshot.schoolId,
      schoolName: snapshot.schoolName,
      schoolStatus: snapshot.schoolStatus,
      paymentReady: snapshot.paymentReady,
      subscription: snapshot.subscription,
      features: snapshot.features,
      limits: snapshot.limits,
      usage: snapshot.usage,
      transactionChargeSummary: snapshot.transactionChargeSummary,
    },
  });
}
