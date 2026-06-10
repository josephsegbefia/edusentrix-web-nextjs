import { z } from "zod";
import type {
  DailyBreakItem,
  SchoolDailyScheduleConfigV2,
} from "@/types/school-daily-schedule";
import { WEEKDAY_KEYS, type WeekdayKey } from "@/types/school-daily-schedule";
import { normalizeLegacySchoolDailyConfig } from "./normalize-legacy";
import { ensureConfigV2 } from "./migrate-v2";
import { validateOpeningBlocks } from "./opening-validation";
import { filterBreaksForGrade, simulateTeachingPeriods } from "./teaching-sim";
import type { DailyBreakItemV2 } from "@/types/school-daily-schedule";

const TimeRegex = /^([01]?\d|2[0-3]):[0-5]\d$/;

const BreakV2Z = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(100).trim(),
  startTime: z.string().regex(TimeRegex, "Use HH:MM (24h)"),
  endTime: z.string().regex(TimeRegex, "Use HH:MM (24h)"),
  appliesToGradeIds: z.array(z.string().min(1).max(64)).max(48).optional(),
});

const OpeningZ = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(100).trim(),
  kind: z.enum(["assembly", "registration", "other"]),
  startTime: z.string().regex(TimeRegex),
  endTime: z.string().regex(TimeRegex),
});

const PeriodOverrideZ = z.object({
  periodIndex: z.number().int().min(1).max(32),
  minutes: z.number().int().min(5).max(120),
});

const WeekdayZ = z.enum(
  WEEKDAY_KEYS as unknown as [WeekdayKey, ...WeekdayKey[]]
);

const DayExceptionV2Z = z.object({
  weekday: WeekdayZ,
  dayGateStart: z.string().regex(TimeRegex).optional(),
  lessonStart: z.string().regex(TimeRegex),
  dayEnd: z.string().regex(TimeRegex),
  periodLengthMinutes: z.number().int().min(5).max(120),
  periodLengthOverrides: z.array(PeriodOverrideZ).max(32).optional(),
  openingBlocks: z.array(OpeningZ).max(12).optional(),
  breaks: z.array(BreakV2Z).max(32),
});

const GradeOverrideV2Z = z.object({
  gradeIds: z
    .array(z.string().min(1).max(64))
    .min(1, "Add at least one grade")
    .max(48),
  dayGateStart: z.string().regex(TimeRegex).optional(),
  lessonStart: z.string().regex(TimeRegex).optional(),
  dayEnd: z.string().regex(TimeRegex).optional(),
  periodLengthMinutes: z.number().int().min(5).max(120).optional(),
  periodLengthOverrides: z.array(PeriodOverrideZ).max(32).optional(),
  openingBlocks: z.array(OpeningZ).max(12).optional(),
  breaks: z.array(BreakV2Z).max(32).optional(),
});

const SchoolDailyScheduleConfigV2Z = z
  .object({
    version: z.literal(2),
    dayGateStart: z.string().regex(TimeRegex),
    lessonStart: z.string().regex(TimeRegex),
    dayEnd: z.string().regex(TimeRegex),
    periodLengthMinutes: z.number().int().min(5).max(120),
    periodLengthOverrides: z.array(PeriodOverrideZ).max(32).default([]),
    openingBlocks: z.array(OpeningZ).max(12).default([]),
    breaks: z.array(BreakV2Z).max(32),
    allWeekdaysSame: z.boolean(),
    weekdayExceptions: z.array(DayExceptionV2Z),
    hasGradeOverrides: z.boolean(),
    gradeOverrides: z.array(GradeOverrideV2Z),
  })
  .superRefine((val, ctx) => {
    const idx = (val.periodLengthOverrides ?? []).map((o) => o.periodIndex);
    if (idx.length !== new Set(idx).size) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each period can only have one custom length on the same day.",
        path: ["periodLengthOverrides"],
      });
    }
    if (!val.allWeekdaysSame) {
      if (val.weekdayExceptions.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Add at least one different weekday, or use the same schedule for all days.",
          path: ["weekdayExceptions"],
        });
      }
      const seen = new Set<string>();
      for (const ex of val.weekdayExceptions) {
        if (seen.has(ex.weekday)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate weekday: ${ex.weekday}`,
            path: ["weekdayExceptions"],
          });
        }
        seen.add(ex.weekday);
        const pidx = (ex.periodLengthOverrides ?? []).map((o) => o.periodIndex);
        if (pidx.length !== new Set(pidx).size) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Each period can only have one custom length in the same day.",
            path: ["weekdayExceptions"],
          });
        }
      }
    }
    if (val.hasGradeOverrides) {
      if (val.gradeOverrides.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Add at least one grade override, or turn off grade-specific schedules.",
          path: ["gradeOverrides"],
        });
      }
      const gSeen = new Set<string>();
      for (const g of val.gradeOverrides) {
        if (new Set(g.gradeIds).size !== g.gradeIds.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "The same grade cannot be listed twice in one override group.",
            path: ["gradeOverrides"],
          });
        }
        for (const gid of g.gradeIds) {
          if (gSeen.has(gid)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Each grade can only appear in one override group.",
              path: ["gradeOverrides"],
            });
            break;
          }
          gSeen.add(gid);
        }
        const pidx2 = (g.periodLengthOverrides ?? []).map((o) => o.periodIndex);
        if (pidx2.length !== new Set(pidx2).size) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Each period can only have one custom length in the same day.",
            path: ["gradeOverrides"],
          });
        }
        const hasField =
          g.dayGateStart != null ||
          g.lessonStart != null ||
          g.dayEnd != null ||
          g.periodLengthMinutes != null ||
          (g.periodLengthOverrides != null && g.periodLengthOverrides.length > 0) ||
          (g.openingBlocks != null && g.openingBlocks.length > 0) ||
          (g.breaks != null && g.breaks.length > 0);
        if (!hasField) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Each override group must set at least one difference from the main schedule.",
            path: ["gradeOverrides"],
          });
        }
      }
    }
  });

export type ParseResult =
  | { ok: true; config: SchoolDailyScheduleConfigV2; warnings: string[] }
  | { ok: false; error: string; details?: z.ZodError };

export { normalizeLegacySchoolDailyConfig } from "./normalize-legacy";

function collectStaggeredGradeIds(breaks: DailyBreakItemV2[]): Set<string> {
  const s = new Set<string>();
  for (const b of breaks) {
    b.appliesToGradeIds?.forEach((g) => s.add(g));
  }
  return s;
}

function assertTeachingDay(
  label: string,
  lessonStart: string,
  dayEnd: string,
  defaultLen: number,
  overrides: SchoolDailyScheduleConfigV2["periodLengthOverrides"],
  breaks: DailyBreakItemV2[]
): { ok: true; warnings: string[] } | { ok: false; error: string } {
  const gids = collectStaggeredGradeIds(breaks);
  const warnings: string[] = [];
  if (gids.size === 0) {
    const f = filterBreaksForGrade(breaks, null) as DailyBreakItem[];
    const sim = simulateTeachingPeriods(lessonStart, dayEnd, defaultLen, overrides, f);
    warnings.push(...sim.warnings.map((w) => `${label}: ${w}`));
    if (sim.periods.length < 1) {
      return {
        ok: false,
        error: `${label}: No full teaching period fits between breaks — adjust the day or break times.`,
      };
    }
    return { ok: true, warnings };
  }
  for (const gid of gids) {
    const f = filterBreaksForGrade(breaks, gid) as DailyBreakItem[];
    const sim = simulateTeachingPeriods(lessonStart, dayEnd, defaultLen, overrides, f);
    warnings.push(...sim.warnings.map((w) => `${label} (${gid}): ${w}`));
    if (sim.periods.length < 1) {
      return {
        ok: false,
        error: `${label}: For grade group ${gid}, no full period fits with that staggered break pattern.`,
      };
    }
  }
  if (gids.size > 0) {
    const sw = filterBreaksForGrade(breaks, null) as DailyBreakItem[];
    if (sw.length < breaks.length) {
      warnings.push(
        `${label}: Staggered breaks are in use; period counts can differ by grade. Use the timeline preview to verify.`
      );
    }
  }
  return { ok: true, warnings };
}

export function validateAndNormalizeSchoolDailySchedule(
  input: unknown
): ParseResult {
  let v2: SchoolDailyScheduleConfigV2;
  try {
    v2 = ensureConfigV2(normalizeLegacySchoolDailyConfig(input));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid schedule" };
  }
  const parsed = SchoolDailyScheduleConfigV2Z.safeParse(v2);
  if (!parsed.success) {
    return { ok: false, error: "Invalid schedule data", details: parsed.error };
  }
  const c = parsed.data;
  const allWarnings: string[] = [];

  const oDefault = validateOpeningBlocks(
    c.dayGateStart,
    c.lessonStart,
    c.openingBlocks ?? []
  );
  if (!oDefault.ok) return { ok: false, error: oDefault.error };

  if (c.openingBlocks.length > 0 && c.dayGateStart === c.lessonStart) {
    return {
      ok: false,
      error: "Set first bell before lessons start, or clear opening blocks (assembly / registration, etc.).",
    };
  }

  const defaultTeaching = assertTeachingDay(
    "Default schedule",
    c.lessonStart,
    c.dayEnd,
    c.periodLengthMinutes,
    c.periodLengthOverrides ?? [],
    c.breaks
  );
  if (!defaultTeaching.ok) return { ok: false, error: defaultTeaching.error };
  allWarnings.push(...defaultTeaching.warnings);

  if (!c.allWeekdaysSame) {
    for (const ex of c.weekdayExceptions) {
      const gate = ex.dayGateStart ?? ex.lessonStart;
      const obs = ex.openingBlocks ?? [];
      if (obs.length) {
        const o = validateOpeningBlocks(gate, ex.lessonStart, obs);
        if (!o.ok) return { ok: false, error: `${ex.weekday}: ${o.error}` };
        if (gate === ex.lessonStart) {
          return {
            ok: false,
            error: `${ex.weekday}: set first bell before lessons or remove opening blocks for that day.`,
          };
        }
      }
      const t = assertTeachingDay(
        `${ex.weekday} schedule`,
        ex.lessonStart,
        ex.dayEnd,
        ex.periodLengthMinutes,
        ex.periodLengthOverrides ?? [],
        ex.breaks
      );
      if (!t.ok) return { ok: false, error: t.error };
      allWarnings.push(...t.warnings);
    }
  }

  if (c.hasGradeOverrides) {
    for (const g of c.gradeOverrides) {
      const start = g.lessonStart ?? c.lessonStart;
      const end = g.dayEnd ?? c.dayEnd;
      const pl = g.periodLengthMinutes ?? c.periodLengthMinutes;
      const ov = g.periodLengthOverrides ?? c.periodLengthOverrides ?? [];
      const br = g.breaks && g.breaks.length > 0 ? g.breaks : c.breaks;
      const gate = g.dayGateStart ?? c.dayGateStart;
      if ((g.openingBlocks?.length ?? 0) > 0) {
        if (gate === start) {
          return {
            ok: false,
            error: `Grade override: set a first bell time before lessons or remove non-teaching opening blocks.`,
          };
        }
        const o = validateOpeningBlocks(gate, start, g.openingBlocks!);
        if (!o.ok) {
          return { ok: false, error: `Grade override: ${o.error}` };
        }
      }
      const t = assertTeachingDay(
        `Grade override (${g.gradeIds.join(", ")})`,
        start,
        end,
        pl,
        ov,
        br
      );
      if (!t.ok) return { ok: false, error: t.error };
      allWarnings.push(...t.warnings);
    }
  }

  const config: SchoolDailyScheduleConfigV2 = {
    version: 2,
    dayGateStart: c.dayGateStart,
    lessonStart: c.lessonStart,
    dayEnd: c.dayEnd,
    periodLengthMinutes: c.periodLengthMinutes,
    periodLengthOverrides: c.periodLengthOverrides ?? [],
    openingBlocks: c.openingBlocks ?? [],
    breaks: c.breaks,
    allWeekdaysSame: c.allWeekdaysSame,
    weekdayExceptions: c.allWeekdaysSame ? [] : c.weekdayExceptions,
    hasGradeOverrides: c.hasGradeOverrides,
    gradeOverrides: c.hasGradeOverrides ? c.gradeOverrides : [],
  };
  return { ok: true, config, warnings: allWarnings };
}

export function zodErrorToMessage(err: z.ZodError): string {
  const first = err.issues[0];
  if (!first) return "Invalid input";
  return first.message;
}
