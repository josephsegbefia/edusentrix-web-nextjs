import { createHash } from "node:crypto";

/** 64-char hex genesis anchor for a new stream (spec §7.5) */
export const AUDIT_GENESIS_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Stable JSON for hashing: sorted keys, no undefined, consistent number formatting.
 */
export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (typeof value === "object" && value.constructor === Object) {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      const v = obj[key];
      if (v === undefined) continue;
      out[key] = sortKeysDeep(v);
    }
    return out;
  }
  return value;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export type HashChainInput = {
  previousHash: string;
  streamKey: string;
  streamSequence: number;
  actionCode: string;
  occurredAtIso: string;
  /** Integrity-relevant fields only — exclude eventHash */
  integrityPayload: Record<string, unknown>;
};

/**
 * Tamper-evident event hash: binds previous hash + stream position + action + canonical payload.
 */
export function computeAuditEventHash(parts: HashChainInput): string {
  const body = canonicalJsonStringify({
    actionCode: parts.actionCode,
    occurredAt: parts.occurredAtIso,
    streamKey: parts.streamKey,
    streamSequence: parts.streamSequence,
    previousHash: parts.previousHash,
    integrityPayload: parts.integrityPayload,
  });
  return sha256Hex(`${parts.previousHash}|${body}`);
}

export function utf8ByteLength(s: string): number {
  return Buffer.byteLength(s, "utf8");
}
