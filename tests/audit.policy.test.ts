import assert from "node:assert/strict";
import { test } from "node:test";
import { getAuditPolicy, isRegisteredAuditAction } from "../src/lib/audit/policy";
import { AuditPolicyError } from "../src/lib/audit/errors";

test("getAuditPolicy returns registered entry", () => {
  const p = getAuditPolicy("payment.recorded");
  assert.equal(p.tier, 0);
  assert.equal(p.domain, "finance");
});

test("getAuditPolicy throws for unknown code", () => {
  assert.throws(() => getAuditPolicy("unknown.action"), AuditPolicyError);
});

test("isRegisteredAuditAction", () => {
  assert.equal(isRegisteredAuditAction("payment.recorded"), true);
  assert.equal(isRegisteredAuditAction("student.record.updated"), true);
  assert.equal(isRegisteredAuditAction("attendance.marked"), true);
  assert.equal(isRegisteredAuditAction("grade.published"), true);
  assert.equal(isRegisteredAuditAction("teacher.status.updated"), true);
  assert.equal(isRegisteredAuditAction("guardian.linked"), true);
  assert.equal(isRegisteredAuditAction("lesson_note.review_requested"), true);
  assert.equal(isRegisteredAuditAction("lesson_note.comment_resolved"), true);
  assert.equal(isRegisteredAuditAction("email.bulk.sent"), true);
  assert.equal(isRegisteredAuditAction("export.generated"), true);
  assert.equal(isRegisteredAuditAction("library.book.created"), true);
  assert.equal(isRegisteredAuditAction("library.settings.updated"), true);
  assert.equal(isRegisteredAuditAction("library.loan.issued"), true);
  assert.equal(isRegisteredAuditAction("library.loan.returned"), true);
  assert.equal(isRegisteredAuditAction("library.loan.renewed"), true);
  assert.equal(isRegisteredAuditAction("lesson.published"), true);
  assert.equal(isRegisteredAuditAction("lesson.resource_added"), true);
  assert.equal(isRegisteredAuditAction("data.unmasked"), true);
  assert.equal(isRegisteredAuditAction("not.real"), false);
});
