import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMinutesToTime,
  buildExamCalendarSourceRefKey,
  combineExamDateAndTime,
  computeSchedulerConfidenceScore,
  isWeekdayAllowed,
  rangesOverlap,
} from "../src/lib/exams/exam-scheduler-validation";
import {
  parseApplySmartScheduleBody,
  parseGenerateSmartScheduleBody,
} from "../src/lib/exams/exam-smart-scheduler-service";
import { parseExamExportMode } from "../src/lib/exams/exam-export-service";

test("combineExamDateAndTime merges calendar date with HH:mm", () => {
  const result = combineExamDateAndTime("2026-05-30T00:00:00.000Z", "09:30");
  assert.equal(result.getHours(), 9);
  assert.equal(result.getMinutes(), 30);
});

test("buildExamCalendarSourceRefKey dedupes by link kind and source id", () => {
  assert.equal(
    buildExamCalendarSourceRefKey({ linkKind: "exam_entry", sourceRefId: "abc123" }),
    "exam:exam_entry:abc123"
  );
  assert.equal(
    buildExamCalendarSourceRefKey({ linkKind: "invigilation", sourceRefId: "abc123" }),
    "exam:invigilation:abc123"
  );
});

test("isWeekdayAllowed respects working day list", () => {
  const monday = new Date("2026-06-01T12:00:00.000Z");
  assert.equal(isWeekdayAllowed(monday, [1, 2, 3, 4, 5]), true);
  assert.equal(isWeekdayAllowed(monday, [0, 6]), false);
});

test("addMinutesToTime wraps within a day", () => {
  assert.equal(addMinutesToTime("08:00", 90), "09:30");
  assert.equal(addMinutesToTime("23:45", 30), "00:15");
});

test("rangesOverlap detects overlapping time ranges", () => {
  assert.equal(rangesOverlap("08:00", "09:00", "08:30", "09:30"), true);
  assert.equal(rangesOverlap("08:00", "09:00", "09:00", "10:00"), false);
  assert.equal(rangesOverlap("08:00", "09:00", "07:00", "08:00"), false);
});

test("computeSchedulerConfidenceScore penalizes warnings", () => {
  assert.equal(
    computeSchedulerConfidenceScore({
      scheduledCount: 8,
      totalCount: 10,
      warningCount: 0,
    }),
    80
  );
  assert.equal(
    computeSchedulerConfidenceScore({
      scheduledCount: 8,
      totalCount: 10,
      warningCount: 4,
    }),
    60
  );
  assert.equal(
    computeSchedulerConfidenceScore({
      scheduledCount: 0,
      totalCount: 0,
      warningCount: 0,
    }),
    0
  );
});

test("parseGenerateSmartScheduleBody applies defaults and validates time format", () => {
  const defaults = parseGenerateSmartScheduleBody({});
  assert.equal(defaults.ok, true);
  if (defaults.ok) {
    assert.equal(defaults.data.dayStartTime, "08:00");
    assert.equal(defaults.data.onlyUnscheduledEntries, true);
  }

  const invalid = parseGenerateSmartScheduleBody({ dayStartTime: "25:00" });
  assert.equal(invalid.ok, false);
});

test("parseApplySmartScheduleBody requires scheduled drafts", () => {
  const valid = parseApplySmartScheduleBody({
    proposal: {
      examSessionId: "session-1",
      scheduledDrafts: [
        {
          entryId: "entry-1",
          date: "2026-06-02",
          startTime: "08:00",
          endTime: "09:30",
          durationMinutes: 90,
        },
      ],
    },
  });
  assert.equal(valid.ok, true);

  const invalid = parseApplySmartScheduleBody({ proposal: { scheduledDrafts: [] } });
  assert.equal(invalid.ok, false);
});

test("parseExamExportMode defaults to published", () => {
  assert.equal(parseExamExportMode(null), "published");
  assert.equal(parseExamExportMode("draft"), "draft");
  assert.equal(parseExamExportMode("unknown"), "published");
});
