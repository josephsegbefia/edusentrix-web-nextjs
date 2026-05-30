/**
 * Report card run helpers — Slice 16.
 *
 * Run: node --test --import tsx tests/assessment-engine.report-card-run-service.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canCompileFromReadiness,
  parseOpenReportCardRunBody,
} from "../src/lib/academics/reporting/report-card-run-service";

describe("parseOpenReportCardRunBody", () => {
  it("accepts valid open payloads", () => {
    const parsed = parseOpenReportCardRunBody({
      classGroupId: "507f1f77bcf86cd799439015",
    });
    assert.equal(parsed.ok, true);
  });
});

describe("canCompileFromReadiness", () => {
  it("requires subjects, students, and attendance with no blocking errors", () => {
    const ready = canCompileFromReadiness(
      {
        subjectsExpected: 2,
        subjectsSubmitted: 2,
        subjectsApproved: 0,
        studentsExpected: 20,
        studentsComplete: 18,
        missingSubjectResults: [],
        missingExamScores: [],
        missingRequiredComponents: [],
        attendanceReady: true,
        commentsReady: false,
        headteacherCommentReady: false,
      },
      [
        {
          code: "COMMENTS_NOT_READY",
          message: "Comments pending",
          severity: "warning",
          entityType: "report_run",
        },
      ]
    );

    assert.equal(ready, true);
  });

  it("blocks compile when attendance is missing", () => {
    const ready = canCompileFromReadiness(
      {
        subjectsExpected: 2,
        subjectsSubmitted: 2,
        subjectsApproved: 0,
        studentsExpected: 20,
        studentsComplete: 20,
        missingSubjectResults: [],
        missingExamScores: [],
        missingRequiredComponents: [],
        attendanceReady: false,
        commentsReady: false,
        headteacherCommentReady: false,
      },
      [
        {
          code: "ATTENDANCE_NOT_READY",
          message: "Missing attendance",
          severity: "error",
          entityType: "report_run",
        },
      ]
    );

    assert.equal(ready, false);
  });
});
