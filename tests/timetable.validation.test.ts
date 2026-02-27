import { test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { buildClassroomLabel } from "../src/lib/timetable/classroom-label";
import {
  parseTimeToMinutes,
  isTimeRangeValid,
  slotsOverlap,
  validateTimetableSlotShape,
} from "../src/lib/timetable/validate";

test("buildClassroomLabel uses defaultRoomName when provided", () => {
  const label = buildClassroomLabel({
    gradeName: "JHS 1",
    classGroupName: "B",
    defaultRoomName: "  Block A Room 3  ",
  });

  assert.equal(label, "Block A Room 3");
});

test("buildClassroomLabel falls back to generated classroom label", () => {
  const label = buildClassroomLabel({
    gradeName: "Primary 4",
    classGroupName: "A",
  });

  assert.equal(label, "Primary 4 A Classroom");
});

test("buildClassroomLabel throws when grade and class names are empty", () => {
  assert.throws(() => {
    buildClassroomLabel({
      gradeName: "   ",
      classGroupName: "",
      defaultRoomName: null,
    });
  });
});

test("parseTimeToMinutes parses valid HH:MM values and rejects invalid values", () => {
  assert.equal(parseTimeToMinutes("00:00"), 0);
  assert.equal(parseTimeToMinutes("09:30"), 570);
  assert.equal(parseTimeToMinutes("23:59"), 1439);

  assert.equal(parseTimeToMinutes("24:00"), null);
  assert.equal(parseTimeToMinutes("9:30"), null);
  assert.equal(parseTimeToMinutes("ab:cd"), null);
});

test("isTimeRangeValid enforces end time strictly after start time", () => {
  assert.equal(isTimeRangeValid("08:00", "09:00"), true);
  assert.equal(isTimeRangeValid("08:00", "08:00"), false);
  assert.equal(isTimeRangeValid("09:00", "08:00"), false);
  assert.equal(isTimeRangeValid("9:00", "10:00"), false);
});

test("slotsOverlap follows strict overlap formula", () => {
  assert.equal(
    slotsOverlap(
      { startTime: "08:00", endTime: "09:00" },
      { startTime: "08:30", endTime: "09:30" }
    ),
    true
  );

  // Touching boundaries do not overlap.
  assert.equal(
    slotsOverlap(
      { startTime: "08:00", endTime: "09:00" },
      { startTime: "09:00", endTime: "10:00" }
    ),
    false
  );

  assert.equal(
    slotsOverlap(
      { startTime: "08:00", endTime: "invalid" },
      { startTime: "08:30", endTime: "09:00" }
    ),
    false
  );
});

test("validateTimetableSlotShape reports invalid day, time range, and missing classroom", () => {
  const issues = validateTimetableSlotShape({
    schoolId: new Types.ObjectId(),
    classGroupId: new Types.ObjectId(),
    gradeId: new Types.ObjectId(),
    subjectId: new Types.ObjectId(),
    teacherId: new Types.ObjectId(),
    dayOfWeek: 7,
    startTime: "08:00",
    endTime: "07:30",
    classroomLabel: "   ",
  });

  const codes = issues.map((issue) => issue.code).sort();
  assert.deepEqual(codes, [
    "INVALID_DAY_OF_WEEK",
    "INVALID_TIME_RANGE",
    "MISSING_CLASSROOM_LABEL",
  ]);
});

test("validateTimetableSlotShape returns no issues for a valid slot shape", () => {
  const issues = validateTimetableSlotShape({
    schoolId: new Types.ObjectId(),
    classGroupId: new Types.ObjectId(),
    gradeId: new Types.ObjectId(),
    subjectId: new Types.ObjectId(),
    teacherId: new Types.ObjectId(),
    dayOfWeek: 1,
    startTime: "08:00",
    endTime: "09:00",
    classroomLabel: "Primary 4A Classroom",
  });

  assert.equal(issues.length, 0);
});
