/**
 * GET /api/student/entitlements
 *
 * Returns a compact entitlement snapshot for the student's school.
 * Exposes only the features relevant to the student role.
 * The web backend is the authority — mobile/companion apps must call this,
 * including EduSentrix Learn mobile access checks.
 *
 * §17.3, §25.14
 */

import { NextResponse } from "next/server";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { resolveSchoolEntitlements } from "@/lib/subscriptions/resolve-school-entitlements";
import { FEATURE_KEYS } from "@/lib/subscriptions/feature-keys";
import { roleCanReadFeature } from "@/lib/subscriptions/role-entitlement-rules";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireSchoolMember({ allowedRoles: ["student"] });
    const schoolId = String(ctx.schoolId);

    const snapshot = await resolveSchoolEntitlements(schoolId);
    if (!snapshot) {
      return NextResponse.json({ success: false, error: "School not found." }, { status: 404 });
    }

    // Student-relevant feature subset
    const studentFeatureKeys = [
      FEATURE_KEYS.ACADEMICS_LESSONS,
      FEATURE_KEYS.LEARN_STUDENT_ACCESS,
      FEATURE_KEYS.COMMUNICATION_NOTICES,
      FEATURE_KEYS.ANALYTICS_BASIC,
    ] as const;

    const featureAccess: Record<string, boolean> = {};
    for (const key of studentFeatureKeys) {
      featureAccess[key] = snapshot.hasFeature(key) && roleCanReadFeature("student", key);
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
        },
        featureAccess,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json(
      { success: false, error: "Failed to resolve student entitlements." },
      { status: 500 }
    );
  }
}
