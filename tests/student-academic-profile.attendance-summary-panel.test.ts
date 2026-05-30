/**
 * Student Academic Profile — Slice 15 (attendance summary panel).
 *
 * Run: node --test --import tsx tests/student-academic-profile.attendance-summary-panel.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  attendanceSummaryHasData,
  buildAttendanceSummaryPanelModel,
} from "../src/lib/academics/profile/attendance-summary-panel-utils";
import type { AcademicProfileAttendanceDTO } from "../src/types/academics/student-academic-profile";

const liveAttendance: AcademicProfileAttendanceDTO = {
  source: "live_homeroom_attendance",
  isSnapshot: false,
  totalSchoolDays: 50,
  daysPresent: 46,
  daysAbsent: 3,
  daysLate: 1,
  daysExcused: 0,
  attendancePercentage: 92,
  calculatedAt: "2026-05-01T00:00:00.000Z",
  note: null,
};

describe("attendanceSummaryHasData", () => {
  it("detects populated attendance", () => {
    assert.equal(attendanceSummaryHasData(liveAttendance), true);
    assert.equal(
      attendanceSummaryHasData({
        ...liveAttendance,
        source: "none",
        totalSchoolDays: null,
        daysPresent: null,
        attendancePercentage: null,
      }),
      false
    );
  });
});

describe("buildAttendanceSummaryPanelModel", () => {
  it("labels live homeroom source and renders stat rows", () => {
    const model = buildAttendanceSummaryPanelModel({
      attendance: liveAttendance,
    });

    assert.equal(model.sourceLabel, "Live homeroom attendance");
    assert.equal(model.hasData, true);
    assert.equal(model.stats.length, 6);
    assert.equal(model.stats.find((row) => row.key === "present")?.value, "46");
    assert.equal(model.stats.find((row) => row.key === "rate")?.value, "92.0%");
  });

  it("uses report snapshot source label", () => {
    const model = buildAttendanceSummaryPanelModel({
      attendance: {
        ...liveAttendance,
        source: "report_snapshot",
        isSnapshot: true,
      },
    });

    assert.equal(model.sourceLabel, "Official report-card snapshot");
  });

  it("shows empty state message when no records", () => {
    const model = buildAttendanceSummaryPanelModel({
      attendance: {
        source: "none",
        isSnapshot: false,
        totalSchoolDays: null,
        daysPresent: null,
        daysAbsent: null,
        daysLate: null,
        daysExcused: null,
        attendancePercentage: null,
        calculatedAt: null,
        note: "No homeroom attendance has been recorded for this period yet.",
      },
    });

    assert.equal(model.hasData, false);
    assert.match(model.emptyMessage, /no homeroom attendance/i);
    assert.equal(model.stats.length, 0);
  });

  it("warns staff when attendance is not compile-ready", () => {
    const model = buildAttendanceSummaryPanelModel({
      attendance: liveAttendance,
      canViewReadiness: true,
      attendanceReady: false,
      isReleasedPeriod: false,
    });

    assert.equal(model.showCompileWarning, true);
  });

  it("hides compile warning for released periods", () => {
    const model = buildAttendanceSummaryPanelModel({
      attendance: liveAttendance,
      canViewReadiness: true,
      attendanceReady: false,
      isReleasedPeriod: true,
    });

    assert.equal(model.showCompileWarning, false);
  });
});
