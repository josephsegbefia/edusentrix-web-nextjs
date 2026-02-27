import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";
import { TimetableChangeLog } from "../src/models/TimetableChangeLog";
import {
  buildTimetableSlotSnapshot,
  recordTimetableChangeLog,
} from "../src/lib/timetable/audit";

function oid(hex: string): Types.ObjectId {
  return new Types.ObjectId(hex.padEnd(24, "0").slice(0, 24));
}

test("buildTimetableSlotSnapshot stringifies IDs and keeps slot fields", () => {
  const snapshot = buildTimetableSlotSnapshot({
    classGroupId: oid("a1"),
    gradeId: oid("b1"),
    subjectId: oid("c1"),
    teacherId: oid("d1"),
    dayOfWeek: 2,
    startTime: "08:00",
    endTime: "09:00",
    classroomLabel: "Primary 3A Classroom",
    source: "manual",
  });

  assert.equal(typeof snapshot.classGroupId, "string");
  assert.equal(typeof snapshot.gradeId, "string");
  assert.equal(typeof snapshot.subjectId, "string");
  assert.equal(typeof snapshot.teacherId, "string");
  assert.equal(snapshot.dayOfWeek, 2);
  assert.equal(snapshot.startTime, "08:00");
  assert.equal(snapshot.endTime, "09:00");
  assert.equal(snapshot.classroomLabel, "Primary 3A Classroom");
  assert.equal(snapshot.source, "manual");
});

test("recordTimetableChangeLog writes single document without session", async (t) => {
  const calls: unknown[][] = [];
  t.mock.method(TimetableChangeLog, "create", async (...args: unknown[]) => {
    calls.push(args);
    return {} as never;
  });

  await recordTimetableChangeLog({
    schoolId: oid("1111"),
    academicPeriodId: oid("2222"),
    versionId: oid("3333"),
    action: "slot_created",
    actorId: oid("4444"),
    before: null,
    after: { startTime: "08:00" },
  });

  assert.equal(calls.length, 1);
  assert.equal(Array.isArray(calls[0]?.[0]), false);
  const firstArg = calls[0]?.[0] as Record<string, unknown>;
  assert.equal(firstArg.action, "slot_created");
  assert.equal(firstArg.before, null);
});

test("recordTimetableChangeLog uses array insert path when session is provided", async (t) => {
  const calls: unknown[][] = [];
  t.mock.method(TimetableChangeLog, "create", async (...args: unknown[]) => {
    calls.push(args);
    return {} as never;
  });

  const session = { id: "fake-session" } as never;

  await recordTimetableChangeLog({
    schoolId: oid("aaaa"),
    academicPeriodId: oid("bbbb"),
    versionId: oid("cccc"),
    action: "published",
    actorId: oid("dddd"),
    before: { status: "draft" },
    after: { status: "published" },
    session,
  });

  assert.equal(calls.length, 1);
  assert.equal(Array.isArray(calls[0]?.[0]), true);
  const options = calls[0]?.[1] as { session?: unknown };
  assert.equal(options.session, session);
});
