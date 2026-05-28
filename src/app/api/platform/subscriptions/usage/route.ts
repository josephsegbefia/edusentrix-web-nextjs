/**
 * GET /api/platform/subscriptions/usage
 *
 * Returns a cross-school usage summary for the platform usage dashboard.
 * Spec §14.8.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { UsageBalance } from "@/models/UsageBalance";
import { School } from "@/models/School";
import mongoose from "mongoose";

export async function GET(req: NextRequest) {
  const perm = await requirePlatformPermission("platform.billing.read");
  if (!perm.ok) return perm.res;

  await connectToDatabase();

  const url = new URL(req.url);
  const metricKey = url.searchParams.get("metricKey") ?? null;
  const search = url.searchParams.get("search") ?? null;
  const lowOnly = url.searchParams.get("lowOnly") === "true";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const LIMIT = 25;
  const skip = (page - 1) * LIMIT;

  // Aggregate usage balances grouped by school
  const pipeline: mongoose.PipelineStage[] = [
    ...(metricKey ? [{ $match: { metricKey } } as mongoose.PipelineStage] : []),
    {
      $group: {
        _id: "$schoolId",
        metrics: {
          $push: {
            metricKey: "$metricKey",
            used: "$usedQuantity",
            purchased: "$purchasedQuantity",
            planAllocation: "$planAllocationQuantity",
          },
        },
      },
    },
    { $sort: { _id: 1 as const } },
  ];

  const usageRows: Array<{
    _id: mongoose.Types.ObjectId;
    metrics: Array<{
      metricKey: string;
      used: number;
      purchased: number;
      planAllocation: number;
    }>;
  }> = await UsageBalance.aggregate(pipeline);

  // Fetch school names
  const schoolIds = usageRows.map((r) => r._id);
  const nameMap: Record<string, string> = {};
  if (schoolIds.length) {
    const schools = await School.find({ _id: { $in: schoolIds } })
      .select("name")
      .lean<Array<{ _id: mongoose.Types.ObjectId; name?: string }>>();
    for (const s of schools) nameMap[String(s._id)] = s.name ?? "Unknown";
  }

  // Filter by search
  let filtered = usageRows;
  if (search) {
    filtered = filtered.filter((r) =>
      nameMap[String(r._id)]?.toLowerCase().includes(search.toLowerCase())
    );
  }

  // Filter low-balance schools (< 20% remaining)
  if (lowOnly) {
    filtered = filtered.filter((r) =>
      r.metrics.some((m) => {
        const total = m.planAllocation + m.purchased;
        if (total === 0) return false;
        const remaining = total - m.used;
        return remaining / total < 0.2;
      })
    );
  }

  const total = filtered.length;
  const paginated = filtered.slice(skip, skip + LIMIT);

  // Platform-level totals
  const totalsByKey: Record<string, { used: number; total: number }> = {};
  for (const row of usageRows) {
    for (const m of row.metrics) {
      if (!totalsByKey[m.metricKey]) totalsByKey[m.metricKey] = { used: 0, total: 0 };
      totalsByKey[m.metricKey].used += m.used;
      totalsByKey[m.metricKey].total += m.planAllocation + m.purchased;
    }
  }

  return NextResponse.json({
    success: true,
    platformTotals: totalsByKey,
    data: paginated.map((r) => ({
      schoolId: String(r._id),
      schoolName: nameMap[String(r._id)] ?? "Unknown",
      metrics: r.metrics.map((m) => ({
        ...m,
        total: m.planAllocation + m.purchased,
        remaining: m.planAllocation + m.purchased - m.used,
        pctUsed: m.planAllocation + m.purchased > 0
          ? Math.round((m.used / (m.planAllocation + m.purchased)) * 100)
          : 0,
      })),
    })),
    pagination: { page, limit: LIMIT, total, pages: Math.ceil(total / LIMIT) },
  });
}
