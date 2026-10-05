import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Types } from "mongoose";
import { BACKGROUND_JOB_EVENT_DATA_KEYS } from "../../src/lib/background/events";
import { toSafeBackgroundJobDTO } from "../../src/lib/background/serializers";
import { BACKGROUND_JOB_PAYLOAD_MAX_BYTES } from "../../src/lib/background/payload-limits";
import { assertBoundedBackgroundJobPayload } from "../../src/lib/background/payload-limits";
import type { IBackgroundJob } from "../../src/models/BackgroundJob";

describe("background engine source safety", () => {
  test("the event contract only allows routing/correlation fields", () => {
    assert.deepEqual([...BACKGROUND_JOB_EVENT_DATA_KEYS].sort(), [
      "correlationId",
      "initiatedByUserId",
      "jobId",
      "kind",
      "schoolId",
    ]);
  });

  test("the API serializer omits input and result blobs", () => {
    const job = {
      _id: new Types.ObjectId(),
      kind: "LIBRARY_IMPORT",
      status: "succeeded",
      progressPercent: 100,
      progressStage: "done",
      progressMessage: "Imported",
      createdAt: new Date(),
      queuedAt: new Date(),
      startedAt: new Date(),
      completedAt: new Date(),
      failedAt: null,
      cancelledAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      subjectType: "LibraryImportJob",
      subjectId: new Types.ObjectId(),
      input: { csv: "secret-rows", token: "abc" },
      result: { rows: ["huge"] },
    } as unknown as IBackgroundJob;

    const dto = toSafeBackgroundJobDTO(job);
    const serialized = JSON.stringify(dto);
    assert.equal("input" in dto, false);
    assert.equal("result" in dto, false);
    assert.doesNotMatch(serialized, /secret-rows/);
    assert.doesNotMatch(serialized, /huge/);
    assert.equal(dto.resultRef?.subjectType, "LibraryImportJob");
  });

  test("oversized payloads are rejected", () => {
    const huge = { blob: "x".repeat(BACKGROUND_JOB_PAYLOAD_MAX_BYTES) };
    assert.throws(() => assertBoundedBackgroundJobPayload(huge, "input"), /exceeds/);
  });
});
