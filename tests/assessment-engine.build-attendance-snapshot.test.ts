/**
 * Attendance snapshot service — Slice 18.
 *
 * Run: node --test --import tsx tests/assessment-engine.build-attendance-snapshot.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateHomeroomAttendance,
  toStudentReportCardAttendanceSnapshot,
} from "../src/lib/academics/reporting/build-attendance-snapshot";

describe("aggregateHomeroomAttendance", () => {
  it("counts present days and attendance percentage", () => {
    const aggregate = aggregateHomeroomAttendance([
      { date: new Date("2026-01-05T08:00:00.000Z"), status: "present" },
      { date: new Date("2026-01-06T08:00:00.000Z"), status: "present" },
      { date: new Date("2026-01-07T08:00:00.000Z"), status: "present" },
      { date: new Date("2026-01-08T08:00:00.000Z"), status: "present" },
    ]);

    assert.equal(aggregate.daysPresent, 4);
    assert.equal(aggregate.daysAbsent, 0);
    assert.equal(aggregate.daysLate, 0);
    assert.equal(aggregate.daysExcused, 0);
    assert.equal(aggregate.totalSchoolDays, 4);
    assert.equal(aggregate.attendancePercentage, 100);
  });

  it("counts absent days separately from present rate", () => {
    const aggregate = aggregateHomeroomAttendance([
      { date: new Date("2026-01-05T08:00:00.000Z"), status: "present" },
      { date: new Date("2026-01-06T08:00:00.000Z"), status: "absent" },
      { date: new Date("2026-01-07T08:00:00.000Z"), status: "absent" },
      { date: new Date("2026-01-08T08:00:00.000Z"), status: "present" },
    ]);

    assert.equal(aggregate.daysPresent, 2);
    assert.equal(aggregate.daysAbsent, 2);
    assert.equal(aggregate.daysLate, 0);
    assert.equal(aggregate.daysExcused, 0);
    assert.equal(aggregate.attendancePercentage, 50);
  });

  it("counts late days separately and excludes them from present rate", () => {
    const aggregate = aggregateHomeroomAttendance([
      { date: new Date("2026-01-05T08:00:00.000Z"), status: "present" },
      { date: new Date("2026-01-06T08:00:00.000Z"), status: "late" },
      { date: new Date("2026-01-07T08:00:00.000Z"), status: "late" },
      { date: new Date("2026-01-08T08:00:00.000Z"), status: "present" },
    ]);

    assert.equal(aggregate.daysPresent, 2);
    assert.equal(aggregate.daysLate, 2);
    assert.equal(aggregate.daysAbsent, 0);
    assert.equal(aggregate.daysExcused, 0);
    assert.equal(aggregate.attendancePercentage, 50);
  });

  it("counts excused days separately from present rate", () => {
    const aggregate = aggregateHomeroomAttendance([
      { date: new Date("2026-01-05T08:00:00.000Z"), status: "present" },
      { date: new Date("2026-01-06T08:00:00.000Z"), status: "excused" },
      { date: new Date("2026-01-07T08:00:00.000Z"), status: "excused" },
      { date: new Date("2026-01-08T08:00:00.000Z"), status: "present" },
    ]);

    assert.equal(aggregate.daysPresent, 2);
    assert.equal(aggregate.daysExcused, 2);
    assert.equal(aggregate.daysAbsent, 0);
    assert.equal(aggregate.daysLate, 0);
    assert.equal(aggregate.attendancePercentage, 50);
  });

  it("deduplicates multiple records on the same school day", () => {
    const aggregate = aggregateHomeroomAttendance([
      { date: new Date("2026-01-05T08:00:00.000Z"), status: "present" },
      { date: new Date("2026-01-05T09:00:00.000Z"), status: "absent" },
      { date: new Date("2026-01-06T08:00:00.000Z"), status: "late" },
    ]);

    assert.equal(aggregate.totalSchoolDays, 2);
    assert.equal(aggregate.daysPresent, 0);
    assert.equal(aggregate.daysAbsent, 1);
    assert.equal(aggregate.daysLate, 1);
    assert.equal(aggregate.attendancePercentage, 0);
  });

  it("returns an empty aggregate when no records exist", () => {
    const aggregate = aggregateHomeroomAttendance([]);
    assert.equal(aggregate.hasRecords, false);
    assert.equal(aggregate.totalSchoolDays, 0);
    assert.equal(aggregate.attendancePercentage, 0);
  });
});

describe("toStudentReportCardAttendanceSnapshot", () => {
  it("embeds persisted snapshot fields on student report cards", () => {
    const embedded = toStudentReportCardAttendanceSnapshot({
      _id: "507f1f77bcf86cd799439050",
      schoolId: "507f1f77bcf86cd799439010",
      academicPeriodId: "507f1f77bcf86cd799439011",
      reportCardRunId: "507f1f77bcf86cd799439051",
      studentId: "507f1f77bcf86cd799439030",
      classGroupId: "507f1f77bcf86cd799439015",
      source: "homeroom_daily_attendance",
      totalSchoolDays: 4,
      daysPresent: 3,
      daysAbsent: 1,
      daysLate: 0,
      daysExcused: 0,
      attendancePercentage: 75,
      calculatedFromDate: "2026-01-05T00:00:00.000Z",
      calculatedToDate: "2026-01-08T00:00:00.000Z",
      calculatedAt: "2026-01-09T10:00:00.000Z",
    });

    assert.equal(embedded.ready, true);
    assert.equal(embedded.snapshotId, "507f1f77bcf86cd799439050");
    assert.equal(embedded.daysPresent, 3);
    assert.equal(embedded.daysAbsent, 1);
    assert.equal(embedded.source, "homeroom_daily_attendance");
  });

  it("returns an honest unavailable embed when snapshot is missing", () => {
    const embedded = toStudentReportCardAttendanceSnapshot(null);
    assert.equal(embedded.ready, false);
    assert.match(String(embedded.message), /unavailable/i);
  });
});
