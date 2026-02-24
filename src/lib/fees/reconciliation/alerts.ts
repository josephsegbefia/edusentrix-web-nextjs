import mongoose from "mongoose";
import { Payment } from "@/models/Payment";
import { ReconciliationIngestion } from "@/models/ReconciliationIngestion";
import { ReconciliationAlert } from "@/models/ReconciliationAlert";

export const RECON_ALERT_DEFS = {
  stale_pending_approvals: {
    severity: "critical" as const,
    title: "Pending approvals breached SLA",
    description:
      "Proof payments older than 24 hours are waiting for review.",
    queue: "pending_approval",
  },
  stale_reconciliation_queue: {
    severity: "warning" as const,
    title: "Reconciliation queue aging",
    description:
      "Completed payments older than 48 hours are still not fully reconciled.",
    queue: "needs_reconciliation",
  },
  ambiguous_ingestion_items: {
    severity: "warning" as const,
    title: "Ambiguous reconciliation matches",
    description:
      "Some bank/gateway ingestion rows match multiple payments and need manual review.",
    queue: "reconciliation_console",
  },
  unmatched_ingestion_aging: {
    severity: "info" as const,
    title: "Unmatched ingestion aging",
    description:
      "Some ingestion rows have remained unmatched for more than 48 hours.",
    queue: "reconciliation_console",
  },
};

type AlertKey = keyof typeof RECON_ALERT_DEFS;

export type ReconciliationAlertSnapshot = {
  stalePendingApprovals: number;
  staleReconciliation: number;
  ambiguousIngestion: number;
  unmatchedAging: number;
  activeAlerts: number;
};

export async function syncReconciliationAlerts(
  schoolId: mongoose.Types.ObjectId
): Promise<ReconciliationAlertSnapshot> {
  const now = new Date();
  const stalePendingCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const staleReconciliationCutoff = new Date(
    now.getTime() - 48 * 60 * 60 * 1000
  );
  const unmatchedIngestionCutoff = staleReconciliationCutoff;

  const [
    stalePendingApprovals,
    staleReconciliation,
    ambiguousIngestion,
    unmatchedAging,
  ] = await Promise.all([
    Payment.countDocuments({
      schoolId,
      status: "pending",
      approvalStatus: "pending",
      createdAt: { $lte: stalePendingCutoff },
    }),
    Payment.countDocuments({
      schoolId,
      status: "completed",
      reconciliationStatus: { $ne: "fully_reconciled" },
      paymentDate: { $lte: staleReconciliationCutoff },
    }),
    ReconciliationIngestion.countDocuments({
      schoolId,
      status: "ambiguous",
    }),
    ReconciliationIngestion.countDocuments({
      schoolId,
      status: "unmatched",
      transactionDate: { $lte: unmatchedIngestionCutoff },
    }),
  ]);

  const countsByKey: Record<AlertKey, number> = {
    stale_pending_approvals: stalePendingApprovals,
    stale_reconciliation_queue: staleReconciliation,
    ambiguous_ingestion_items: ambiguousIngestion,
    unmatched_ingestion_aging: unmatchedAging,
  };

  for (const key of Object.keys(RECON_ALERT_DEFS) as AlertKey[]) {
    const count = countsByKey[key];
    const def = RECON_ALERT_DEFS[key];

    if (count > 0) {
      await ReconciliationAlert.findOneAndUpdate(
        { schoolId, alertKey: key },
        {
          $set: {
            schoolId,
            alertKey: key,
            severity: def.severity,
            title: def.title,
            description: def.description,
            queue: def.queue,
            count,
            status: "active",
            lastDetectedAt: now,
            resolvedAt: null,
          },
          $setOnInsert: {
            firstDetectedAt: now,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } else {
      await ReconciliationAlert.updateOne(
        { schoolId, alertKey: key, status: "active" },
        {
          $set: {
            status: "resolved",
            count: 0,
            lastDetectedAt: now,
            resolvedAt: now,
          },
        }
      );
    }
  }

  const activeAlerts = await ReconciliationAlert.countDocuments({
    schoolId,
    status: "active",
  });

  return {
    stalePendingApprovals,
    staleReconciliation,
    ambiguousIngestion,
    unmatchedAging,
    activeAlerts,
  };
}
