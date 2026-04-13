/**
 * Compatibility bridge: mirror selected normalized `AuditEvent` documents into the legacy
 * `Activity` feed when `policy.derivesActivityFeed` is true (spec §10.5).
 *
 * Implement when dual-writing routes begin emitting `AuditEvent`; call from the writer
 * or a background worker — not invoked automatically yet.
 */
export async function mirrorAuditEventToActivityFeed(
  _auditEventId: string
): Promise<void> {
  await Promise.resolve();
  // Intentionally empty — wire to `recordActivity` with a stable mapping table.
}
