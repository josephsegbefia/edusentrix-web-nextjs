import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AUDIT_GENESIS_HASH,
  canonicalJsonStringify,
  computeAuditEventHash,
  sha256Hex,
  utf8ByteLength,
} from "../src/lib/audit/hash-chain";

test("canonicalJsonStringify sorts object keys", () => {
  const a = canonicalJsonStringify({ z: 1, a: { m: 2, b: 3 } });
  const b = canonicalJsonStringify({ a: { b: 3, m: 2 }, z: 1 });
  assert.equal(a, b);
});

test("computeAuditEventHash is stable for same inputs", () => {
  const h1 = computeAuditEventHash({
    previousHash: AUDIT_GENESIS_HASH,
    streamKey: "school:507f1f77bcf86cd799439011",
    streamSequence: 1,
    actionCode: "payment.recorded",
    occurredAtIso: "2026-04-12T12:00:00.000Z",
    integrityPayload: { x: 1 },
  });
  const h2 = computeAuditEventHash({
    previousHash: AUDIT_GENESIS_HASH,
    streamKey: "school:507f1f77bcf86cd799439011",
    streamSequence: 1,
    actionCode: "payment.recorded",
    occurredAtIso: "2026-04-12T12:00:00.000Z",
    integrityPayload: { x: 1 },
  });
  assert.equal(h1, h2);
  assert.equal(h1.length, 64);
});

test("sha256Hex produces 64 hex chars", () => {
  assert.equal(sha256Hex("edusentrix").length, 64);
});

test("utf8ByteLength counts multi-byte", () => {
  assert.equal(utf8ByteLength("a"), 1);
  assert.equal(utf8ByteLength("é"), 2);
});
