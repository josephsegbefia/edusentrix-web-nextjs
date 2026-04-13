/**
 * Hook for Tier 1 dead letters, reconciliation drift, hash conflicts, etc.
 * Wire to PagerDuty / Slack / structured logs in production (spec §10.11–10.12).
 */
export type AuditAlertPayload = {
  type:
    | "tier1_dead_letter"
    | "tier1_retry_exhausted"
    | "reconciliation_drift"
    | "hash_stream_conflict"
    | "tier0_audit_failure";
  actionCode?: string;
  streamKey?: string;
  correlationId?: string | null;
  requestId?: string | null;
  routePath?: string | null;
  schoolId?: string | null;
  message: string;
  cause?: unknown;
};

export function registerAuditAlert(payload: AuditAlertPayload): void {
  const line = JSON.stringify({
    source: "edusentrix.audit",
    ...payload,
    at: new Date().toISOString(),
  });
  console.error(line);
}
