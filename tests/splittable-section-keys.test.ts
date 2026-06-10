import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeSplittableSectionKeys } from "../src/lib/lessons/splittable-section-keys";

describe("normalizeSplittableSectionKeys", () => {
  const allowed = ["body", "resources", "assessment"];

  it("drops context and curriculum from session allocation", () => {
    assert.deepEqual(
      normalizeSplittableSectionKeys(["context", "body", "curriculum"], allowed),
      ["body", "resources"],
    );
  });

  it("adds resources when body is assigned", () => {
    assert.deepEqual(normalizeSplittableSectionKeys(["body"], allowed), [
      "body",
      "resources",
    ]);
  });

  it("keeps assessment without forcing body", () => {
    assert.deepEqual(normalizeSplittableSectionKeys(["assessment"], allowed), [
      "assessment",
    ]);
  });
});
