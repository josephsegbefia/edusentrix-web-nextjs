/**
 * Report card approval helpers — Slice 19.
 *
 * Run: node --test --import tsx tests/assessment-engine.report-card-approval-service.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canApproveReportRunStatus,
  canReleaseReportRunStatus,
  canReturnReportRunStatus,
  parseAdminReportActionBody,
  parseAdminReportReleaseBody,
} from "../src/lib/academics/reporting/report-card-approval-service";

describe("report run status guards", () => {
  it("allows approve only from submitted_for_approval", () => {
    assert.equal(canApproveReportRunStatus("submitted_for_approval"), true);
    assert.equal(canApproveReportRunStatus("compiled"), false);
    assert.equal(canApproveReportRunStatus("approved"), false);
  });

  it("allows return from submitted_for_approval or approved", () => {
    assert.equal(canReturnReportRunStatus("submitted_for_approval"), true);
    assert.equal(canReturnReportRunStatus("approved"), true);
    assert.equal(canReturnReportRunStatus("compiled"), false);
  });

  it("allows release only from approved", () => {
    assert.equal(canReleaseReportRunStatus("approved"), true);
    assert.equal(canReleaseReportRunStatus("submitted_for_approval"), false);
    assert.equal(canReleaseReportRunStatus("released"), false);
  });
});

describe("parseAdminReportActionBody", () => {
  it("accepts optional notes", () => {
    const parsed = parseAdminReportActionBody({ note: "Looks good" });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.data.note, "Looks good");
    }
  });

  it("rejects notes longer than 2000 characters", () => {
    const parsed = parseAdminReportActionBody({ note: "x".repeat(2001) });
    assert.equal(parsed.ok, false);
  });
});

describe("parseAdminReportReleaseBody", () => {
  it("accepts release visibility flags", () => {
    const parsed = parseAdminReportReleaseBody({
      releaseVisibility: { parent: true, student: false },
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.data.releaseVisibility?.parent, true);
      assert.equal(parsed.data.releaseVisibility?.student, false);
    }
  });
});
