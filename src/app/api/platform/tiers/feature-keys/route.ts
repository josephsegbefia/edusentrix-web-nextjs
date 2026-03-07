import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { SubscriptionTier } from "@/models/SubscriptionTier";

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  analytics: "Access advanced analytics and reporting surfaces.",
  ai_reports: "Use Leo-generated summaries and AI report workflows.",
  parent_payments: "Accept parent fee payments through EduSentrix.",
  disbursements: "Initiate teacher and vendor payouts.",
  timetable: "Use timetable planning and publishing features.",
  attendance: "Track student and staff attendance.",
  community: "Use community tools such as polls and fundraising.",
};

export async function GET() {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const tiers = await SubscriptionTier.find({})
      .select("features")
      .lean<Array<{ features?: string[] }>>();

    const keys = new Set<string>();
    for (const tier of tiers) {
      for (const feature of Array.isArray(tier.features) ? tier.features : []) {
        const normalized = feature.trim();
        if (normalized) keys.add(normalized);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        featureKeys: Array.from(keys)
          .sort((a, b) => a.localeCompare(b))
          .map((key) => ({
            key,
            description:
              FEATURE_DESCRIPTIONS[key] ||
              "Feature key discovered from active subscription tier configuration.",
          })),
      },
    });
  } catch (error) {
    console.error("Failed to load subscription feature keys:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load subscription feature keys",
      },
      { status: 500 }
    );
  }
}
