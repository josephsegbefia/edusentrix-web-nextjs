import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertSameSchoolId,
  getPublishBlockedReason,
  isParentStudentExamSessionVisible,
  isPublishBlockedExamSessionStatus,
  isPublishableExamSessionStatus,
  isPublishedExamEntryVisibleToParentStudent,
  parseExamObjectId,
} from "../src/lib/exams/exam-hardening";

test("parseExamObjectId accepts valid Mongo ObjectIds only", () => {
  assert.equal(parseExamObjectId("507f1f77bcf86cd799439011"), "507f1f77bcf86cd799439011");
  assert.equal(parseExamObjectId("not-an-id"), null);
  assert.equal(parseExamObjectId(""), null);
});

test("isPublishableExamSessionStatus allows draft through published", () => {
  assert.equal(isPublishableExamSessionStatus("draft"), true);
  assert.equal(isPublishableExamSessionStatus("published"), true);
  assert.equal(isPublishableExamSessionStatus("in_progress"), false);
  assert.equal(isPublishBlockedExamSessionStatus("cancelled"), true);
});

test("getPublishBlockedReason explains blocked lifecycle states", () => {
  assert.equal(getPublishBlockedReason("draft"), null);
  assert.match(getPublishBlockedReason("in_progress") ?? "", /in progress/i);
  assert.match(getPublishBlockedReason("cancelled") ?? "", /cancelled/i);
});

test("assertSameSchoolId rejects cross-tenant ids", () => {
  assert.equal(assertSameSchoolId("school-a", "school-a"), true);
  assert.equal(assertSameSchoolId("school-a", "school-b"), false);
});

test("parent/student visibility requires published session flag and status", () => {
  assert.equal(
    isParentStudentExamSessionVisible({
      allowParentStudentVisibility: true,
      sessionStatus: "published",
    }),
    true
  );
  assert.equal(
    isParentStudentExamSessionVisible({
      allowParentStudentVisibility: false,
      sessionStatus: "published",
    }),
    false
  );
  assert.equal(
    isParentStudentExamSessionVisible({
      allowParentStudentVisibility: true,
      sessionStatus: "draft",
    }),
    false
  );
});

test("published parent/student entries exclude unscheduled drafts", () => {
  assert.equal(
    isPublishedExamEntryVisibleToParentStudent({
      entryStatus: "published",
      isUnscheduled: false,
    }),
    true
  );
  assert.equal(
    isPublishedExamEntryVisibleToParentStudent({
      entryStatus: "published",
      isUnscheduled: true,
    }),
    false
  );
  assert.equal(
    isPublishedExamEntryVisibleToParentStudent({
      entryStatus: "draft",
      isUnscheduled: false,
    }),
    false
  );
});
