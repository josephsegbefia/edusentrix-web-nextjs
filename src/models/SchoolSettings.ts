// src/models/SchoolSettings.ts
import { Schema, model, models, Types, type Model } from "mongoose";

/**
 * Break period configuration
 */
export interface IBreakPeriod {
  name: string; // e.g., "Short Break", "Lunch"
  startTime: string; // "HH:MM" format
  endTime: string; // "HH:MM" format
  isLunch?: boolean;
}

/**
 * Per-day break override (e.g., earlier lunch on Friday)
 */
export interface IBreakDailyOverride {
  dayOfWeek: number; // 0-6
  breakName: string; // matches IBreakPeriod.name
  startTime?: string; // "HH:MM"
  endTime?: string; // "HH:MM"
}

/**
 * Per-grade break override (e.g., different lunch time for secondary)
 */
export interface IBreakGradeOverride {
  gradeId: Types.ObjectId;
  breakName: string; // matches IBreakPeriod.name
  startTime?: string; // "HH:MM"
  endTime?: string; // "HH:MM"
}

/**
 * Period/lesson slot configuration
 */
export interface IPeriodSlot {
  periodNumber: number; // 1, 2, 3...
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  label?: string; // Optional custom label like "Period 1"
}

/**
 * Per-day schedule override (e.g., early dismissal on Friday)
 */
export interface IDailyScheduleOverride {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime?: string; // "HH:MM"
  endTime?: string; // "HH:MM"
}

/**
 * Per-grade schedule override (e.g., primary vs secondary)
 */
export interface IGradeScheduleOverride {
  gradeId: Types.ObjectId;
  periodsPerDay?: number;
  periodDuration?: number;
  periodSlots?: IPeriodSlot[];
}

/**
 * Per-day school schedule used by the timetable builder.
 * Period count is derived automatically from start/end, breaks, and duration.
 */
export interface IDayScheduleConfig {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  periodDuration?: number | null; // minutes
  startTime?: string | null; // "HH:MM"
  endTime?: string | null; // "HH:MM"
  breaks?: IBreakPeriod[];
}

/**
 * Grade-level schedule profile that can be assigned to one or more grades.
 * Missing day entries fall back to the school-wide per-day schedule.
 */
export interface IGradeDayScheduleProfile {
  _id?: Types.ObjectId;
  name: string;
  gradeIds: Types.ObjectId[];
  daySchedules?: IDayScheduleConfig[];
}

/**
 * Assembly configuration
 */
export interface IAssemblyConfig {
  days: number[]; // 0-6 (Sunday-Saturday), e.g., [1, 5] for Monday & Friday
  startTime: string; // "HH:MM"
  duration: number; // minutes
  location?: string;
}

/**
 * Per-day assembly override (e.g., shorter assembly on Friday)
 */
export interface IAssemblyDailyOverride {
  dayOfWeek: number; // 0-6
  startTime?: string; // "HH:MM"
  duration?: number; // minutes
}

/**
 * Per-grade assembly override (e.g., later/shorter assembly for kindergarten)
 */
export interface IAssemblyGradeOverride {
  gradeId: Types.ObjectId;
  startTime?: string; // "HH:MM"
  duration?: number; // minutes
}

/**
 * School-wide settings for a single school
 * One document per school
 */
export interface ISchoolSettings {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;

  // Timetable schedule model
  scheduleModelVersion?: number;
  daySchedules?: IDayScheduleConfig[];
  gradeDayScheduleProfiles?: IGradeDayScheduleProfile[];

  // Daily Schedule
  schoolStartTime: string; // "HH:MM" - when school day begins
  schoolEndTime: string; // "HH:MM" - when school day ends
  periodDuration: number; // default period length in minutes (e.g., 40)
  periodsPerDay: number; // number of teaching periods (e.g., 8)

  // Period slots (auto-generated or custom)
  periodSlots?: IPeriodSlot[];

  // Per-day overrides (e.g., early dismissal on Friday)
  dailyScheduleOverrides?: IDailyScheduleOverride[];

  // Per-grade overrides (e.g., primary 7×35 vs secondary 8×40)
  gradeScheduleOverrides?: IGradeScheduleOverride[];

  // Breaks
  breaks: IBreakPeriod[];

  // Per-day break overrides (e.g., earlier lunch on Friday)
  breakDailyOverrides?: IBreakDailyOverride[];

  // Per-grade break overrides (e.g., different lunch time for secondary)
  breakGradeOverrides?: IBreakGradeOverride[];

  // Assembly
  assembly?: IAssemblyConfig;

  // Per-day assembly overrides (e.g., shorter assembly on Friday)
  assemblyDailyOverrides?: IAssemblyDailyOverride[];

  // Per-grade assembly overrides (e.g., different time for kindergarten)
  assemblyGradeOverrides?: IAssemblyGradeOverride[];

  // Attendance Rules
  lateArrivalCutoff?: string; // "HH:MM" - after this = late (e.g., "07:45")
  minimumAttendancePercent?: number; // for promotion (e.g., 75)

  // Academic Calendar Defaults
  defaultExamWeekDuration?: number; // days
  defaultRevisionWeekDuration?: number; // days

  // Operational
  workingDays: number[]; // 0-6, e.g., [1,2,3,4,5] for Mon-Fri

  /** Leo Copilot (spec: SchoolSettings.leo) */
  leo?: {
    accessOverride: "inherit" | "enabled" | "disabled";
    entitlementBypass: boolean;
    roleOverrides?: {
      school_admin?: "inherit" | "enabled" | "disabled";
      teacher?: "inherit" | "enabled" | "disabled";
      parent?: "inherit" | "enabled" | "disabled";
      student?: "inherit" | "enabled" | "disabled";
      bursar?: "inherit" | "enabled" | "disabled";
      billing_owner?: "inherit" | "enabled" | "disabled";
    };
    allowWriteActions: boolean;
    allowBulkActions: boolean;
    allowDrafting: boolean;
    allowMonitors: boolean;
    retentionDays: number;
    defaultModelProfile: "low_cost" | "balanced" | "high_quality";
    privacyMode: "strict" | "balanced";
    ui?: {
      floatingPaneEnabled: boolean;
      homeSummaryCardsEnabled: boolean;
    };
  };

  // Feature Flags
  teacherStudio?: {
    enabled: boolean;
  };

  attendanceNotifications?: {
    enabled: boolean;
    channels?: {
      whatsapp: boolean;
      sms: boolean;
      email: boolean;
    };
  };

  offlineMode?: {
    enabled: boolean;
  };

  promotions?: {
    autoPreviewEnabled: boolean;
    autoPreviewLeadDays: number;
  };

  // Metadata
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BreakPeriodSchema = new Schema<IBreakPeriod>(
  {
    name: { type: String, required: true, trim: true },
    startTime: {
      type: String,
      required: true,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    endTime: {
      type: String,
      required: true,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    isLunch: { type: Boolean, default: false },
  },
  { _id: false }
);

const BreakDailyOverrideSchema = new Schema<IBreakDailyOverride>(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    breakName: { type: String, required: true, trim: true },
    startTime: {
      type: String,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    endTime: {
      type: String,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
  },
  { _id: false }
);

const BreakGradeOverrideSchema = new Schema<IBreakGradeOverride>(
  {
    gradeId: {
      type: Schema.Types.ObjectId,
      ref: "Grade",
      required: true,
    },
    breakName: { type: String, required: true, trim: true },
    startTime: {
      type: String,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    endTime: {
      type: String,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
  },
  { _id: false }
);

const PeriodSlotSchema = new Schema<IPeriodSlot>(
  {
    periodNumber: { type: Number, required: true, min: 1 },
    startTime: {
      type: String,
      required: true,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    endTime: {
      type: String,
      required: true,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    label: { type: String, trim: true },
  },
  { _id: false }
);

const DailyScheduleOverrideSchema = new Schema<IDailyScheduleOverride>(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: {
      type: String,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    endTime: {
      type: String,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
  },
  { _id: false }
);

const GradeScheduleOverrideSchema = new Schema<IGradeScheduleOverride>(
  {
    gradeId: {
      type: Schema.Types.ObjectId,
      ref: "Grade",
      required: true,
    },
    periodsPerDay: { type: Number, min: 1, max: 15 },
    periodDuration: { type: Number, min: 15, max: 120 },
    periodSlots: { type: [PeriodSlotSchema], default: undefined },
  },
  { _id: false }
);

const DayScheduleConfigSchema = new Schema<IDayScheduleConfig>(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    periodDuration: { type: Number, min: 15, max: 120, default: null },
    startTime: {
      type: String,
      default: null,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    endTime: {
      type: String,
      default: null,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    breaks: { type: [BreakPeriodSchema], default: undefined },
  },
  { _id: false }
);

const GradeDayScheduleProfileSchema = new Schema<IGradeDayScheduleProfile>(
  {
    name: { type: String, required: true, trim: true },
    gradeIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Grade",
        required: true,
      },
    ],
    daySchedules: {
      type: [DayScheduleConfigSchema],
      default: undefined,
    },
  },
  { _id: true }
);

const AssemblyConfigSchema = new Schema<IAssemblyConfig>(
  {
    days: [{ type: Number, min: 0, max: 6 }],
    startTime: {
      type: String,
      required: true,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    duration: { type: Number, required: true, min: 1, max: 180 }, // max 3 hours
    location: { type: String, trim: true },
  },
  { _id: false }
);

const AssemblyDailyOverrideSchema = new Schema<IAssemblyDailyOverride>(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: {
      type: String,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    duration: { type: Number, min: 1, max: 180 },
  },
  { _id: false }
);

const AssemblyGradeOverrideSchema = new Schema<IAssemblyGradeOverride>(
  {
    gradeId: {
      type: Schema.Types.ObjectId,
      ref: "Grade",
      required: true,
    },
    startTime: {
      type: String,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    duration: { type: Number, min: 1, max: 180 },
  },
  { _id: false }
);

const RoleLeoOverrideSchema = new Schema(
  {
    school_admin: { type: String, enum: ["inherit", "enabled", "disabled"] },
    teacher: { type: String, enum: ["inherit", "enabled", "disabled"] },
    parent: { type: String, enum: ["inherit", "enabled", "disabled"] },
    student: { type: String, enum: ["inherit", "enabled", "disabled"] },
    bursar: { type: String, enum: ["inherit", "enabled", "disabled"] },
    billing_owner: { type: String, enum: ["inherit", "enabled", "disabled"] },
  },
  { _id: false }
);

const SchoolLeoSettingsSchema = new Schema(
  {
    accessOverride: {
      type: String,
      enum: ["inherit", "enabled", "disabled"],
      default: "inherit",
    },
    entitlementBypass: { type: Boolean, default: false },
    roleOverrides: { type: RoleLeoOverrideSchema, default: undefined },
    allowWriteActions: { type: Boolean, default: false },
    allowBulkActions: { type: Boolean, default: false },
    allowDrafting: { type: Boolean, default: true },
    allowMonitors: { type: Boolean, default: false },
    retentionDays: { type: Number, min: 1, max: 3650, default: 90 },
    defaultModelProfile: {
      type: String,
      enum: ["low_cost", "balanced", "high_quality"],
      default: "balanced",
    },
    privacyMode: {
      type: String,
      enum: ["strict", "balanced"],
      default: "balanced",
    },
    ui: {
      type: new Schema(
        {
          floatingPaneEnabled: { type: Boolean, default: true },
          homeSummaryCardsEnabled: { type: Boolean, default: false },
        },
        { _id: false }
      ),
      default: undefined,
    },
  },
  { _id: false }
);

const SchoolSettingsSchema = new Schema<ISchoolSettings>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      unique: true, // One settings document per school
      index: true,
    },

    scheduleModelVersion: {
      type: Number,
      default: 1,
      min: 1,
      max: 2,
    },
    daySchedules: {
      type: [DayScheduleConfigSchema],
      default: undefined,
    },
    gradeDayScheduleProfiles: {
      type: [GradeDayScheduleProfileSchema],
      default: undefined,
    },

    // Daily Schedule
    schoolStartTime: {
      type: String,
      required: true,
      default: "07:30",
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    schoolEndTime: {
      type: String,
      required: true,
      default: "15:00",
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    periodDuration: {
      type: Number,
      required: true,
      default: 40,
      min: 15,
      max: 120,
    },
    periodsPerDay: {
      type: Number,
      required: true,
      default: 8,
      min: 1,
      max: 15,
    },

    // Period slots
    periodSlots: { type: [PeriodSlotSchema], default: undefined },

    // Per-day overrides
    dailyScheduleOverrides: {
      type: [DailyScheduleOverrideSchema],
      default: undefined,
    },

    // Per-grade overrides
    gradeScheduleOverrides: {
      type: [GradeScheduleOverrideSchema],
      default: undefined,
    },

    // Breaks
    breaks: {
      type: [BreakPeriodSchema],
      default: [
        { name: "Short Break", startTime: "10:00", endTime: "10:20", isLunch: false },
        { name: "Lunch", startTime: "12:00", endTime: "13:00", isLunch: true },
      ],
    },
    breakDailyOverrides: {
      type: [BreakDailyOverrideSchema],
      default: undefined,
    },
    breakGradeOverrides: {
      type: [BreakGradeOverrideSchema],
      default: undefined,
    },

    // Assembly
    assembly: { type: AssemblyConfigSchema, default: undefined },
    assemblyDailyOverrides: {
      type: [AssemblyDailyOverrideSchema],
      default: undefined,
    },
    assemblyGradeOverrides: {
      type: [AssemblyGradeOverrideSchema],
      default: undefined,
    },

    // Attendance Rules
    lateArrivalCutoff: {
      type: String,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    minimumAttendancePercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 75,
    },

    // Academic Calendar Defaults
    defaultExamWeekDuration: { type: Number, min: 1, max: 21, default: 5 },
    defaultRevisionWeekDuration: { type: Number, min: 1, max: 14, default: 5 },

    // Operational
    workingDays: {
      type: [Number],
      default: [1, 2, 3, 4, 5], // Monday to Friday
      validate: {
        validator: (arr: number[]) =>
          arr.every((d) => d >= 0 && d <= 6) && new Set(arr).size === arr.length,
        message: "Working days must be unique values between 0-6",
      },
    },

    leo: { type: SchoolLeoSettingsSchema, default: undefined },

    // Feature Flags
    teacherStudio: {
      enabled: { type: Boolean, default: true },
    },

    attendanceNotifications: {
      enabled: { type: Boolean, default: true },
      channels: {
        whatsapp: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        email: { type: Boolean, default: false },
      },
    },

    offlineMode: {
      enabled: { type: Boolean, default: true },
    },

    promotions: {
      autoPreviewEnabled: { type: Boolean, default: false },
      autoPreviewLeadDays: { type: Number, min: 0, max: 60, default: 7 },
    },

    // Metadata
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// Helper method to generate default period slots based on settings
SchoolSettingsSchema.methods.generatePeriodSlots = function (): IPeriodSlot[] {
  const slots: IPeriodSlot[] = [];
  const startMinutes = timeToMinutes(this.schoolStartTime);
  const breaks = [...(this.breaks || [])].sort((a, b) =>
    timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  let currentTime = startMinutes;
  let periodNum = 1;

  // Handle assembly if it's at the start
  if (this.assembly && this.assembly.startTime === this.schoolStartTime) {
    currentTime += this.assembly.duration;
  }

  while (periodNum <= this.periodsPerDay) {
    // Check if we hit a break
    const breakPeriod = breaks.find(
      (b) =>
        timeToMinutes(b.startTime) <= currentTime &&
        currentTime < timeToMinutes(b.endTime)
    );

    if (breakPeriod) {
      currentTime = timeToMinutes(breakPeriod.endTime);
      continue;
    }

    // Check if next period would overlap with a break
    const nextBreak = breaks.find(
      (b) =>
        currentTime < timeToMinutes(b.startTime) &&
        currentTime + this.periodDuration > timeToMinutes(b.startTime)
    );

    if (nextBreak) {
      // Period ends at break start
      const periodEnd = timeToMinutes(nextBreak.startTime);
      if (periodEnd - currentTime >= 15) {
        // Only create period if at least 15 mins
        slots.push({
          periodNumber: periodNum,
          startTime: minutesToTime(currentTime),
          endTime: minutesToTime(periodEnd),
        });
        periodNum++;
      }
      currentTime = timeToMinutes(nextBreak.endTime);
    } else {
      // Normal period
      slots.push({
        periodNumber: periodNum,
        startTime: minutesToTime(currentTime),
        endTime: minutesToTime(currentTime + this.periodDuration),
      });
      currentTime += this.periodDuration;
      periodNum++;
    }
  }

  return slots;
};

// Helper functions
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export const SchoolSettings: Model<ISchoolSettings> =
  (models.SchoolSettings as Model<ISchoolSettings>) ||
  model<ISchoolSettings>("SchoolSettings", SchoolSettingsSchema);
