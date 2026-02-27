import { test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { detectTimetableConflicts } from "../src/lib/timetable/conflicts";

function oid(hex: string) {
  return new Types.ObjectId(hex.padEnd(24, "0").slice(0, 24));
}

test("detectTimetableConflicts detects teacher overlap on same day", () => {
  const teacherId = oid("111111");
  const classA = oid("aaaaaa");
  const classB = oid("bbbbbb");

  const conflicts = detectTimetableConflicts([
    {
      _id: oid("a1"),
      teacherId,
      classGroupId: classA,
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "09:00",
    },
    {
      _id: oid("a2"),
      teacherId,
      classGroupId: classB,
      dayOfWeek: 1,
      startTime: "08:30",
      endTime: "09:30",
    },
  ]);

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0]?.code, "TEACHER_OVERLAP");
  assert.equal(conflicts[0]?.slotIds.length, 2);
});

test("detectTimetableConflicts detects class overlap on same day", () => {
  const classId = oid("cccccc");

  const conflicts = detectTimetableConflicts([
    {
      _id: oid("b1"),
      teacherId: oid("222222"),
      classGroupId: classId,
      dayOfWeek: 2,
      startTime: "10:00",
      endTime: "11:00",
    },
    {
      _id: oid("b2"),
      teacherId: oid("333333"),
      classGroupId: classId,
      dayOfWeek: 2,
      startTime: "10:30",
      endTime: "11:30",
    },
  ]);

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0]?.code, "CLASS_OVERLAP");
  assert.equal(conflicts[0]?.slotIds.length, 2);
});

test("detectTimetableConflicts does not count boundary-touching slots as overlap", () => {
  const teacherId = oid("444444");

  const conflicts = detectTimetableConflicts([
    {
      _id: oid("c1"),
      teacherId,
      classGroupId: oid("dddddd"),
      dayOfWeek: 3,
      startTime: "08:00",
      endTime: "09:00",
    },
    {
      _id: oid("c2"),
      teacherId,
      classGroupId: oid("eeeeee"),
      dayOfWeek: 3,
      startTime: "09:00",
      endTime: "10:00",
    },
  ]);

  assert.equal(conflicts.length, 0);
});

test("detectTimetableConflicts ignores invalid slot shapes", () => {
  const teacherId = oid("555555");
  const classId = oid("ffffff");

  const conflicts = detectTimetableConflicts([
    {
      _id: oid("d1"),
      teacherId,
      classGroupId: classId,
      dayOfWeek: 4,
      startTime: "bad",
      endTime: "09:00",
    },
    {
      _id: oid("d2"),
      teacherId,
      classGroupId: classId,
      dayOfWeek: 4,
      startTime: "08:30",
      endTime: "09:30",
    },
  ]);

  assert.equal(conflicts.length, 0);
});

test("detectTimetableConflicts is deterministic and deduplicated", () => {
  const teacherId = oid("666666");
  const classId = oid("121212");

  const slots = [
    {
      _id: oid("e1"),
      teacherId,
      classGroupId: classId,
      dayOfWeek: 5,
      startTime: "08:00",
      endTime: "09:00",
    },
    {
      _id: oid("e2"),
      teacherId,
      classGroupId: classId,
      dayOfWeek: 5,
      startTime: "08:15",
      endTime: "08:45",
    },
  ];

  const first = detectTimetableConflicts(slots);
  const second = detectTimetableConflicts([...slots].reverse());

  assert.equal(first.length, 2);
  assert.deepEqual(
    first.map((c) => [c.code, [...c.slotIds].sort()]),
    second.map((c) => [c.code, [...c.slotIds].sort()])
  );
});
