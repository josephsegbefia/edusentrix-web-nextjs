/**
 * Legacy gradebook deprecation — Slice 23.
 *
 * Run: node --test --import tsx tests/assessment-engine.legacy-gradebook-deprecation.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LEGACY_GRADEBOOK_SUCCESSOR,
  legacyGradebookDeprecatedMessage,
  legacyGradebookDeprecatedResponse,
} from "../src/lib/academics/legacy-gradebook-deprecation";

describe("legacyGradebookDeprecatedMessage", () => {
  it("points to marks list when class/subject are omitted", () => {
    const message = legacyGradebookDeprecatedMessage({ action: "read gradebook" });
    assert.match(message, /Marks & Reports/);
    assert.match(message, /\/teacher\/marks/);
    assert.match(message, /read gradebook/);
  });

  it("points to marks workspace when class and subject are provided", () => {
    const message = legacyGradebookDeprecatedMessage({
      classGroupId: "class-1",
      subjectId: "subject-1",
      action: "publish grades",
    });
    assert.match(message, /\/teacher\/marks\/class-1\/subject-1/);
  });
});

describe("legacyGradebookDeprecatedResponse", () => {
  it("returns HTTP 410 with successor metadata", async () => {
    const response = legacyGradebookDeprecatedResponse({
      classGroupId: "507f1f77bcf86cd799439011",
      subjectId: "507f1f77bcf86cd799439012",
      action: "publish grades",
    });

    assert.equal(response.status, 410);
    assert.equal(response.headers.get("Deprecation"), "true");

    const body = (await response.json()) as {
      success: boolean;
      deprecated: boolean;
      successor: string;
      successorApi: string;
    };

    assert.equal(body.success, false);
    assert.equal(body.deprecated, true);
    assert.equal(
      body.successor,
      LEGACY_GRADEBOOK_SUCCESSOR.marksWorkspace(
        "507f1f77bcf86cd799439011",
        "507f1f77bcf86cd799439012"
      )
    );
    assert.equal(
      body.successorApi,
      LEGACY_GRADEBOOK_SUCCESSOR.gradebookApi(
        "507f1f77bcf86cd799439011",
        "507f1f77bcf86cd799439012"
      )
    );
  });
});
