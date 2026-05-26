import test from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";

import { buildExploreGenerationKey } from "../src/lib/learn/explore/build-generation-key";
import { detectStaleGenerationJob } from "../src/lib/learn/explore/explore-generation.service";

test("buildExploreGenerationKey is stable and excludes studentId", () => {
  const schoolId = new Types.ObjectId();
  const classGroupId = new Types.ObjectId();
  const subjectId = new Types.ObjectId();
  const lessonId = new Types.ObjectId();

  const key = buildExploreGenerationKey({
    schoolId,
    classGroupId,
    subjectId,
    lessonId,
    gradeLevel: " JHS 2 ",
  });

  assert.equal(
    key,
    [
      String(schoolId),
      String(classGroupId),
      String(subjectId),
      String(lessonId),
      "JHS 2",
      "base_explore",
      "1",
    ].join(":")
  );
  assert.ok(!key.includes("student"));
});

test("detectStaleGenerationJob flags expired in-progress locks", () => {
  const now = new Date("2026-05-20T12:00:00.000Z");

  const stale = detectStaleGenerationJob(
    {
      status: "generating",
      lockExpiresAt: new Date("2026-05-20T11:58:00.000Z"),
      attempts: 0,
      maxAttempts: 2,
    },
    now
  );

  assert.equal(stale.isStale, true);
  assert.equal(stale.canRetry, true);
  assert.equal(stale.shouldMarkFailed, false);
});

test("detectStaleGenerationJob marks exhausted retries as failed", () => {
  const now = new Date("2026-05-20T12:00:00.000Z");

  const stale = detectStaleGenerationJob(
    {
      status: "safety_checking",
      lockExpiresAt: new Date("2026-05-20T11:00:00.000Z"),
      attempts: 2,
      maxAttempts: 2,
    },
    now
  );

  assert.equal(stale.isStale, true);
  assert.equal(stale.canRetry, false);
  assert.equal(stale.shouldMarkFailed, true);
});

test("detectStaleGenerationJob ignores ready jobs even if lock is old", () => {
  const now = new Date("2026-05-20T12:00:00.000Z");

  const stale = detectStaleGenerationJob(
    {
      status: "ready",
      lockExpiresAt: new Date("2026-05-20T10:00:00.000Z"),
      attempts: 2,
      maxAttempts: 2,
    },
    now
  );

  assert.equal(stale.isStale, false);
  assert.equal(stale.canRetry, false);
  assert.equal(stale.shouldMarkFailed, false);
});
