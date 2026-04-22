import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getResolvedScheduleDiagnostics,
  getResolvedScheduleSettings,
} from "../src/lib/timetable/scheduleSettings";

test("per-day schedule model derives periods from duration, day bounds, and breaks", () => {
  const resolved = getResolvedScheduleSettings(
    {
      scheduleModelVersion: 2,
      workingDays: [1],
      daySchedules: [
        {
          dayOfWeek: 1,
          periodDuration: 50,
          startTime: "07:00",
          endTime: "16:00",
          breaks: [
            { name: "Short Break", startTime: "10:00", endTime: "10:20" },
            { name: "Lunch", startTime: "12:00", endTime: "13:00", isLunch: true },
          ],
        },
      ],
    },
    null,
    1
  );

  assert.equal(resolved.isConfigured, true);
  assert.equal(resolved.periodDuration, 50);
  assert.equal(resolved.periodSlots.length, 9);
  assert.equal(resolved.periodSlots[0]?.startTime, "07:00");
  assert.equal(resolved.periodSlots[8]?.endTime, "15:50");
});

test("grade day schedule profiles override the default school day for selected grades", () => {
  const resolved = getResolvedScheduleSettings(
    {
      scheduleModelVersion: 2,
      workingDays: [5],
      daySchedules: [
        {
          dayOfWeek: 5,
          periodDuration: 50,
          startTime: "07:00",
          endTime: "16:00",
          breaks: [{ name: "Lunch", startTime: "12:00", endTime: "13:00", isLunch: true }],
        },
      ],
      gradeDayScheduleProfiles: [
        {
          name: "Upper School",
          gradeIds: ["grade-1"],
          daySchedules: [
            {
              dayOfWeek: 5,
              periodDuration: 45,
              startTime: "07:30",
              endTime: "14:00",
              breaks: [{ name: "Break", startTime: "10:30", endTime: "10:45" }],
            },
          ],
        },
      ],
    },
    "grade-1",
    5
  );

  assert.equal(resolved.source, "grade_profile");
  assert.equal(resolved.profileName, "Upper School");
  assert.equal(resolved.startTime, "07:30");
  assert.equal(resolved.endTime, "14:00");
  assert.equal(resolved.periodDuration, 45);
  assert.equal(resolved.periodSlots.length, 8);
});

test("resolved schedule diagnostics report teaching and break time for a configured day", () => {
  const resolved = getResolvedScheduleSettings(
    {
      scheduleModelVersion: 2,
      daySchedules: [
        {
          dayOfWeek: 1,
          periodDuration: 50,
          startTime: "07:00",
          endTime: "16:00",
          breaks: [
            { name: "Short Break", startTime: "10:00", endTime: "10:20" },
            { name: "Lunch", startTime: "12:00", endTime: "13:00", isLunch: true },
          ],
        },
      ],
    },
    null,
    1
  );

  const diagnostics = getResolvedScheduleDiagnostics(resolved);

  assert.equal(diagnostics.scheduledPeriods, 9);
  assert.equal(diagnostics.periodsShortfall, 0);
  assert.equal(diagnostics.breakMinutes > 0, true);
});
