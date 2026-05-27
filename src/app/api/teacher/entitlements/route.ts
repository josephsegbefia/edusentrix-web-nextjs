/**
 * GET /api/teacher/entitlements
 *
 * Returns a compact entitlement snapshot scoped to the teacher's school.
 * Includes only the features and usage data relevant to the teacher role.
 * The web backend is the authority — mobile/companion apps must call this.
 *
 * §17.3, §25.14
 */

import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { resolveSchoolEntitlements } from "@/lib/subscriptions/resolve-school-entitlements";
import { FEATURE_KEYS } from "@/lib/subscriptions/feature-keys";
import { roleCanReadFeature } from "@/lib/subscriptions/role-entitlement-rules";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireTeacher({ mode: "api" });
    const schoolId = String(ctx.schoolId);

    const snapshot = await resolveSchoolEntitlements(schoolId);
    if (!snapshot) {
      return NextResponse.json({ success: false, error: "School not found." }, { status: 404 });
    }

    // Teacher-relevant feature subset
    const teacherFeatureKeys = [
      FEATURE_KEYS.ACADEMICS_LESSON_NOTES,
      FEATURE_KEYS.ACADEMICS_SCHEMES,
      FEATURE_KEYS.ACADEMICS_LESSONS,
      FEATURE_KEYS.ACADEMICS_CURRICULUM,
      FEATURE_KEYS.ASSESSMENT_EXAMINATIONS,
      FEATURE_KEYS.ASSESSMENT_QUESTION_BANK,
      FEATURE_KEYS.AI_LEO,
      FEATURE_KEYS.AI_LESSON_GENERATION,
      FEATURE_KEYS.AI_EXAM_GENERATION,
      FEATURE_KEYS.AI_ANALYTICS,
      FEATURE_KEYS.LEARN_MANAGE,
      FEATURE_KEYS.MEETINGS_VIDEO,
      FEATURE_KEYS.ANALYTICS_BASIC,
      FEATURE_KEYS.ANALYTICS_ADVANCED,
    ] as const;

    const featureAccess: Record<string, boolean> = {};
    for (const key of teacherFeatureKeys) {
      // Feature must be both school-entitled and within teacher role rules
      featureAccess[key] = snapshot.hasFeature(key) && roleCanReadFeature("teacher", key);
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
        usage: {
          leoCreditsRemaining: snapshot.usage.leoCreditsRemaining,
          meetingParticipantMinutesRemaining: snapshot.usage.meetingParticipantMinutesRemaining,
        },
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json(
      { success: false, error: "Failed to resolve teacher entitlements." },
      { status: 500 }
    );
  }
}
