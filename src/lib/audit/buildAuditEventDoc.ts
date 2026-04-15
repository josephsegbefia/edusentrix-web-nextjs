import { Types } from "mongoose";
import type { IAuditEvent } from "@/models/AuditEvent";
import type {
  AuditApproval,
  AuditPayloadFields,
  AuditPolicyEntry,
  AuditReason,
  AuditRequestContext,
  AuditResult,
  AuditScopeType,
  AuditTarget,
} from "./types";
import { canonicalJsonStringify, sha256Hex } from "./hash-chain";
import { toObjectId } from "./objectIds";

export function buildAuditEventDocBase(params: {
  policy: AuditPolicyEntry;
  actionCode: string;
  scopeType: AuditScopeType;
  scopeId: Types.ObjectId | null;
  result: AuditResult;
  occurredAt: Date;
  recordedAt: Date;
  target: AuditTarget;
  context: AuditRequestContext;
  payload: AuditPayloadFields;
  reason?: AuditReason;
  approval?: AuditApproval;
}): Omit<
  IAuditEvent,
  "_id" | "streamKey" | "streamSequence" | "previousHash" | "eventHash"
> {
  const { policy, actionCode, scopeType, scopeId, result, occurredAt, recordedAt } =
    params;
  const { target, context, payload, reason, approval } = params;

  return {
    scopeType,
    scopeId,
    domain: policy.domain,
    tier: policy.tier,
    actionCode,
    result,
    occurredAt,
    recordedAt,
    actorType: context.actorType,
    actorId: toObjectId(context.actorId ?? undefined),
    actorRole: context.actorRole ?? null,
    actorEmail: context.actorEmail ?? null,
    actorName: context.actorName ?? null,
    targetEntityType: target.targetEntityType,
    targetEntityId:
      typeof target.targetEntityId === "string"
        ? new Types.ObjectId(target.targetEntityId)
        : target.targetEntityId,
    secondaryEntityType: target.secondaryEntityType ?? null,
    secondaryEntityId: toObjectId(target.secondaryEntityId ?? undefined),
    reviewedById: toObjectId(approval?.reviewedById ?? undefined),
    reviewedByRole: approval?.reviewedByRole ?? null,
    approvedById: toObjectId(approval?.approvedById ?? undefined),
    approvedByRole: approval?.approvedByRole ?? null,
    reasonCode: reason?.reasonCode ?? null,
    reason: reason?.reason ?? null,
    requestId: context.requestId ?? null,
    correlationId: context.correlationId ?? null,
    idempotencyKey: context.idempotencyKey ?? null,
    ipAddress: context.ipAddress ?? null,
    userAgent: context.userAgent ?? null,
    routePath: context.routePath ?? null,
    clientSurface: context.clientSurface ?? null,
    before: payload.before ?? null,
    after: payload.after ?? null,
    changedFields: payload.changedFields ?? null,
    metadata: payload.metadata ?? null,
    sensitivity: policy.sensitivity,
    redactionMode: "none",
    retentionClass: policy.retentionClass,
    archivedAt: null,
  };
}

/** Bound into the hash chain without duplicating full before/after blobs. */
export function buildIntegrityPayload(params: {
  policy: AuditPolicyEntry;
  actionCode: string;
  scopeType: AuditScopeType;
  scopeId: Types.ObjectId | null;
  result: AuditResult;
  payload: AuditPayloadFields;
  target: AuditTarget;
}): Record<string, unknown> {
  const scopeIdStr = params.scopeId ? String(params.scopeId) : null;
  const targetId =
    typeof params.target.targetEntityId === "string"
      ? params.target.targetEntityId
      : String(params.target.targetEntityId);

  const payloadFingerprint = sha256Hex(
    canonicalJsonStringify({
      before: params.payload.before ?? null,
      after: params.payload.after ?? null,
      changedFields: params.payload.changedFields ?? null,
      metadata: params.payload.metadata ?? null,
    })
  );

  return {
    tier: params.policy.tier,
    domain: params.policy.domain,
    scopeType: params.scopeType,
    scopeId: scopeIdStr,
    actionCode: params.actionCode,
    result: params.result,
    targetEntityType: params.target.targetEntityType,
    targetEntityId: targetId,
    payloadFingerprint,
  };
}
