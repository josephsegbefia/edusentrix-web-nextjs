/**
 * GET /api/platform/subscription-notifications
 *
 * Runs the subscription health scan and returns a list of alerts.
 * Platform admin only. Used by the notification centre and the billing dashboard badge.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { runSubscriptionHealthScan } from "@/lib/subscriptions/health-scan";

export async function GET(req: NextRequest) {
  const perm = await requirePlatformPermission("platform.billing.read");
  if (!perm.ok) return perm.res;

  await connectToDatabase();

  const url = new URL(req.url);
  const expiringSoonDays = parseInt(url.searchParams.get("expiringSoonDays") ?? "30", 10);
  const severityFilter = url.searchParams.get("severity") ?? null;

  const result = await runSubscriptionHealthScan({ expiringSoonDays });

  const alerts = severityFilter
    ? result.alerts.filter((a) => a.severity === severityFilter)
    : result.alerts;

  return NextResponse.json({
    success: true,
    data: {
      alerts,
      summary: result.summary,
      scannedAt: result.scannedAt,
    },
  });
}
