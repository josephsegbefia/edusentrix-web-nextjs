import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getResolvedScheduleDiagnostics,
  getResolvedScheduleSettings,
} from "../src/lib/timetable/scheduleSettings";

test("auto-generated schedules keep full lesson durations and shift breaks to period boundaries", () => {
  const resolved = getResolvedScheduleSettings(
    {
      schoolStartTime: "07:00",
      schoolEndTime: "16:00",
      periodDuration: 50,
      periodsPerDay: 8,
      breaks: [
        { name: "Short Break", startTime: "10:00", endTime: "10:20" },
        { name: "Lunch", startTime: "12:00", endTime: "13:00", isLunch: true },
      ],
    },
    null,
    1
  );

  assert.deepEqual(
    resolved.periodSlots.map((slot) => `${slot.startTime}-${slot.endTime}`),
    [
      "07:00-07:50",
      "07:50-08:40",
      "08:40-09:30",
      "09:30-10:20",
      "10:40-11:30",
      "11:30-12:20",
      "13:20-14:10",
      "14:10-15:00",
    ]
  );

  assert.deepEqual(
    resolved.breaks.map((slot) => `${slot.startTime}-${slot.endTime}`),
    ["10:20-10:40", "12:20-13:20"]
  );
});

test("resolved schedule diagnostics report unused time before school close", () => {
  const resolved = getResolvedScheduleSettings(
    {
      schoolStartTime: "07:00",
      schoolEndTime: "16:00",
      periodDuration: 50,
      periodsPerDay: 8,
      breaks: [
        { name: "Short Break", startTime: "10:00", endTime: "10:20" },
        { name: "Lunch", startTime: "12:00", endTime: "13:00", isLunch: true },
      ],
    },
    null,
    1
  );

  const diagnostics = getResolvedScheduleDiagnostics(resolved);

  assert.equal(diagnostics.scheduledPeriods, 8);
  assert.equal(diagnostics.periodsShortfall, 0);
  assert.equal(diagnostics.lastPeriodEndTime, "15:00");
  assert.equal(diagnostics.breakMinutes, 80);
  assert.equal(diagnostics.unallocatedMinutes, 60);
});

test("resolved schedule diagnostics flag days where configured periods cannot fit", () => {
  const resolved = getResolvedScheduleSettings(
    {
      schoolStartTime: "07:00",
      schoolEndTime: "16:00",
      periodDuration: 50,
      periodsPerDay: 8,
      breaks: [
        { name: "Short Break", startTime: "10:00", endTime: "10:20" },
        { name: "Lunch", startTime: "12:00", endTime: "13:00", isLunch: true },
      ],
      dailyScheduleOverrides: [{ dayOfWeek: 5, endTime: "14:00" }],
      periodSlots: [
        { periodNumber: 1, startTime: "07:00", endTime: "07:50" },
        { periodNumber: 2, startTime: "07:50", endTime: "08:40" },
        { periodNumber: 3, startTime: "08:40", endTime: "09:30" },
        { periodNumber: 4, startTime: "09:30", endTime: "10:20" },
        { periodNumber: 5, startTime: "10:40", endTime: "11:30" },
        { periodNumber: 6, startTime: "11:30", endTime: "12:20" },
        { periodNumber: 7, startTime: "13:20", endTime: "14:10" },
        { periodNumber: 8, startTime: "14:10", endTime: "15:00" },
      ],
    },
    null,
    5
  );

  const diagnostics = getResolvedScheduleDiagnostics(resolved);

  assert.equal(resolved.endTime, "14:00");
  assert.equal(diagnostics.scheduledPeriods, 6);
  assert.equal(diagnostics.periodsShortfall, 2);
  assert.equal(diagnostics.overflowMinutes, 60);
});
