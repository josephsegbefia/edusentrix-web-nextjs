import { Types } from "mongoose";
import { Notification } from "@/models/Notification";
import { CalendarReminderLog } from "@/models/CalendarReminderLog";

export async function createCalendarReminderNotification(input: {
  schoolId: Types.ObjectId;
  userId: Types.ObjectId;
  eventId: Types.ObjectId;
  reminderAt: Date;
  title: string;
  body: string;
  actionUrl?: string | null;
  wardId?: Types.ObjectId | null;
  priority?: "low" | "normal" | "high";
}) {
  const {
    schoolId,
    userId,
    eventId,
    reminderAt,
    title,
    body,
    actionUrl,
    wardId,
    priority = "normal",
  } = input;

  try {
    await CalendarReminderLog.create({
      schoolId,
      eventId,
      userId,
      reminderAt,
    });
  } catch (error: any) {
    if (error?.code === 11000) return false;
    throw error;
  }

  await Notification.create({
    schoolId,
    userId,
    type: "reminder",
    title,
    body,
    isRead: false,
    priority,
    wardId: wardId || undefined,
    entityType: "AcademicCalendarEvent",
    entityId: eventId,
    actionUrl: actionUrl || undefined,
    metadata: {
      reminderAt: reminderAt.toISOString(),
    },
  });

  return true;
}
