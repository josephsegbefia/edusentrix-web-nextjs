import "server-only";

import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { runDeterministicReconciliation } from "@/lib/fees/reconciliation/deterministic";
import { syncReconciliationAlerts } from "@/lib/fees/reconciliation/alerts";
import { School } from "@/models/School";

export async function runScheduledFinanceReconciliation(limit = 50) {
  await connectToDatabase();
  const schoolIds = await School.find({ status: { $in: ["active", "pending"] } })
    .select("_id")
    .limit(Math.min(200, Math.max(1, limit)))
    .lean();

  const runs: Array<{ schoolId: string; runId?: string; error?: string }> = [];
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
        // counts only
        ...{
          updated: result.summary.paymentStatusUpdated,
          matched: result.summary.matched,
          ambiguous: result.summary.ambiguous,
          activeAlerts: alerts.activeAlerts,
        },
      });
    } catch (error) {
      runs.push({
        schoolId: String(schoolId),
        error: error instanceof Error ? error.message : "Failed scheduled reconciliation run.",
      });
    }
  }

  return {
    processedSchools: runs.length,
    completed: runs.filter((run) => !run.error).length,
    failed: runs.filter((run) => run.error).length,
  };
}
