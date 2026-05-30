/**
 * Student Academic Profile — Slice 10 (period selector utils).
 *
 * Run: node --test --import tsx tests/student-academic-profile.period-selector.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapTermOverviewToPeriodItem,
  readPeriodIdFromSearchParams,
  resolvePeriodOptions,
  writePeriodIdToSearchParams,
} from "../src/lib/academics/profile/academic-period-selector-utils";

describe("readPeriodIdFromSearchParams", () => {
  it("reads periodId or termId", () => {
    assert.equal(
      readPeriodIdFromSearchParams(new URLSearchParams("termId=abc")),
      "abc"
    );
    assert.equal(
      readPeriodIdFromSearchParams(new URLSearchParams("periodId=xyz")),
      "xyz"
    );
    assert.equal(
      readPeriodIdFromSearchParams(
        new URLSearchParams("periodId=xyz&termId=abc")
      ),
      "xyz"
    );
  });
});

describe("writePeriodIdToSearchParams", () => {
  it("writes both params for compatibility", () => {
    const params = new URLSearchParams();
    writePeriodIdToSearchParams(params, "period1");
    assert.equal(params.get("termId"), "period1");
    assert.equal(params.get("periodId"), "period1");
  });
});

describe("resolvePeriodOptions", () => {
  it("prefers profile periods over legacy terms", () => {
    const options = resolvePeriodOptions({
      profilePeriods: [
        {
          academicPeriodId: "p1",
          label: "Term 1",
          startDate: "",
          endDate: "",
          isCurrent: true,
          status: "released",
          hasReportCard: true,
          isOfficial: true,
        },
      ],
      legacyTerms: [{ termId: "legacy", label: "Legacy", averageScore: 70, classPosition: null, totalSubjects: 1, performanceTier: null }],
    });

    assert.equal(options.length, 1);
    assert.equal(options[0]?.status, "released");
  });

  it("maps legacy terms when profile periods missing", () => {
    const options = resolvePeriodOptions({
      legacyTerms: [
        {
          termId: "t1",
          label: "2025 • Term 1",
          averageScore: 80,
          classPosition: 2,
          totalSubjects: 8,
          performanceTier: "top",
        },
      ],
    });

    assert.equal(options[0]?.academicPeriodId, "t1");
    assert.equal(options[0]?.status, "legacy");
  });
});

describe("mapTermOverviewToPeriodItem", () => {
  it("marks terms without averages as no_data", () => {
    const item = mapTermOverviewToPeriodItem({
      termId: "t1",
      label: "Term 1",
      averageScore: null,
      classPosition: null,
      totalSubjects: null,
      performanceTier: null,
    });
    assert.equal(item.status, "no_data");
  });
});
