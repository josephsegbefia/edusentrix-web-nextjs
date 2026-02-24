/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import { runDeterministicReconciliation } from "@/lib/fees/reconciliation/deterministic";
import { syncReconciliationAlerts } from "@/lib/fees/reconciliation/alerts";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest) {
  const secret = process.env.RECONCILIATION_CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get("authorization") || "";
  const xSecret = req.headers.get("x-cron-secret") || "";
  return bearer === `Bearer ${secret}` || xSecret === secret;
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const limit = Math.min(
      200,
      Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 50))
    );
    const schoolFilter: Record<string, unknown> = {
      status: { $in: ["active", "pending"] },
    };
    const schoolIds = await School.find(schoolFilter)
      .select("_id")
      .limit(limit)
      .lean();

    const runs: Array<{
      schoolId: string;
      runId?: string;
      updated?: number;
      matched?: number;
      ambiguous?: number;
      activeAlerts?: number;
      error?: string;
    }> = [];

    for (const school of schoolIds) {
      const schoolId =
        school._id instanceof mongoose.Types.ObjectId
          ? school._id
          : new mongoose.Types.ObjectId(String(school._id));
      try {
        const result = await runDeterministicReconciliation({
          schoolId,
          mode: "scheduled",
          notes: "Scheduled reconciliation run",
        });
        const alerts = await syncReconciliationAlerts(schoolId);
        runs.push({
          schoolId: String(schoolId),
          runId: result.runId,
          updated: result.summary.paymentStatusUpdated,
          matched: result.summary.matched,
          ambiguous: result.summary.ambiguous,
          activeAlerts: alerts.activeAlerts,
        });
      } catch (error: any) {
        runs.push({
          schoolId: String(schoolId),
          error: error?.message || "Failed scheduled reconciliation run.",
        });
      }
    }

    const completed = runs.filter((run) => !run.error).length;
    const failed = runs.length - completed;
    const updatedPayments = runs.reduce(
      (sum, run) => sum + Number(run.updated || 0),
      0
    );
    const matchedIngestion = runs.reduce(
      (sum, run) => sum + Number(run.matched || 0),
      0
    );
    const ambiguousIngestion = runs.reduce(
      (sum, run) => sum + Number(run.ambiguous || 0),
      0
    );

    return NextResponse.json({
      ok: true,
      processedSchools: runs.length,
      completed,
      failed,
      updatedPayments,
      matchedIngestion,
      ambiguousIngestion,
      runs,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Scheduled reconciliation job failed.",
      },
      { status: 500 }
    );
  }
}
