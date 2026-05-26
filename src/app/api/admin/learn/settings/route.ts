import { NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { getSchoolLearnEligibility } from "@/lib/learn/eligibility";
import {
  getOrCreateLearnPlatformSettings,
  serializeLearnPlatformSettings,
} from "@/lib/learn/platform-settings";

export async function GET() {
  try {
    const ctx = await requireSchoolAdmin();
    const [eligibility, settings] = await Promise.all([
      getSchoolLearnEligibility(ctx.schoolId),
      getOrCreateLearnPlatformSettings(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        eligibility,
        platformSettings: serializeLearnPlatformSettings(settings),
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[admin/learn/settings:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Learn settings." },
      { status: 500 }
    );
  }
}
