import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { getCurrentMonthRange, parseDateOnly } from "@/lib/platform-billing/period-range";
import { School } from "@/models/School";
import { UsageMetric } from "@/models/UsageMetric";

function resolveMonthlyWindow(input: {
  periodStart?: string | null;
  periodEnd?: string | null;
  year?: string | null;
  month?: string | null;
}) {
  const explicitStart = parseDateOnly(input.periodStart || null);
  const explicitEnd = parseDateOnly(input.periodEnd || null);
  if (explicitStart && explicitEnd) {
    explicitEnd.setUTCHours(23, 59, 59, 999);
    return { periodStart: explicitStart, periodEnd: explicitEnd };
  }

  const year = Number(input.year || 0);
  const month = Number(input.month || 0);
  if (Number.isInteger(year) && year > 2000 && Number.isInteger(month) && month >= 1 && month <= 12) {
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { periodStart, periodEnd };
  }

  return getCurrentMonthRange();
}

export async function GET(req: NextRequest) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const schoolId = req.nextUrl.searchParams.get("schoolId");
    if (schoolId && !mongoose.Types.ObjectId.isValid(schoolId)) {
      return NextResponse.json(
        { success: false, error: "Invalid school id." },
        { status: 400 }
      );
    }

    const { periodStart, periodEnd } = resolveMonthlyWindow({
      periodStart: req.nextUrl.searchParams.get("periodStart"),
      periodEnd: req.nextUrl.searchParams.get("periodEnd"),
      year: req.nextUrl.searchParams.get("year"),
      month: req.nextUrl.searchParams.get("month"),
    });

    const filter: {
      periodStart: { $gte: Date };
      periodEnd: { $lte: Date };
      schoolId?: mongoose.Types.ObjectId;
    } = {
      periodStart: { $gte: periodStart },
      periodEnd: { $lte: periodEnd },
    };

    if (schoolId) {
      filter.schoolId = new mongoose.Types.ObjectId(schoolId);
    }

    const [schools, metrics] = await Promise.all([
      School.find({})
        .select("name")
        .lean<Array<{ _id: mongoose.Types.ObjectId; name?: string }>>(),
      UsageMetric.find(filter).lean(),
    ]);

    const schoolNames = new Map(
      schools.map((school) => [String(school._id), school.name || "Unnamed School"])
    );
    const totalsByProvider = new Map<string, number>();
    const totalsBySchool = new Map<
      string,
      { schoolId: string; schoolName: string; metricsCount: number; totalEstimatedCostMinor: number }
    >();

    let totalEstimatedCostMinor = 0;
    let totalQuantity = 0;

    for (const metric of metrics) {
      const schoolKey = String(metric.schoolId);
      const amountMinor = Math.max(0, Math.round(Number(metric.estimatedCostMinor || 0)));
      const quantity = Math.max(0, Number(metric.quantity || 0));
      totalEstimatedCostMinor += amountMinor;
      totalQuantity += quantity;
      totalsByProvider.set(metric.provider, (totalsByProvider.get(metric.provider) || 0) + amountMinor);

      const schoolEntry =
        totalsBySchool.get(schoolKey) ||
        {
          schoolId: schoolKey,
          schoolName: schoolNames.get(schoolKey) || "Unnamed School",
          metricsCount: 0,
          totalEstimatedCostMinor: 0,
        };
      schoolEntry.metricsCount += 1;
      schoolEntry.totalEstimatedCostMinor += amountMinor;
      totalsBySchool.set(schoolKey, schoolEntry);
    }

    return NextResponse.json({
      success: true,
      data: {
        periodStart: periodStart.toISOString().slice(0, 10),
        periodEnd: periodEnd.toISOString().slice(0, 10),
        metricsCount: metrics.length,
        schoolsCount: totalsBySchool.size,
        totalQuantity,
        totalEstimatedCostMinor,
        providers: Array.from(totalsByProvider.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([provider, amountMinor]) => ({ provider, amountMinor })),
        schools: Array.from(totalsBySchool.values()).sort(
          (a, b) => b.totalEstimatedCostMinor - a.totalEstimatedCostMinor
        ),
      },
    });
  } catch (error) {
    console.error("Failed to load platform usage summary:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load platform usage summary",
      },
      { status: 500 }
    );
  }
}
