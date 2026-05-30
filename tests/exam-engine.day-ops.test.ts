import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canMarkExamEntryCompleted,
  canMarkExamEntryStarted,
  resolveNextEntryStatusAfterComplete,
  resolveNextEntryStatusAfterStart,
} from "../src/lib/exams/exam-day-validation";

test("exam day status transitions follow published → in_progress → completed", () => {
  assert.equal(canMarkExamEntryStarted("published"), true);
  assert.equal(canMarkExamEntryStarted("in_progress"), false);
  assert.equal(canMarkExamEntryCompleted("published"), true);
  assert.equal(canMarkExamEntryCompleted("in_progress"), true);
  assert.equal(canMarkExamEntryCompleted("completed"), false);

  assert.equal(resolveNextEntryStatusAfterStart("published"), "in_progress");
  assert.equal(resolveNextEntryStatusAfterStart("in_progress"), null);

  assert.equal(resolveNextEntryStatusAfterComplete("published"), "completed");
  assert.equal(resolveNextEntryStatusAfterComplete("in_progress"), "completed");
  assert.equal(resolveNextEntryStatusAfterComplete("completed"), null);
});
