import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatDateYmd,
  getWeekStartMonday,
  parseDateInput,
  parseMonthInput,
} from "../src/lib/timetable/read-model";

test("parseDateInput accepts valid YYYY-MM-DD and rejects invalid input", () => {
  const parsed = parseDateInput("2026-02-27");
  assert.ok(parsed instanceof Date);
  assert.equal(formatDateYmd(parsed as Date), "2026-02-27");

  assert.equal(parseDateInput("2026-2-27"), null);
  assert.equal(parseDateInput("2026-13-01"), null);
  assert.equal(parseDateInput("not-a-date"), null);
});

test("parseMonthInput accepts valid YYYY-MM and returns first day of month", () => {
  const parsed = parseMonthInput("2026-02");
  assert.ok(parsed instanceof Date);
  assert.equal(formatDateYmd(parsed as Date), "2026-02-01");

  assert.equal(parseMonthInput("2026-2"), null);
  assert.equal(parseMonthInput("2026-13"), null);
  assert.equal(parseMonthInput("hello"), null);
});

test("getWeekStartMonday returns Monday for dates across the week", () => {
  const monday = getWeekStartMonday(new Date("2026-02-23T12:00:00"));
  const wednesday = getWeekStartMonday(new Date("2026-02-25T12:00:00"));
  const sunday = getWeekStartMonday(new Date("2026-03-01T12:00:00"));

  assert.equal(formatDateYmd(monday), "2026-02-23");
  assert.equal(formatDateYmd(wednesday), "2026-02-23");
  assert.equal(formatDateYmd(sunday), "2026-02-23");
});

test("formatDateYmd zero-pads month and day", () => {
  const date = new Date(2026, 0, 5); // Jan 5, 2026
  assert.equal(formatDateYmd(date), "2026-01-05");
});
