// src/models/SchoolSettings.ts
import { Schema, model, models, Types } from "mongoose";

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
 * Period/lesson slot configuration
 */
export interface IPeriodSlot {
  periodNumber: number; // 1, 2, 3...
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  label?: string; // Optional custom label like "Period 1"
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
 * School-wide settings for a single school
 * One document per school
 */
export interface ISchoolSettings {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;

  // Daily Schedule
  schoolStartTime: string; // "HH:MM" - when school day begins
  schoolEndTime: string; // "HH:MM" - when school day ends
  periodDuration: number; // default period length in minutes (e.g., 40)
  periodsPerDay: number; // number of teaching periods (e.g., 8)

  // Period slots (auto-generated or custom)
  periodSlots?: IPeriodSlot[];

  // Breaks
  breaks: IBreakPeriod[];

  // Assembly
  assembly?: IAssemblyConfig;

  // Attendance Rules
  lateArrivalCutoff?: string; // "HH:MM" - after this = late (e.g., "07:45")
  minimumAttendancePercent?: number; // for promotion (e.g., 75)

  // Academic Calendar Defaults
  defaultExamWeekDuration?: number; // days
  defaultRevisionWeekDuration?: number; // days

  // Operational
  workingDays: number[]; // 0-6, e.g., [1,2,3,4,5] for Mon-Fri

  // Feature Flags
  teacherStudio?: {
    enabled: boolean;
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

const SchoolSettingsSchema = new Schema<ISchoolSettings>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      unique: true, // One settings document per school
      index: true,
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

    // Breaks
    breaks: {
      type: [BreakPeriodSchema],
      default: [
        { name: "Short Break", startTime: "10:00", endTime: "10:20", isLunch: false },
        { name: "Lunch", startTime: "12:00", endTime: "13:00", isLunch: true },
      ],
    },

    // Assembly
    assembly: { type: AssemblyConfigSchema, default: undefined },

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

    // Feature Flags
    teacherStudio: {
      enabled: { type: Boolean, default: true },
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

export const SchoolSettings =
  models.SchoolSettings ||
  model<ISchoolSettings>("SchoolSettings", SchoolSettingsSchema);
