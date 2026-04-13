import assert from "node:assert/strict";
import { test } from "node:test";
import { getAuditPolicy } from "../src/lib/audit/policy";
import {
  validateAllForPolicy,
  validateProhibitedPayloadContent,
} from "../src/lib/audit/validateAuditPayload";
import { AuditValidationError } from "../src/lib/audit/errors";

test("validateProhibitedPayloadContent rejects bearer token", () => {
  const policy = getAuditPolicy("payment.recorded");
  assert.throws(
    () =>
      validateProhibitedPayloadContent(policy, {
        metadata: { note: "Authorization: bearer secret" },
      }),
    AuditValidationError
  );
});

test("validateAllForPolicy requires idempotency when policy says so", () => {
  const policy = getAuditPolicy("payment.recorded");
  assert.throws(
    () =>
      validateAllForPolicy(
        policy,
        { metadata: {} },
        undefined,
        undefined
      ),
    AuditValidationError
  );
});

test("validateAllForPolicy passes with idempotency key for payment.recorded", () => {
  const policy = getAuditPolicy("payment.recorded");
  validateAllForPolicy(
    policy,
    { metadata: { ok: true } },
    undefined,
    "idem-123"
  );
});
