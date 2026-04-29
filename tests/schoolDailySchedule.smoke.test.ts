import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pickDailyConfigV2FromApiDto,
  pickRawDailyConfigForGrade,
} from "../src/lib/school-day/resolveDailyScheduleDoc";
import { createDefaultV2Config, prepareSchoolDailyConfigForApi } from "../src/lib/school-day/migrate-v2";

/**
 * Offline smoke for unified vs grouped resolution (timetables depend on this).
 * Leo coach route: verify in the app while signed in as school admin; Node tests cannot import that route without Clerk’s server runtime.
 */

test("unified doc returns root config for any grade id", () => {
  const cfg = createDefaultV2Config();
  const doc = { scheduleMode: "unified" as const, config: cfg };
  assert.equal(pickRawDailyConfigForGrade(doc, "grade-a"), cfg);
  assert.equal(pickRawDailyConfigForGrade(doc, undefined), cfg);
});

test("grouped doc picks group config by grade; unknown grade is null", () => {
  const cfgLower = createDefaultV2Config();
  const cfgUpper = { ...createDefaultV2Config(), dayGateStart: "09:00", lessonStart: "09:00" };
  const doc = {
    scheduleMode: "grouped" as const,
    scheduleGroups: [
      { groupId: "g-lower", gradeIds: ["g1", "g2"], config: cfgLower },
      { groupId: "g-upper", gradeIds: ["g3"], config: cfgUpper },
    ],
  };
  assert.equal(pickRawDailyConfigForGrade(doc, "g2"), cfgLower);
  assert.equal(pickRawDailyConfigForGrade(doc, "g3"), cfgUpper);
  assert.equal(pickRawDailyConfigForGrade(doc, "orphan"), null);
  assert.equal(pickRawDailyConfigForGrade(doc, null), null);
});

test("GET DTO uses group id; picker maps to document shape", () => {
  const cfg = createDefaultV2Config();
  const dto = {
    scheduleMode: "grouped" as const,
    config: null,
    scheduleGroups: [{ id: "band-1", label: "Primary", gradeIds: ["x"], config: cfg }],
  };
  const v2 = pickDailyConfigV2FromApiDto(dto, "x");
  assert.ok(v2);
  assert.equal(v2!.lessonStart, cfg.lessonStart);
  assert.equal(pickDailyConfigV2FromApiDto(dto, "missing"), null);
});

test("prepareSchoolDailyConfigForApi fills array fields for JSON round-trip", () => {
  const base = createDefaultV2Config();
  const prepared = prepareSchoolDailyConfigForApi({
    ...base,
    openingBlocks: undefined as unknown as typeof base.openingBlocks,
  });
  assert.ok(Array.isArray(prepared.openingBlocks));
  assert.ok(Array.isArray(prepared.breaks));
});