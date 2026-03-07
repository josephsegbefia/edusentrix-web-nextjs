import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { parseDateOnly, getCurrentMonthRange } from "@/lib/platform-billing/period-range";
import { UsageMetric } from "@/models/UsageMetric";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid school id." },
        { status: 400 }
      );
    }

    const fallback = getCurrentMonthRange();
    const periodStart = parseDateOnly(req.nextUrl.searchParams.get("periodStart")) || fallback.periodStart;
    const periodEnd = parseDateOnly(req.nextUrl.searchParams.get("periodEnd")) || fallback.periodEnd;
    periodEnd.setUTCHours(23, 59, 59, 999);

    const schoolId = new mongoose.Types.ObjectId(id);
    const metrics = await UsageMetric.find({
      schoolId,
      periodStart: { $gte: periodStart },
      periodEnd: { $lte: periodEnd },
    })
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        periodStart: periodStart.toISOString().slice(0, 10),
        periodEnd: periodEnd.toISOString().slice(0, 10),
        totalEstimatedCostMinor: metrics.reduce(
          (sum, metric) => sum + Math.max(0, Math.round(Number(metric.estimatedCostMinor || 0))),
          0
        ),
        metrics: metrics.map((metric) => ({
          id: String(metric._id),
          provider: metric.provider,
          metricKey: metric.metricKey,
          quantity: Number(metric.quantity || 0),
          unitLabel: metric.unitLabel,
          estimatedCostMinor: Number(metric.estimatedCostMinor || 0),
          allocationMethod: metric.allocationMethod,
          sourceType: metric.sourceType,
          periodStart: metric.periodStart.toISOString().slice(0, 10),
          periodEnd: metric.periodEnd.toISOString().slice(0, 10),
          updatedAt: metric.updatedAt?.toISOString?.() || null,
        })),
      },
    });
  } catch (error) {
    console.error("Failed to load school usage metrics:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load school usage metrics",
      },
      { status: 500 }
    );
  }
}
