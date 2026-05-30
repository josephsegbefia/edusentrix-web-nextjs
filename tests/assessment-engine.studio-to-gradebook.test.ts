/**
 * Teacher Studio → gradebook link — Slice 15.
 *
 * Run: node --test --import tsx tests/assessment-engine.studio-to-gradebook.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapHomeworkTypeToAssessmentType,
  mapHomeworkTypeToSourceType,
  parseAddStudioToGradebookBody,
} from "../src/lib/academics/assessment-engine/studio-to-gradebook-service";

describe("mapHomeworkTypeToAssessmentType", () => {
  it("maps quiz and assignment types for the assessment engine", () => {
    assert.equal(mapHomeworkTypeToAssessmentType("quiz"), "quiz");
    assert.equal(mapHomeworkTypeToAssessmentType("assignment"), "assignment");
    assert.equal(mapHomeworkTypeToAssessmentType("project"), "project");
    assert.equal(mapHomeworkTypeToAssessmentType("practice"), "formative");
  });
});

describe("mapHomeworkTypeToSourceType", () => {
  it("uses app_quiz for quizzes and app_assignment for other studio work", () => {
    assert.equal(mapHomeworkTypeToSourceType("quiz"), "app_quiz");
    assert.equal(mapHomeworkTypeToSourceType("assignment"), "app_assignment");
    assert.equal(mapHomeworkTypeToSourceType("project"), "app_assignment");
  });
});

describe("parseAddStudioToGradebookBody", () => {
  it("requires a component when report mode is selected", () => {
    const parsed = parseAddStudioToGradebookBody({
      classGroupId: "507f1f77bcf86cd799439011",
      contributionMode: "report",
    });

    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.match(parsed.error, /component/i);
    }
  });

  it("accepts non-report imports without a component", () => {
    const parsed = parseAddStudioToGradebookBody({
      classGroupId: "507f1f77bcf86cd799439011",
      contributionMode: "non_report",
    });

    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.data.contributionMode, "non_report");
    }
  });
});
