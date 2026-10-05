import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { BACKGROUND_JOB_EVENT_DATA_KEYS } from "../../src/lib/background/events";
import { BACKGROUND_JOB_KINDS } from "../../src/lib/background/job-kinds";

describe("AI event payload safety", () => {
  test("AI kinds exist and events still allow only routing fields", () => {
    assert.ok(BACKGROUND_JOB_KINDS.includes("AI_LESSON_GENERATION"));
    assert.ok(BACKGROUND_JOB_KINDS.includes("EXPLORE_GENERATION"));
    assert.ok(BACKGROUND_JOB_KINDS.includes("AI_LESSON_ILLUSTRATION"));
    assert.deepEqual([...BACKGROUND_JOB_EVENT_DATA_KEYS].sort(), [
      "correlationId",
      "initiatedByUserId",
      "jobId",
      "kind",
      "schoolId",
    ]);
  });
});
