import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AuditEvent, type IAuditEvent } from "@/models/AuditEvent";
import { appendAuditEventWithHashChain } from "./appendAuditStreamEvent";
import { AuditPolicyError, AuditValidationError, AuditWriteDeadLetterError } from "./errors";
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
import { registerAuditAlert } from "./registerAuditAlert";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_ATTEMPTS = 6;

/**
 * Tier 1 audit: durable retry in-process until success or dead-letter (spec §5.2, §5.6).
 * Outbox / queue workers can replace this body in a later phase without changing call sites.
 */
export async function writeRetryableAuditEvent(input: {
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
  streamKey?: string | null;
}): Promise<IAuditEvent> {
  const policy = getAuditPolicy(input.actionCode);
  if (policy.tier !== 1) {
    throw new AuditPolicyError(
      `writeRetryableAuditEvent requires Tier 1 policy; got tier ${policy.tier} for ${input.actionCode}`
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

  let backoffMs = 50;
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      await connectToDatabase();
      const session = await mongoose.startSession();
      let created: IAuditEvent | undefined;
      try {
        await session.withTransaction(async () => {
          if (policy.requiresHashChain) {
            const sk = input.streamKey?.trim();
            if (!sk) {
              throw new AuditValidationError(
                `action "${input.actionCode}" requires streamKey for hash chain`
              );
            }
            created = await appendAuditEventWithHashChain(session, {
              streamKey: sk,
              doc,
              integrityPayload: integrity,
            });
          } else {
            const [row] = await AuditEvent.create([doc], { session });
            created = row as IAuditEvent;
          }
        });
      } finally {
        await session.endSession();
      }

      if (created) return created;
      throw new Error("AuditEvent create returned empty");
    } catch (err) {
      lastError = err;
      if (attempt === MAX_ATTEMPTS - 1) break;
      await sleep(backoffMs);
      backoffMs = Math.min(backoffMs * 2, 2000);
    }
  }

  registerAuditAlert({
    type: "tier1_retry_exhausted",
    actionCode: input.actionCode,
    streamKey: input.streamKey ?? undefined,
    correlationId: input.context.correlationId,
    requestId: input.context.requestId,
    routePath: input.context.routePath ?? undefined,
    schoolId: input.scopeId ?? undefined,
    message: `Tier 1 audit write failed after ${MAX_ATTEMPTS} attempts`,
    cause: lastError,
  });

  throw new AuditWriteDeadLetterError(
    `Tier 1 audit write failed for ${input.actionCode}`,
    lastError
  );
}
