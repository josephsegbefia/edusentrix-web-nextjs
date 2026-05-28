/**
 * GET /api/platform/subscription-billing
 *
 * Aggregated subscription billing dashboard data:
 *  - Revenue by plan
 *  - Subscription status distribution
 *  - Schools by plan
 *  - Expiring/past-due/grace subscriptions
 *  - Add-on revenue
 *
 * Platform-admin only. Requires platform.billing.read.
 */

import { NextResponse } from "next/server";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { SubscriptionAddOn } from "@/models/SubscriptionAddOn";
import { School } from "@/models/School";

export async function GET() {
  const perm = await requirePlatformPermission("platform.billing.read");
  if (!perm.ok) return perm.res;

  await connectToDatabase();

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    statusDistribution,
    revenueByPlan,
    expiringCount,
    pastDueCount,
    gracePeriodCount,
    suspendedCount,
    totalActiveSchools,
    addonRevenue,
    addonsByType,
  ] = await Promise.all([
    // Status distribution
    SchoolSubscription.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    // Revenue by plan (effective price sum per tierCode)
    SchoolSubscription.aggregate([
      { $match: { status: "active", tierCode: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: { tierCode: "$tierCode", tierName: "$tierName" },
          totalRevenue: { $sum: "$effectivePriceMinor" },
          schoolCount: { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]),

    // Expiring in 30 days
    SchoolSubscription.countDocuments({
      status: "active",
      endsAt: { $gte: now, $lte: in30Days },
    }),

    // Past due
    SchoolSubscription.countDocuments({ status: "past_due" }),

    // Grace period
    SchoolSubscription.countDocuments({ status: "grace" }),

    // Suspended
    SchoolSubscription.countDocuments({ status: "suspended" }),

    // Total active
    School.countDocuments({ status: "active" }),

    // Add-on revenue (credited)
    SubscriptionAddOn.aggregate([
      { $match: { status: "credited" } },
      { $group: { _id: null, total: { $sum: "$priceMinor" } } },
    ]),

    // Add-ons by type (credited)
    SubscriptionAddOn.aggregate([
      { $match: { status: "credited" } },
      {
        $group: {
          _id: "$addonType",
          totalRevenue: { $sum: "$priceMinor" },
          count: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]),
  ]);

  // Build plan breakdown
  const planBreakdown = revenueByPlan.map((r) => ({
    planCode: r._id.tierCode,
    planName: r._id.tierName,
    schoolCount: r.schoolCount,
    totalRevenueMinor: r.totalRevenue,
  }));

  // Build status map
  const statusMap: Record<string, number> = {};
  for (const s of statusDistribution) {
    statusMap[s._id ?? "unknown"] = s.count;
  }

  const totalSubscriptions = Object.values(statusMap).reduce((a, b) => a + b, 0);
  const activeCount = statusMap["active"] ?? 0;

  return NextResponse.json({
    success: true,
    data: {
      overview: {
        totalSchools: totalActiveSchools,
        totalSubscriptions,
        activeSubscriptions: activeCount,
        expiringIn30Days: expiringCount,
        pastDue: pastDueCount,
        inGracePeriod: gracePeriodCount,
        suspended: suspendedCount,
        noSubscription: Math.max(0, totalActiveSchools - totalSubscriptions),
      },
      planBreakdown,
      statusDistribution: statusMap,
      addonRevenue: {
        totalMinor: addonRevenue[0]?.total ?? 0,
        byType: addonsByType.map((a) => ({
          addonType: a._id,
          count: a.count,
          totalQuantity: a.totalQuantity,
          totalRevenueMinor: a.totalRevenue,
        })),
      },
      generatedAt: new Date().toISOString(),
    },
  });
}
