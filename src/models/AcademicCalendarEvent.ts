import { Schema, model, models, Types, type Model } from "mongoose";

export type CalendarEventStatus = "draft" | "published" | "cancelled";
export type CalendarEventType =
  | "academic"
  | "exam"
  | "holiday"
  | "sports"
  | "meeting"
  | "activity"
  | "non_teaching_day"
  | "custom";

export type CalendarAudienceScope = "school" | "grades" | "classes";

export type CalendarRecurrenceFrequency =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

export type CalendarEditorScope = "calendar" | "event";

export interface CalendarAudience {
  scope: CalendarAudienceScope;
  gradeIds?: Types.ObjectId[];
  classGroupIds?: Types.ObjectId[];
  roles?: string[];
}

export interface CalendarRecurrence {
  frequency: CalendarRecurrenceFrequency;
  interval?: number;
  byWeekday?: number[];
  byMonthDay?: number[];
  until?: Date;
  count?: number;
}

export interface CalendarReminder {
  minutesBefore: number;
  channel?: "in_app";
}

export interface IAcademicCalendarEvent {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  calendarId: Types.ObjectId;
  academicPeriodId?: Types.ObjectId | null;
  title: string;
  description?: string | null;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  location?: string | null;
  color?: string | null;
  coverImageUrl?: string | null;
  status: CalendarEventStatus;
  eventType: CalendarEventType;
  isNonTeachingDay: boolean;
  audience: CalendarAudience;
  recurrence?: CalendarRecurrence | null;
  editorScope: CalendarEditorScope;
  editorIds?: Types.ObjectId[];
  reminders?: CalendarReminder[];
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const audienceSchema = new Schema<CalendarAudience>(
  {
    scope: {
      type: String,
      enum: ["school", "grades", "classes"],
      default: "school",
    },
    gradeIds: [{ type: Schema.Types.ObjectId, ref: "Grade", default: [] }],
    classGroupIds: [
      { type: Schema.Types.ObjectId, ref: "ClassGroup", default: [] },
    ],
    roles: [{ type: String, default: [] }],
  },
  { _id: false }
);

const recurrenceSchema = new Schema<CalendarRecurrence>(
  {
    frequency: {
      type: String,
      enum: ["none", "daily", "weekly", "monthly", "yearly"],
      default: "none",
    },
    interval: { type: Number, default: 1, min: 1, max: 365 },
    byWeekday: { type: [Number], default: [] },
    byMonthDay: { type: [Number], default: [] },
    until: { type: Date, default: null },
    count: { type: Number, default: null },
  },
  { _id: false }
);

const reminderSchema = new Schema<CalendarReminder>(
  {
    minutesBefore: { type: Number, required: true, min: 0 },
    channel: { type: String, enum: ["in_app"], default: "in_app" },
  },
  { _id: false }
);

const academicCalendarEventSchema = new Schema<IAcademicCalendarEvent>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    calendarId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicCalendar",
      required: true,
      index: true,
    },
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      default: null,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    allDay: { type: Boolean, default: false },
    location: { type: String, default: null, trim: true },
    color: { type: String, default: null, trim: true },
    coverImageUrl: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: ["draft", "published", "cancelled"],
      default: "draft",
      index: true,
    },
    eventType: {
      type: String,
      enum: [
        "academic",
        "exam",
        "holiday",
        "sports",
        "meeting",
        "activity",
        "non_teaching_day",
        "custom",
      ],
      default: "academic",
      index: true,
    },
    isNonTeachingDay: { type: Boolean, default: false },
    audience: { type: audienceSchema, default: () => ({ scope: "school" }) },
    recurrence: { type: recurrenceSchema, default: null },
    editorScope: {
      type: String,
      enum: ["calendar", "event"],
      default: "calendar",
    },
    editorIds: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    reminders: { type: [reminderSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

academicCalendarEventSchema.index({ calendarId: 1, startDate: 1 });
academicCalendarEventSchema.index({ schoolId: 1, status: 1, startDate: 1 });

export const AcademicCalendarEvent: Model<IAcademicCalendarEvent> =
  (models.AcademicCalendarEvent as Model<IAcademicCalendarEvent>) ||
  model<IAcademicCalendarEvent>(
    "AcademicCalendarEvent",
    academicCalendarEventSchema
  );
