import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import {
  PLATFORM_BILLING_PROVIDER_LABELS,
  PLATFORM_BILLING_PROVIDERS,
} from "@/lib/platform-billing/providers";
import {
  getCurrentMonthRange,
  parseDateOnly,
} from "@/lib/platform-billing/period-range";
import { School } from "@/models/School";
import { UsageMetric } from "@/models/UsageMetric";
import { User } from "@/models/User";

const UsageMetricSchema = z.object({
  schoolId: z.string().trim().min(1),
  provider: z.enum(PLATFORM_BILLING_PROVIDERS),
  metricKey: z.string().trim().min(2).max(80),
  quantity: z.number().min(0),
  unitLabel: z.string().trim().min(1).max(40),
  unitCostMinor: z.number().min(0),
  allocationMethod: z.enum(["direct", "weighted", "manual"]),
  sourceType: z.enum(["manual", "provider_sync", "system_estimate"]).default("manual"),
  periodStart: z.string().trim().min(1),
  periodEnd: z.string().trim().min(1),
  notes: z.string().trim().max(240).nullable().optional().default(null),
});

type SchoolRow = {
  _id: mongoose.Types.ObjectId;
  name?: string;
  status?: string;
};

export async function GET(req: NextRequest) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const periodStart =
      parseDateOnly(req.nextUrl.searchParams.get("periodStart")) ||
      getCurrentMonthRange().periodStart;
    const periodEnd =
      parseDateOnly(req.nextUrl.searchParams.get("periodEnd")) ||
      getCurrentMonthRange().periodEnd;

    const [schools, metrics] = await Promise.all([
      School.find({}).select("name status").sort({ name: 1 }).lean<SchoolRow[]>(),
      UsageMetric.find({
        periodStart: { $gte: periodStart },
        periodEnd: { $lte: periodEnd },
      })
        .sort({ updatedAt: -1 })
        .lean(),
    ]);

    const schoolNameMap = new Map(
      schools.map((school) => [String(school._id), school.name || "Unnamed School"])
    );

    const aggregateMap = new Map<
      string,
      {
        schoolId: string;
        schoolName: string;
        totalEstimatedCostMinor: number;
        metricsCount: number;
        providers: Map<string, number>;
      }
    >();

    for (const metric of metrics) {
      const schoolId = String(metric.schoolId);
      const existing =
        aggregateMap.get(schoolId) ||
        {
          schoolId,
          schoolName: schoolNameMap.get(schoolId) || "Unnamed School",
          totalEstimatedCostMinor: 0,
          metricsCount: 0,
          providers: new Map<string, number>(),
        };

      const estimatedCostMinor = Number(metric.estimatedCostMinor || 0);
      existing.totalEstimatedCostMinor += estimatedCostMinor;
      existing.metricsCount += 1;
      existing.providers.set(
        metric.provider,
        (existing.providers.get(metric.provider) || 0) + estimatedCostMinor
      );
      aggregateMap.set(schoolId, existing);
    }

    return NextResponse.json({
      success: true,
      data: {
        periodStart: periodStart.toISOString().slice(0, 10),
        periodEnd: periodEnd.toISOString().slice(0, 10),
        providerOptions: PLATFORM_BILLING_PROVIDERS.map((provider) => ({
          value: provider,
          label: PLATFORM_BILLING_PROVIDER_LABELS[provider],
        })),
        schools: schools.map((school) => ({
          id: String(school._id),
          name: school.name || "Unnamed School",
          status: school.status || "pending",
        })),
        aggregates: Array.from(aggregateMap.values())
          .sort((a, b) => b.totalEstimatedCostMinor - a.totalEstimatedCostMinor)
          .map((row) => ({
            schoolId: row.schoolId,
            schoolName: row.schoolName,
            totalEstimatedCostMinor: row.totalEstimatedCostMinor,
            metricsCount: row.metricsCount,
            providers: Array.from(row.providers.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([provider, amountMinor]) => ({
                provider,
                label:
                  PLATFORM_BILLING_PROVIDER_LABELS[
                    provider as keyof typeof PLATFORM_BILLING_PROVIDER_LABELS
                  ] || provider,
                amountMinor,
              })),
          })),
        metrics: metrics.map((metric) => ({
          id: String(metric._id),
          schoolId: String(metric.schoolId),
          schoolName: schoolNameMap.get(String(metric.schoolId)) || "Unnamed School",
          provider: metric.provider,
          providerLabel:
            PLATFORM_BILLING_PROVIDER_LABELS[
              metric.provider as keyof typeof PLATFORM_BILLING_PROVIDER_LABELS
            ] || metric.provider,
          metricKey: metric.metricKey,
          quantity: Number(metric.quantity || 0),
          unitLabel: metric.unitLabel,
          unitCostMinor: Number(metric.unitCostMinor || 0),
          estimatedCostMinor: Number(metric.estimatedCostMinor || 0),
          allocationMethod: metric.allocationMethod,
          sourceType: metric.sourceType,
          periodStart: metric.periodStart.toISOString().slice(0, 10),
          periodEnd: metric.periodEnd.toISOString().slice(0, 10),
          notes: metric.notes || null,
          updatedAt: metric.updatedAt?.toISOString?.() || null,
        })),
      },
    });
  } catch (error) {
    console.error("Failed to load usage metrics:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load usage metrics",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const body = UsageMetricSchema.parse(await req.json());
    if (!mongoose.Types.ObjectId.isValid(body.schoolId)) {
      return NextResponse.json(
        { success: false, error: "Invalid school id." },
        { status: 400 }
      );
    }

    const [periodStart, periodEnd, actor] = [
      parseDateOnly(body.periodStart),
      parseDateOnly(body.periodEnd),
      await User.findById(gate.me._id).select("email").lean<{ email?: string } | null>(),
    ];

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { success: false, error: "Invalid usage period." },
        { status: 400 }
      );
    }

    const schoolId = new mongoose.Types.ObjectId(body.schoolId);
    const estimatedCostMinor = Math.max(
      0,
      Math.round(Number(body.quantity || 0) * Number(body.unitCostMinor || 0))
    );

    const updated = await UsageMetric.findOneAndUpdate(
      {
        schoolId,
        provider: body.provider,
        metricKey: body.metricKey,
        periodStart,
        periodEnd,
      },
      {
        $set: {
          quantity: body.quantity,
          unitLabel: body.unitLabel,
          unitCostMinor: body.unitCostMinor,
          estimatedCostMinor,
          allocationMethod: body.allocationMethod,
          sourceType: body.sourceType,
          notes: body.notes,
          updatedBy: gate.me._id,
          updatedByEmail: actor?.email || null,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        id: String(updated._id),
        schoolId: body.schoolId,
        provider: updated.provider,
        metricKey: updated.metricKey,
        estimatedCostMinor: updated.estimatedCostMinor,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid usage metric payload." },
        { status: 400 }
      );
    }

    console.error("Failed to upsert usage metric:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to upsert usage metric",
      },
      { status: 500 }
    );
  }
}
