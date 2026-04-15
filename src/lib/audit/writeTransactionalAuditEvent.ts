import type { ClientSession } from "mongoose";
import { Types } from "mongoose";
import { AuditEvent, type IAuditEvent } from "@/models/AuditEvent";
import { appendAuditEventWithHashChain } from "./appendAuditStreamEvent";
import { AuditPolicyError, AuditValidationError } from "./errors";
import { getAuditPolicy } from "./policy";
import type {
  AuditApproval,
  AuditPayloadFields,
  AuditReason,
  AuditRequestContext,
  AuditResult,
  AuditScopeType,
  AuditTarget,
} from "./types";
import { validateAllForPolicy } from "./validateAuditPayload";
import { buildAuditEventDocBase, buildIntegrityPayload } from "./buildAuditEventDoc";

/**
 * Tier 0 audit write: must run in the same Mongo session as the domain mutation when possible.
 */
export async function writeTransactionalAuditEvent(
  session: ClientSession,
  input: {
    actionCode: string;
    scopeType: AuditScopeType;
    scopeId: string | null;
    result: AuditResult;
    occurredAt?: Date;
    recordedAt?: Date;
    target: AuditTarget;
    context: AuditRequestContext;
    payload: AuditPayloadFields;
    reason?: AuditReason;
    approval?: AuditApproval;
    /** Required when policy.requiresHashChain (e.g. `school:<id>` or `platform`) */
    streamKey?: string | null;
  }
): Promise<IAuditEvent> {
  const policy = getAuditPolicy(input.actionCode);
  if (policy.tier !== 0) {
    throw new AuditPolicyError(
      `writeTransactionalAuditEvent requires Tier 0 policy; got tier ${policy.tier} for ${input.actionCode}`
    );
  }

  validateAllForPolicy(
    policy,
    input.payload,
    input.reason,
    input.context.idempotencyKey
  );

  const scopeObjectId =
    input.scopeType === "school" && input.scopeId
      ? new Types.ObjectId(input.scopeId)
      : null;

  if (input.scopeType === "school" && !scopeObjectId) {
    throw new AuditValidationError(
      "school-scoped audit events require scopeId (school id)"
    );
  }

  const recordedAt = input.recordedAt ?? new Date();
  const occurredAt = input.occurredAt ?? recordedAt;

  const doc = buildAuditEventDocBase({
    policy,
    actionCode: input.actionCode,
    scopeType: input.scopeType,
    scopeId: scopeObjectId,
    result: input.result,
    occurredAt,
    recordedAt,
    target: input.target,
    context: input.context,
    payload: input.payload,
    reason: input.reason,
    approval: input.approval,
  });

  const integrity = buildIntegrityPayload({
    policy,
    actionCode: input.actionCode,
    scopeType: input.scopeType,
    scopeId: scopeObjectId,
    result: input.result,
    payload: input.payload,
    target: input.target,
  });

  if (policy.requiresHashChain) {
    const sk = input.streamKey?.trim();
    if (!sk) {
      throw new AuditValidationError(
        `action "${input.actionCode}" requires streamKey for hash chain`
      );
    }
    return appendAuditEventWithHashChain(session, {
      streamKey: sk,
      doc,
      integrityPayload: integrity,
    });
  }

  const [created] = await AuditEvent.create([doc], { session });
  return created as IAuditEvent;
}
