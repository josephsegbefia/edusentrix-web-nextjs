/**
 * Mark entry UI helpers — Slice 12.
 *
 * Run: node --test --import tsx tests/assessment-engine.mark-entry-utils.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  markEntryCellKey,
  parseMarkEntryInput,
  validateMarkEntryScore,
} from "../src/components/teacher/marks/mark-entry-utils";

describe("mark entry utils", () => {
  it("builds stable cell keys", () => {
    assert.equal(markEntryCellKey("student-1", "item-1"), "student-1:item-1");
  });

  it("parses numeric and empty inputs", () => {
    assert.equal(parseMarkEntryInput(""), null);
    assert.equal(parseMarkEntryInput("16.5"), 16.5);
    assert.equal(parseMarkEntryInput("abc"), "invalid");
  });

  it("validates score ranges", () => {
    assert.equal(validateMarkEntryScore(16, 20), null);
    assert.match(validateMarkEntryScore(21, 20) ?? "", /cannot exceed/);
    assert.match(validateMarkEntryScore(-1, 20) ?? "", /negative/);
  });
});
