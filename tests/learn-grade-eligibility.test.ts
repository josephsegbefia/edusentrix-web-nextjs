import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isLearnEligibleGrade,
  LEARN_GRADE_RANGE_LABEL,
} from "../src/lib/learn/grade-eligibility";

describe("learn-grade-eligibility", () => {
  it("accepts Primary 4 through JHS 3 by code and name", () => {
    assert.equal(isLearnEligibleGrade({ name: "Primary 4", code: "P4" }), true);
    assert.equal(isLearnEligibleGrade({ name: "Grade 4", code: "G4" }), true);
    assert.equal(isLearnEligibleGrade({ name: "Primary 6", code: "P6" }), true);
    assert.equal(isLearnEligibleGrade({ name: "JHS 3", code: "JHS3" }), true);
  });

  it("rejects preschool and SHS grades", () => {
    assert.equal(isLearnEligibleGrade({ name: "KG2", code: "KG2" }), false);
    assert.equal(isLearnEligibleGrade({ name: "Primary 3", code: "P3" }), false);
    assert.equal(isLearnEligibleGrade({ name: "SHS 1", code: "SHS1" }), false);
  });

  it("exposes the grade range label", () => {
    assert.match(LEARN_GRADE_RANGE_LABEL, /Primary 4/);
    assert.match(LEARN_GRADE_RANGE_LABEL, /JHS 3/);
  });
});
