// src/models/TeacherDutyAssignment.ts
/**
 * Teacher non-teaching duty assignments (weekly duties, supervision, etc.)
 * Examples: Morning arrival supervision, Assembly monitoring, Break duty, etc.
 */
import mongoose, { Schema, model, models, Types } from "mongoose";

export type DutyCategory =
  | "supervision"    // Student supervision duties
  | "assembly"       // Assembly-related duties
  | "break"          // Break time supervision
  | "gate"           // Gate/arrival/departure duties
  | "dining"         // Dining hall supervision
  | "sports"         // Sports/PE supervision
  | "exam"           // Exam invigilation
  | "event"          // Special event duties
  | "custom";

export type DutyFrequency =
  | "daily"          // Every day
  | "weekly"         // Specific day(s) of the week
  | "rotational"     // Rotating schedule
  | "one_time";      // Single occurrence

export interface IDutyDefinition {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;

  name: string;                      // e.g., "Morning Arrival Duty"
  code: string;                      // e.g., "MORNING_DUTY"
  category: DutyCategory;
  description?: string;

  // Schedule
  frequency: DutyFrequency;
  defaultDays?: number[];            // 0-6 for weekly duties (0=Sunday)
  defaultStartTime?: string;         // e.g., "07:00"
  defaultEndTime?: string;           // e.g., "07:45"

  // Location
  location?: string;                 // e.g., "Main Gate", "Assembly Hall"

  // Requirements
  minTeachersRequired?: number;      // Minimum teachers needed
  maxTeachersAllowed?: number;       // Maximum teachers for this duty

  // Display
  color?: string;                    // For calendar/roster display
  order: number;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITeacherDutyAssignment {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;

  teacherId: Types.ObjectId;
  dutyDefinitionId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;

  // Schedule override (can differ from duty definition defaults)
  days: number[];                    // Days of the week (0-6)
  startTime: string;
  endTime: string;

  // For one-time or specific date assignments
  specificDate?: Date;

  // Week number for rotational duties
  weekNumber?: number;               // Which week in the rotation

  // Assignment details
  assignedAt: Date;
  assignedBy?: Types.ObjectId;
  startDate: Date;
  endDate?: Date;

  notes?: string;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// Schema for duty definitions
const DutyDefinitionSchema = new Schema<IDutyDefinition>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    category: {
      type: String,
      enum: ["supervision", "assembly", "break", "gate", "dining", "sports", "exam", "event", "custom"],
      default: "supervision",
    },
    description: { type: String },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "rotational", "one_time"],
      default: "weekly",
    },
    defaultDays: [{ type: Number, min: 0, max: 6 }],
    defaultStartTime: { type: String },
    defaultEndTime: { type: String },
    location: { type: String },
    minTeachersRequired: { type: Number, default: 1 },
    maxTeachersAllowed: { type: Number },
    color: { type: String },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

DutyDefinitionSchema.index({ schoolId: 1, code: 1 }, { unique: true });
DutyDefinitionSchema.index({ schoolId: 1, category: 1, order: 1 });

// Schema for duty assignments
const TeacherDutyAssignmentSchema = new Schema<ITeacherDutyAssignment>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    dutyDefinitionId: { type: Schema.Types.ObjectId, ref: "DutyDefinition", required: true },
    academicPeriodId: { type: Schema.Types.ObjectId, ref: "AcademicPeriod", required: true },
    days: [{ type: Number, min: 0, max: 6, required: true }],
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    specificDate: { type: Date },
    weekNumber: { type: Number },
    assignedAt: { type: Date, default: Date.now },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User" },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    notes: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Compound indexes
TeacherDutyAssignmentSchema.index({ schoolId: 1, academicPeriodId: 1, isActive: 1 });
TeacherDutyAssignmentSchema.index({ teacherId: 1, academicPeriodId: 1, isActive: 1 });
TeacherDutyAssignmentSchema.index({ dutyDefinitionId: 1, academicPeriodId: 1, days: 1 });

// Default duty definitions to seed
export const DEFAULT_DUTY_DEFINITIONS: Array<{
  name: string;
  code: string;
  category: DutyCategory;
  description: string;
  frequency: DutyFrequency;
  defaultDays?: number[];
  defaultStartTime?: string;
  defaultEndTime?: string;
  location?: string;
  minTeachersRequired?: number;
  color: string;
}> = [
  {
    name: "Morning Arrival Duty",
    code: "MORNING_ARRIVAL",
    category: "gate",
    description: "Supervise student arrival at school gate",
    frequency: "weekly",
    defaultDays: [1, 2, 3, 4, 5], // Mon-Fri
    defaultStartTime: "06:30",
    defaultEndTime: "07:30",
    location: "Main Gate",
    minTeachersRequired: 2,
    color: "#FF6B6B",
  },
  {
    name: "Assembly Duty",
    code: "ASSEMBLY_DUTY",
    category: "assembly",
    description: "Supervise students during morning assembly",
    frequency: "weekly",
    defaultDays: [1, 5], // Monday and Friday
    defaultStartTime: "07:30",
    defaultEndTime: "08:00",
    location: "Assembly Grounds",
    minTeachersRequired: 4,
    color: "#4ECDC4",
  },
  {
    name: "Break Time Supervision",
    code: "BREAK_SUPERVISION",
    category: "break",
    description: "Supervise students during break time",
    frequency: "weekly",
    defaultDays: [1, 2, 3, 4, 5],
    defaultStartTime: "10:00",
    defaultEndTime: "10:20",
    location: "School Compound",
    minTeachersRequired: 3,
    color: "#45B7D1",
  },
  {
    name: "Lunch Break Duty",
    code: "LUNCH_DUTY",
    category: "dining",
    description: "Supervise students during lunch",
    frequency: "weekly",
    defaultDays: [1, 2, 3, 4, 5],
    defaultStartTime: "12:00",
    defaultEndTime: "13:00",
    location: "Dining Hall",
    minTeachersRequired: 4,
    color: "#96CEB4",
  },
  {
    name: "Afternoon Departure Duty",
    code: "AFTERNOON_DEPARTURE",
    category: "gate",
    description: "Supervise student departure",
    frequency: "weekly",
    defaultDays: [1, 2, 3, 4, 5],
    defaultStartTime: "15:00",
    defaultEndTime: "15:30",
    location: "Main Gate",
    minTeachersRequired: 2,
    color: "#FFEAA7",
  },
  {
    name: "Sports/PE Supervision",
    code: "SPORTS_SUPERVISION",
    category: "sports",
    description: "Supervise sports and physical education activities",
    frequency: "weekly",
    defaultDays: [2, 4], // Tuesday and Thursday
    defaultStartTime: "14:00",
    defaultEndTime: "15:00",
    location: "Sports Field",
    minTeachersRequired: 2,
    color: "#DDA0DD",
  },
  {
    name: "Exam Invigilation",
    code: "EXAM_INVIGILATION",
    category: "exam",
    description: "Invigilate examinations",
    frequency: "one_time",
    minTeachersRequired: 1,
    color: "#B8860B",
  },
  {
    name: "Special Event Duty",
    code: "EVENT_DUTY",
    category: "event",
    description: "Duty during special school events",
    frequency: "one_time",
    minTeachersRequired: 2,
    color: "#9B59B6",
  },
];

export const DutyDefinition =
  models.DutyDefinition ||
  model<IDutyDefinition>("DutyDefinition", DutyDefinitionSchema);

export const TeacherDutyAssignment =
  models.TeacherDutyAssignment ||
  model<ITeacherDutyAssignment>("TeacherDutyAssignment", TeacherDutyAssignmentSchema);
