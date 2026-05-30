/**
 * Student Academic Profile — Slice 5 (attendance).
 *
 * Run: node --test --import tsx tests/student-academic-profile.attendance.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateHomeroomAttendance,
} from "../src/lib/academics/reporting/build-attendance-snapshot";
import {
  mapAggregateToProfileAttendance,
  mapReportAttendanceSnapshotDtoToProfile,
  mapStudentReportCardAttendanceSnapshotToProfile,
  profileHasReportSnapshotAttendance,
} from "../src/lib/academics/profile/buildAttendanceProfile";
import { createEmptyStudentAcademicProfile } from "../src/lib/academics/profile/empty-academic-profile-sections";
import { resolveAcademicProfilePermissions } from "../src/lib/academics/profile/resolve-academic-profile-permissions";

describe("profileHasReportSnapshotAttendance", () => {
  it("detects populated report snapshot attendance", () => {
    const profile = createEmptyStudentAcademicProfile({
      studentId: "s1",
      schoolId: "sc1",
      visibilityMode: "admin",
      permissions: resolveAcademicProfilePermissions({ visibilityMode: "admin" }),
      insightMode: "admin",
    });
    profile.attendance = {
      source: "report_snapshot",
      isSnapshot: true,
      totalSchoolDays: 60,
      daysPresent: 54,
      daysAbsent: 4,
      daysLate: 1,
      daysExcused: 1,
      attendancePercentage: 90,
      calculatedAt: null,
      note: null,
    };
    assert.equal(profileHasReportSnapshotAttendance(profile), true);
  });
});

describe("mapAggregateToProfileAttendance", () => {
  it("maps live homeroom aggregate", () => {
    const aggregate = aggregateHomeroomAttendance([
      { date: new Date("2026-01-02"), status: "present" },
      { date: new Date("2026-01-03"), status: "absent" },
      { date: new Date("2026-01-04"), status: "late" },
    ]);

    const dto = mapAggregateToProfileAttendance({
      aggregate,
      source: "live_homeroom_attendance",
      isSnapshot: false,
      calculatedAt: "2026-01-10T00:00:00.000Z",
      note: null,
    });

    assert.equal(dto.source, "live_homeroom_attendance");
    assert.equal(dto.totalSchoolDays, 3);
    assert.equal(dto.daysPresent, 1);
    assert.equal(dto.daysAbsent, 1);
    assert.equal(dto.daysLate, 1);
    assert.equal(dto.isSnapshot, false);
  });

  it("returns empty state when no records", () => {
    const dto = mapAggregateToProfileAttendance({
      aggregate: aggregateHomeroomAttendance([]),
      source: "none",
      isSnapshot: false,
      calculatedAt: null,
      note: null,
    });

    assert.equal(dto.source, "none");
    assert.equal(dto.totalSchoolDays, null);
    assert.match(dto.note ?? "", /No homeroom attendance/i);
  });
});

describe("mapStudentReportCardAttendanceSnapshotToProfile", () => {
  it("maps ready card attendance snapshot", () => {
    const dto = mapStudentReportCardAttendanceSnapshotToProfile({
      ready: true,
      totalSchoolDays: 40,
      daysPresent: 36,
      daysAbsent: 3,
      daysLate: 1,
      daysExcused: 0,
      attendancePercentage: 90,
    });

    assert.equal(dto?.source, "report_snapshot");
    assert.equal(dto?.daysPresent, 36);
    assert.equal(dto?.isSnapshot, true);
  });
});

describe("mapReportAttendanceSnapshotDtoToProfile", () => {
  it("maps persisted snapshot DTO", () => {
    const dto = mapReportAttendanceSnapshotDtoToProfile({
      _id: "snap1",
      schoolId: "school1",
      academicPeriodId: "period1",
      reportCardRunId: "run1",
      studentId: "student1",
      classGroupId: "class1",
      source: "homeroom_daily_attendance",
      totalSchoolDays: 50,
      daysPresent: 45,
      daysAbsent: 3,
      daysLate: 1,
      daysExcused: 1,
      attendancePercentage: 90,
      calculatedFromDate: new Date(),
      calculatedToDate: new Date(),
      calculatedAt: new Date(),
    });

    assert.equal(dto.source, "report_snapshot");
    assert.equal(dto.attendancePercentage, 90);
  });
});
