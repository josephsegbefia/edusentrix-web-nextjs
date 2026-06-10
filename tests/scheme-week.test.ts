import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  countSchemeWeeksInPeriod,
  resolveCurrentSchoolSchemeWeek,
  resolveSchemeItemCalendarRange,
  resolveSchemeWeekCalendarRange,
  schemeItemOverlapsCalendarWeek,
} from "../src/lib/schemes/resolve-scheme-week";

function d(ymd: string) {
  return new Date(`${ymd}T00:00:00.000Z`);
}

describe("resolve-scheme-week", () => {
  const period = {
    startDate: d("2026-01-05"),
    endDate: d("2026-04-10"),
  };

  it("maps term week numbers from period start Monday", () => {
    const week3 = resolveSchemeWeekCalendarRange(period, 3);
    assert.equal(formatYmd(week3.weekStart), "2026-01-19");
    assert.equal(formatYmd(week3.weekEnd), "2026-01-25");
  });

  it("resolves current school week inside the term", () => {
    const snapshot = resolveCurrentSchoolSchemeWeek({
      period,
      today: d("2026-01-22"),
      academicPeriodId: "period-1",
      academicPeriodLabel: "2025/2026 Term 2",
    });

    assert.equal(snapshot.status, "active");
    assert.equal(snapshot.weekNumber, 3);
    assert.equal(snapshot.label, "Term Week 3");
    assert.equal(snapshot.weekStartDate, "2026-01-19");
    assert.equal(snapshot.weekEndDate, "2026-01-25");
  });

  it("derives item calendar range from weekNumber when planned dates are missing", () => {
    const range = resolveSchemeItemCalendarRange({ weekNumber: 4 }, period);
    assert.ok(range);
    assert.equal(formatYmd(range!.weekStart), "2026-01-26");
    assert.equal(formatYmd(range!.weekEnd), "2026-02-01");
  });

  it("matches items by weekNumber against the current calendar week", () => {
    const current = resolveCurrentSchoolSchemeWeek({ period, today: d("2026-01-22") });
    assert.ok(current.weekStartDate && current.weekEndDate);

    const overlaps = schemeItemOverlapsCalendarWeek(
      { weekNumber: 3 },
      period,
      d(current.weekStartDate),
      d(current.weekEndDate)
    );
    assert.equal(overlaps, true);

    const notOverlaps = schemeItemOverlapsCalendarWeek(
      { weekNumber: 5 },
      period,
      d(current.weekStartDate),
      d(current.weekEndDate)
    );
    assert.equal(notOverlaps, false);
  });

  it("counts total scheme weeks for a period", () => {
    assert.equal(countSchemeWeeksInPeriod(period), 14);
  });
});

function formatYmd(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
