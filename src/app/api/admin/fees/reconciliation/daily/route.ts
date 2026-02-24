import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import {
  RECONCILIATION_SLA_HOURS,
  runDeterministicReconciliation,
} from "@/lib/fees/reconciliation/deterministic";
import { syncReconciliationAlerts } from "@/lib/fees/reconciliation/alerts";

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireFinanceStaff();
    await connectToDatabase();

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj =
      userId && mongoose.Types.ObjectId.isValid(String(userId))
        ? new mongoose.Types.ObjectId(String(userId))
        : null;

    const mode = req.nextUrl.searchParams.get("mode") === "scheduled"
      ? "scheduled"
      : "manual";
    const body = await req
      .json()
      .catch(() => ({}) as { notes?: string | null });

    const result = await runDeterministicReconciliation({
      schoolId: schoolIdObj,
      userId: userIdObj,
      mode,
      notes: body.notes?.trim() || null,
    });
    const alerts = await syncReconciliationAlerts(schoolIdObj);

    return NextResponse.json({
      ok: true,
      runId: result.runId,
      mode,
      inspected:
        result.paymentStatusRefresh.inspected + result.summary.inspectedIngestion,
      updated: result.summary.paymentStatusUpdated,
      byStatus: {
        ...result.paymentStatusRefresh.byStatus,
        matched_ingestion: result.summary.matched,
        ambiguous_ingestion: result.summary.ambiguous,
      },
      slaHours: RECONCILIATION_SLA_HOURS,
      summary: result.summary,
      alerts,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run reconciliation.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
