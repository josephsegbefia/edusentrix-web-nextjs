import type { AuditPolicyEntry } from "./types";
import { AuditValidationError } from "./errors";
import { canonicalJsonStringify, utf8ByteLength } from "./hash-chain";
import type { AuditPayloadFields } from "./types";

function combinedPayloadJson(payload: AuditPayloadFields): string {
  return canonicalJsonStringify({
    before: payload.before ?? null,
    after: payload.after ?? null,
    changedFields: payload.changedFields ?? null,
    metadata: payload.metadata ?? null,
  });
}

export function validateAuditPayloadSize(
  policy: AuditPolicyEntry,
  payload: AuditPayloadFields
): void {
  const json = combinedPayloadJson(payload);
  const bytes = utf8ByteLength(json);
  if (bytes > policy.maxPayloadBytes) {
    throw new AuditValidationError(
      `Audit payload exceeds maxPayloadBytes (${bytes} > ${policy.maxPayloadBytes})`
    );
  }
}

export function validateProhibitedPayloadContent(
  policy: AuditPolicyEntry,
  payload: AuditPayloadFields
): void {
  const json = combinedPayloadJson(payload).toLowerCase();
  for (const needle of policy.prohibitedPayloadSubstrings) {
    const n = needle.toLowerCase();
    if (n.length > 0 && json.includes(n)) {
      throw new AuditValidationError(
        `Audit payload contains prohibited pattern "${needle}"`
      );
    }
  }
}

export function validateReasonRequirement(
  policy: AuditPolicyEntry,
  reason: { reasonCode?: string | null; reason?: string | null } | undefined
): void {
  if (!policy.requiresReason) return;
  const hasCode = Boolean(reason?.reasonCode && String(reason.reasonCode).trim());
  const hasText = Boolean(reason?.reason && String(reason.reason).trim());
  if (!hasCode && !hasText) {
    throw new AuditValidationError(
      "Audit policy requires reasonCode and/or reason for this action"
    );
  }
}

export function validateBeforeAfterRequirement(
  policy: AuditPolicyEntry,
  payload: AuditPayloadFields
): void {
  if (!policy.requiresBeforeAfter) return;
  const hasBefore = payload.before != null && Object.keys(payload.before).length > 0;
  const hasAfter = payload.after != null && Object.keys(payload.after).length > 0;
  const hasChanged =
    payload.changedFields != null && payload.changedFields.length > 0;
  if (!hasBefore && !hasAfter && !hasChanged) {
    throw new AuditValidationError(
      "Audit policy requires before/after or changedFields for this action"
    );
  }
}

export function validateIdempotencyRequirement(
  policy: AuditPolicyEntry,
  idempotencyKey: string | undefined
): void {
  if (!policy.requiresIdempotencyKey) return;
  if (!idempotencyKey || !String(idempotencyKey).trim()) {
    throw new AuditValidationError(
      "Audit policy requires idempotencyKey for this action"
    );
  }
}

export function validateAllForPolicy(
  policy: AuditPolicyEntry,
  payload: AuditPayloadFields,
  reason: { reasonCode?: string | null; reason?: string | null } | undefined,
  idempotencyKey: string | undefined
): void {
  validateAuditPayloadSize(policy, payload);
  validateProhibitedPayloadContent(policy, payload);
  validateReasonRequirement(policy, reason);
  validateBeforeAfterRequirement(policy, payload);
  validateIdempotencyRequirement(policy, idempotencyKey);
}
