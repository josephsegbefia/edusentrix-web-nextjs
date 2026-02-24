/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { ReconciliationAlert } from "@/models/ReconciliationAlert";
import { syncReconciliationAlerts } from "@/lib/fees/reconciliation/alerts";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));
    const refresh = req.nextUrl.searchParams.get("refresh") !== "false";

    let snapshot = null as Awaited<
      ReturnType<typeof syncReconciliationAlerts>
    > | null;
    if (refresh) {
      snapshot = await syncReconciliationAlerts(schoolIdObj);
    }

    const [activeAlerts, recentResolved] = await Promise.all([
      ReconciliationAlert.find({
        schoolId: schoolIdObj,
        status: "active",
      })
        .sort({ severity: 1, lastDetectedAt: -1 })
        .limit(20)
        .lean(),
      ReconciliationAlert.find({
        schoolId: schoolIdObj,
        status: "resolved",
      })
        .sort({ resolvedAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const serialize = (alert: any) => ({
      id: String(alert._id),
      alertKey: alert.alertKey,
      severity: alert.severity,
      title: alert.title,
      description: alert.description,
      queue: alert.queue || null,
      count: Number(alert.count || 0),
      status: alert.status,
      firstDetectedAt: alert.firstDetectedAt,
      lastDetectedAt: alert.lastDetectedAt,
      resolvedAt: alert.resolvedAt || null,
    });

    return NextResponse.json({
      success: true,
      data: {
        snapshot,
        active: activeAlerts.map(serialize),
        recentResolved: recentResolved.map(serialize),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to fetch reconciliation alerts.",
      },
      { status: 500 }
    );
  }
}
