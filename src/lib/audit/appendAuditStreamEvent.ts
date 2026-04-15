import type { ClientSession } from "mongoose";
import { AuditEvent, type IAuditEvent } from "@/models/AuditEvent";
import { AuditStreamHead } from "@/models/AuditStreamHead";
import { AUDIT_GENESIS_HASH, computeAuditEventHash } from "./hash-chain";

type DocWithoutChain = Omit<
  IAuditEvent,
  "_id" | "streamSequence" | "previousHash" | "eventHash"
>;

/**
 * Append a Tier 0 / Tier 1 auditable event with hash-chain fields inside an existing Mongo session.
 * Stream writes are serialized per `streamKey` via `AuditStreamHead` (spec §7.7).
 */
export async function appendAuditEventWithHashChain(
  session: ClientSession,
  params: {
    streamKey: string;
    doc: DocWithoutChain;
    integrityPayload: Record<string, unknown>;
  }
): Promise<IAuditEvent> {
  const { streamKey, doc, integrityPayload } = params;

  const head = await AuditStreamHead.findOneAndUpdate(
    { streamKey },
    { $inc: { lastSeq: 1 } },
    { upsert: true, new: true, session }
  );

  if (!head) {
    throw new Error("AuditStreamHead findOneAndUpdate returned empty");
  }

  const seq = head.lastSeq;
  const prevDoc =
    seq <= 1
      ? null
      : await AuditEvent.findOne({ streamKey, streamSequence: seq - 1 }).session(
          session
        );

  const previousHash = prevDoc?.eventHash ?? AUDIT_GENESIS_HASH;
  const occurredAtIso = doc.occurredAt.toISOString();

  const eventHash = computeAuditEventHash({
    previousHash,
    streamKey,
    streamSequence: seq,
    actionCode: doc.actionCode,
    occurredAtIso,
    integrityPayload,
  });

  const [created] = await AuditEvent.create(
    [
      {
        ...doc,
        streamKey,
        streamSequence: seq,
        previousHash,
        eventHash,
      },
    ],
    { session }
  );

  await AuditStreamHead.updateOne(
    { streamKey },
    { $set: { lastHash: eventHash } },
    { session }
  );

  return created!;
}
