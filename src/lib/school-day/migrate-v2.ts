import type {
  DailyBreakItemV2,
  SchoolDailyScheduleConfigV1,
  SchoolDailyScheduleConfigV2,
} from "@/types/school-daily-schedule";
import { normalizeLegacySchoolDailyConfig } from "./normalize-legacy";

function asV2Breaks(
  rows: { id: string; name: string; startTime: string; endTime: string }[]
): DailyBreakItemV2[] {
  return rows.map((b) => ({ ...b }));
}

function mergeV2(
  v: Partial<SchoolDailyScheduleConfigV2> & { version: 2 }
): SchoolDailyScheduleConfigV2 {
  return {
    version: 2,
    dayGateStart: String(v.dayGateStart ?? v.lessonStart ?? "08:00"),
    lessonStart: String(v.lessonStart ?? "08:00"),
    dayEnd: String(v.dayEnd ?? "15:00"),
    periodLengthMinutes: Math.min(
      120,
      Math.max(5, Number(v.periodLengthMinutes ?? 40))
    ),
    periodLengthOverrides: Array.isArray(v.periodLengthOverrides) ? v.periodLengthOverrides : [],
    openingBlocks: Array.isArray(v.openingBlocks) ? v.openingBlocks : [],
    breaks: Array.isArray(v.breaks) ? v.breaks : [],
    allWeekdaysSame: v.allWeekdaysSame !== false,
    weekdayExceptions: Array.isArray(v.weekdayExceptions) ? v.weekdayExceptions : [],
    hasGradeOverrides: Boolean(v.hasGradeOverrides),
    gradeOverrides: Array.isArray(v.gradeOverrides) ? v.gradeOverrides : [],
  };
}

/**
 * v1 (with or without version field) -> v2, or merge v2 partials.
 */
export function ensureConfigV2(input: unknown): SchoolDailyScheduleConfigV2 {
  const n = normalizeLegacySchoolDailyConfig(input) as unknown;
  if (!n || typeof n !== "object") {
    throw new Error("Invalid config");
  }
  const c = n as { version?: number };
  if (c.version === 2) {
    return mergeV2(n as Partial<SchoolDailyScheduleConfigV2> & { version: 2 });
  }
  return migrateV1ToV2({
    version: 1,
    lessonStart: (n as { lessonStart?: string }).lessonStart ?? "08:00",
    dayEnd: (n as { dayEnd?: string }).dayEnd ?? "15:00",
    periodLengthMinutes: (n as { periodLengthMinutes?: number }).periodLengthMinutes ?? 40,
    breaks: ((n as { breaks?: SchoolDailyScheduleConfigV1["breaks"] }).breaks ??
      []) as SchoolDailyScheduleConfigV1["breaks"],
    allWeekdaysSame: (n as { allWeekdaysSame?: boolean }).allWeekdaysSame !== false,
    weekdayExceptions: ((n as { weekdayExceptions?: SchoolDailyScheduleConfigV1["weekdayExceptions"] })
      .weekdayExceptions ?? []) as SchoolDailyScheduleConfigV1["weekdayExceptions"],
    hasGradeOverrides: Boolean((n as { hasGradeOverrides?: boolean }).hasGradeOverrides),
    gradeOverrides: ((n as { gradeOverrides?: SchoolDailyScheduleConfigV1["gradeOverrides"] })
      .gradeOverrides ?? []) as SchoolDailyScheduleConfigV1["gradeOverrides"],
  });
}

export function migrateV1ToV2(c: SchoolDailyScheduleConfigV1): SchoolDailyScheduleConfigV2 {
  return {
    version: 2,
    dayGateStart: c.lessonStart,
    lessonStart: c.lessonStart,
    dayEnd: c.dayEnd,
    periodLengthMinutes: c.periodLengthMinutes,
    periodLengthOverrides: [],
    openingBlocks: [],
    breaks: asV2Breaks(c.breaks),
    allWeekdaysSame: c.allWeekdaysSame,
    weekdayExceptions: c.weekdayExceptions.map((ex) => ({
      weekday: ex.weekday,
      dayGateStart: ex.lessonStart,
      lessonStart: ex.lessonStart,
      dayEnd: ex.dayEnd,
      periodLengthMinutes: ex.periodLengthMinutes,
      periodLengthOverrides: [],
      openingBlocks: [],
      breaks: asV2Breaks(ex.breaks),
    })),
    hasGradeOverrides: c.hasGradeOverrides,
    gradeOverrides: c.gradeOverrides.map((g) => ({
      gradeIds: g.gradeIds,
      lessonStart: g.lessonStart,
      dayEnd: g.dayEnd,
      periodLengthMinutes: g.periodLengthMinutes,
      breaks: g.breaks ? asV2Breaks(g.breaks) : undefined,
    })),
  };
}

export function createDefaultV2Config(): SchoolDailyScheduleConfigV2 {
  return {
    version: 2,
    dayGateStart: "08:00",
    lessonStart: "08:00",
    dayEnd: "15:00",
    periodLengthMinutes: 40,
    periodLengthOverrides: [],
    openingBlocks: [],
    breaks: [],
    allWeekdaysSame: true,
    weekdayExceptions: [],
    hasGradeOverrides: false,
    gradeOverrides: [],
  };
}

/**
 * Ensures the config shape survives `JSON.stringify` to the save API. If `openingBlocks` or
 * `periodLengthOverrides` (etc.) are `undefined`, the keys are omitted; the server then uses
 * `ensureConfigV2` + Zod defaults → empty `[]` and non-teaching / overrides are lost silently.
 */
export function prepareSchoolDailyConfigForApi(
  c: SchoolDailyScheduleConfigV2
): SchoolDailyScheduleConfigV2 {
  return {
    ...c,
    openingBlocks: Array.isArray(c.openingBlocks) ? c.openingBlocks : [],
    periodLengthOverrides: Array.isArray(c.periodLengthOverrides) ? c.periodLengthOverrides : [],
    breaks: Array.isArray(c.breaks) ? c.breaks : [],
    weekdayExceptions: Array.isArray(c.weekdayExceptions) ? c.weekdayExceptions : [],
    gradeOverrides: c.hasGradeOverrides
      ? Array.isArray(c.gradeOverrides)
        ? c.gradeOverrides
        : []
      : [],
  };
}
