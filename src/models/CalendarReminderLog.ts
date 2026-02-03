import { Schema, model, models, Types } from "mongoose";

export interface ICalendarReminderLog {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  eventId: Types.ObjectId;
  userId: Types.ObjectId;
  reminderAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const calendarReminderLogSchema = new Schema<ICalendarReminderLog>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicCalendarEvent",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reminderAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

calendarReminderLogSchema.index(
  { schoolId: 1, eventId: 1, userId: 1, reminderAt: 1 },
  { unique: true }
);

export const CalendarReminderLog =
  models.CalendarReminderLog ||
  model<ICalendarReminderLog>("CalendarReminderLog", calendarReminderLogSchema);
