import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { BACKGROUND_JOB_EVENT_DATA_KEYS } from "../../src/lib/background/events";
import { BACKGROUND_JOB_KINDS } from "../../src/lib/background/job-kinds";

describe("Operational event payload safety", () => {
  test("Prompt 4 kinds exist and events still allow only routing fields", () => {
    for (const kind of [
      "LIBRARY_IMPORT",
      "SCHEME_IMPORT",
      "SCHOOL_PROVISIONING",
      "COMMUNICATION_OUTBOX",
      "BULK_IMPORT",
    ] as const) {
      assert.ok(BACKGROUND_JOB_KINDS.includes(kind));
    }
    assert.deepEqual([...BACKGROUND_JOB_EVENT_DATA_KEYS].sort(), [
      "correlationId",
      "initiatedByUserId",
      "jobId",
      "kind",
      "schoolId",
    ]);
  });
});
