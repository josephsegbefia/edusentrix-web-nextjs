/**
 * School daily schedule config — v2 extends v1 with opening blocks, staggered breaks,
 * per-period lengths, and is the format stored after migration.
 */
export const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export type DailyBreakItem = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
};

/** Staggered / scoped breaks: omit appliesToGradeIds = whole school. */
export type DailyBreakItemV2 = DailyBreakItem & {
  appliesToGradeIds?: string[];
};

export type OpeningBlockKind = "assembly" | "registration" | "other";

export type OpeningBlock = {
  id: string;
  name: string;
  kind: OpeningBlockKind;
  startTime: string;
  endTime: string;
};

export type PeriodLengthOverride = {
  /** 1-based period index in the teaching day. */
  periodIndex: number;
  minutes: number;
};

export type SchoolDailyScheduleConfigV1 = {
  version: 1;
  lessonStart: string;
  dayEnd: string;
  periodLengthMinutes: number;
  breaks: DailyBreakItem[];
  allWeekdaysSame: boolean;
  weekdayExceptions: Array<{
    weekday: WeekdayKey;
    lessonStart: string;
    dayEnd: string;
    periodLengthMinutes: number;
    breaks: DailyBreakItem[];
  }>;
  hasGradeOverrides: boolean;
  gradeOverrides: Array<{
    gradeIds: string[];
    lessonStart?: string;
    dayEnd?: string;
    periodLengthMinutes?: number;
    breaks?: DailyBreakItem[];
  }>;
};

export type DayCoreV2 = {
  /** First bell / gate; teaching periods run from lessonStart. */
  dayGateStart: string;
  lessonStart: string;
  dayEnd: string;
  periodLengthMinutes: number;
  periodLengthOverrides: PeriodLengthOverride[];
  /** Non-teaching time before the first period (assembly, registration, etc.). */
  openingBlocks: OpeningBlock[];
  breaks: DailyBreakItemV2[];
};

export type SchoolDailyScheduleConfigV2 = {
  version: 2;
} & DayCoreV2 & {
  allWeekdaysSame: boolean;
  weekdayExceptions: Array<{
    weekday: WeekdayKey;
    dayGateStart?: string;
    lessonStart: string;
    dayEnd: string;
    periodLengthMinutes: number;
    periodLengthOverrides?: PeriodLengthOverride[];
    openingBlocks?: OpeningBlock[];
    breaks: DailyBreakItemV2[];
  }>;
  hasGradeOverrides: boolean;
  gradeOverrides: Array<{
    gradeIds: string[];
    dayGateStart?: string;
    lessonStart?: string;
    dayEnd?: string;
    periodLengthMinutes?: number;
    periodLengthOverrides?: PeriodLengthOverride[];
    openingBlocks?: OpeningBlock[];
    breaks?: DailyBreakItemV2[];
  }>;
};

export type SchoolDailyScheduleConfig = SchoolDailyScheduleConfigV2;

export type ScheduleHistoryEntry = {
  revision: number;
  savedAt: string;
  savedBy?: string;
  label?: string;
  academicPeriodId?: string;
  config: SchoolDailyScheduleConfigV2;
};
