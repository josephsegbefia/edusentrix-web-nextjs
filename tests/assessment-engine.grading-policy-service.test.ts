/**
 * Grading policy service tests — Slice 4.
 *
 * Run: node --test --import tsx tests/assessment-engine.grading-policy-service.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseGradingPolicyBody,
  validateGradingPolicyPayload,
} from "../src/lib/academics/assessment-engine/grading-policy-service";

const validPayload = {
  name: "Primary Term Policy",
  scoreComponents: [
    {
      key: "classroom_work",
      label: "Classroom Work",
      weight: 30,
      order: 1,
      required: true,
      allowedAssessmentTypes: ["classwork", "homework"],
    },
    {
      key: "exam",
      label: "Exam",
      weight: 70,
      order: 2,
      required: true,
      allowedAssessmentTypes: ["exam"],
    },
  ],
  gradeBoundaries: [
    { minPercentage: 80, maxPercentage: 100, gradeLabel: "A" },
    { minPercentage: 0, maxPercentage: 79.99, gradeLabel: "B" },
  ],
  passMark: 50,
};

describe("grading policy service validation", () => {
  it("parses a valid grading policy payload", () => {
    const parsed = parseGradingPolicyBody(validPayload);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.data.name, "Primary Term Policy");
    }
  });

  it("rejects invalid payloads", () => {
    const parsed = parseGradingPolicyBody({ name: "" });
    assert.equal(parsed.ok, false);
  });

  it("validates component weights and boundaries", () => {
    const validation = validateGradingPolicyPayload(validPayload);
    assert.equal(validation.valid, true);

    const invalid = validateGradingPolicyPayload({
      ...validPayload,
      scoreComponents: [
        { ...validPayload.scoreComponents[0], weight: 20 },
        { ...validPayload.scoreComponents[1], weight: 60 },
      ],
    });
    assert.equal(invalid.valid, false);
  });
});
