import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { getPlatformRevenueSummary } from "@/lib/platform-billing/revenue-summary";

export async function GET(req: NextRequest) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const data = await getPlatformRevenueSummary({
      periodStart: req.nextUrl.searchParams.get("periodStart"),
      periodEnd: req.nextUrl.searchParams.get("periodEnd"),
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Failed to load platform usage revenue summary:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load platform usage revenue summary",
      },
      { status: 500 }
    );
  }
}
