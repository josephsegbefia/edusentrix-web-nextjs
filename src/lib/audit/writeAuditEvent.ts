/**
 * Prefer `writeTransactionalAuditEvent` (Tier 0) or `writeRetryableAuditEvent` (Tier 1)
 * so callers explicitly choose the durability contract (EDUSENTRIX_AUDIT_HARDENING_SPEC §5).
 *
 * This module is reserved for a future unified entry that routes by policy tier once
 * all call sites pass sessions for Tier 0 consistently.
 */

export { writeTransactionalAuditEvent } from "./writeTransactionalAuditEvent";
export { writeRetryableAuditEvent } from "./writeRetryableAuditEvent";
