import type { AuditAction } from "@/models/ApplicationAudit";
import { ApplicationAudit } from "@/models/ApplicationAudit";
import type { PaymentAuditEventType } from "@/models/PaymentAuditEvent";
import { PaymentAuditEvent } from "@/models/PaymentAuditEvent";
import { AuditEvent } from "@/models/AuditEvent";
import { connectToDatabase } from "@/db/connectToDatabase";

const APPLICATION_TO_AUDIT: Partial<Record<AuditAction, string>> = {
  submitted: "application.submitted",
  approved: "application.approved",
  rejected: "application.rejected",
};

const PAYMENT_TO_AUDIT: Partial<Record<PaymentAuditEventType, string>> = {
  payment_recorded: "payment.recorded",
  payment_duplicate_detected: "payment.duplicate_override.accepted",
  payment_approved: "payment.proof_approved",
  payment_rejected: "payment.proof_rejected",
  payment_reversed: "payment.reversed",
};

export type DomainAuditDriftRow =
  | {
      kind: "application";
      applicationAuditId: string;
      applicationId: string;
      action: AuditAction;
      expectedActionCode: string;
    }
  | {
      kind: "payment";
      paymentAuditEventId: string;
      paymentId: string;
      eventType: PaymentAuditEventType;
      expectedActionCode: string;
    };

/**
 * Compare legacy domain audit rows to normalized `AuditEvent` (dual-write parity).
 * Used by `scripts/audit-reconcile.ts` and ops; not a substitute for hash verification.
 */
export async function reconcileDomainAuditParity(input: {
  sinceDays?: number;
}): Promise<{
  since: string;
  applicationAuditsChecked: number;
  paymentAuditsChecked: number;
  drift: DomainAuditDriftRow[];
  driftCount: number;
}> {
  await connectToDatabase();

  const since = new Date();
  since.setDate(since.getDate() - (input.sinceDays ?? 7));

  const drift: DomainAuditDriftRow[] = [];

  const appAudits = await ApplicationAudit.find({ createdAt: { $gte: since } })
    .select("_id applicationId action")
    .lean();

  for (const row of appAudits) {
    const action = row.action as AuditAction;
    const expectedActionCode = APPLICATION_TO_AUDIT[action];
    if (!expectedActionCode) continue;
    const found = await AuditEvent.findOne({
      targetEntityId: row.applicationId,
      actionCode: expectedActionCode,
    })
      .select("_id")
      .lean();
    if (!found) {
      drift.push({
        kind: "application",
        applicationAuditId: String(row._id),
        applicationId: String(row.applicationId),
        action,
        expectedActionCode,
      });
    }
  }

  const payAudits = await PaymentAuditEvent.find({ createdAt: { $gte: since } })
    .select("_id paymentId eventType")
    .lean();

  for (const row of payAudits) {
    const eventType = row.eventType as PaymentAuditEventType;
    const expectedActionCode = PAYMENT_TO_AUDIT[eventType];
    if (!expectedActionCode) continue;
    const found = await AuditEvent.findOne({
      targetEntityId: row.paymentId,
      actionCode: expectedActionCode,
    })
      .select("_id")
      .lean();
    if (!found) {
      drift.push({
        kind: "payment",
        paymentAuditEventId: String(row._id),
        paymentId: String(row.paymentId),
        eventType,
        expectedActionCode,
      });
    }
  }

  return {
    since: since.toISOString(),
    applicationAuditsChecked: appAudits.length,
    paymentAuditsChecked: payAudits.length,
    drift,
    driftCount: drift.length,
  };
}
